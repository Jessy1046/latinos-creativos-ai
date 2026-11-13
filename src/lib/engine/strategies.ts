/**
 * Comparación de estrategias con métricas homogéneas y una recomendación explicable.
 * La recomendación es educativa: nunca es una garantía de ganancia.
 */
import type { BrrrrResult } from "./brrrr";
import type { FlipResult } from "./flip";
import type { MethodSummary, Risk } from "./financing";
import { project, RentalResult } from "./rental";
import type { DealInputs, ProjectionInputs } from "./types";

export interface StrategyRow {
  id: string;
  label: string;
  capitalRequired: number;
  monthlyCashFlow: number;
  /** Ganancia proyectada: flip = neta de venta; mantener = flujo 5 años + equidad año 5 - capital. */
  projectedProfit: number;
  profitBasis: string;
  roi: number | null;
  risk: Risk;
  recoveryYears: number | null;
  equity: number;
  financeCosts: number;
}

export type Goal = "flujo" | "ganancia_rapida" | "poco_capital" | "patrimonio";

export const GOAL_LABELS: Record<Goal, string> = {
  flujo: "Flujo de efectivo mensual",
  ganancia_rapida: "Ganancia rápida",
  poco_capital: "Usar poco capital propio",
  patrimonio: "Construir patrimonio a largo plazo",
};

function holdRow(id: string, label: string, deal: DealInputs, r: RentalResult, risk: Risk, p: ProjectionInputs, payback: number | null): StrategyRow {
  const proj = project(deal, r.debt, p, 5);
  const y5 = proj[proj.length - 1];
  const profit = y5.cumulativeCashFlow + y5.equity - r.cashInvested;
  return {
    id,
    label,
    capitalRequired: r.cashInvested,
    monthlyCashFlow: r.monthlyCashFlow,
    projectedProfit: profit,
    profitBasis: "5 años: flujo acumulado + equidad - capital",
    roi: r.cashInvested > 0 ? profit / r.cashInvested : null,
    risk: r.dscr !== null && r.dscr < 1 ? "alto" : risk,
    recoveryYears: payback,
    equity: r.equity,
    financeCosts: r.annualDebtService > 0 ? r.annualDebtService - (r.debt.loanAmount - proj[0].loanBalance) : 0,
  };
}

function flipRow(id: string, label: string, f: FlipResult, risk: Risk): StrategyRow {
  return {
    id,
    label,
    capitalRequired: f.cashInvested,
    monthlyCashFlow: 0,
    projectedProfit: f.netProfit,
    profitBasis: `Venta en ${f.months} meses`,
    roi: f.roiOnCash,
    risk: f.netProfit < 0 ? "alto" : risk,
    recoveryYears: f.months / 12,
    equity: 0,
    financeCosts: f.financingCosts,
  };
}

export function compareStrategies(args: {
  deal: DealInputs;
  projection: ProjectionInputs;
  conventional: RentalResult;
  methods: MethodSummary[];
  brrrr: BrrrrResult;
}): StrategyRow[] {
  const { deal, projection, conventional, methods, brrrr } = args;
  const hm = methods.find((m) => m.method === "hard_money")!;
  const rows: StrategyRow[] = [
    holdRow("renta", "Comprar para renta (préstamo tradicional)", deal, conventional, "medio", projection,
      conventional.annualCashFlow > 0 ? conventional.cashInvested / conventional.annualCashFlow : null),
    flipRow("flip", "Comprar para flip (hard money)", hm.flip, "alto"),
  ];
  for (const m of methods) {
    rows.push(holdRow(m.method, `${m.label} — mantener`, deal, m.rental, m.maturityRisk, projection, m.paybackYears));
  }
  const post = brrrr.postRefi;
  const projB = project({ ...deal, arv: brrrr.refi.appraisal }, post.debt, projection, 5);
  const y5 = projB[projB.length - 1];
  const profitB = y5.cumulativeCashFlow + y5.equity - brrrr.capitalRemaining;
  rows.push({
    id: "brrrr",
    label: "BRRRR",
    capitalRequired: brrrr.cashInvested,
    monthlyCashFlow: post.monthlyCashFlow,
    projectedProfit: profitB,
    profitBasis: "5 años tras refinanciar: flujo + equidad - capital que queda",
    roi: brrrr.capitalRemaining > 0 ? profitB / brrrr.capitalRemaining : null,
    risk: brrrr.status === "requiere_capital" || (post.dscr ?? 0) < 1 ? "alto" : "medio",
    recoveryYears: brrrr.status === "completa" ? 0 : post.annualCashFlow > 0 ? brrrr.capitalRemaining / post.annualCashFlow : null,
    equity: post.equity,
    financeCosts: post.annualDebtService,
  });
  return rows;
}

export function recommend(rows: StrategyRow[], goal: Goal): { row: StrategyRow | null; reason: string } {
  const pool = rows.filter((r) => r.risk !== "alto" || goal === "ganancia_rapida");
  const candidates = pool.length ? pool : rows;
  let best: StrategyRow | null = null;
  let reason = "";
  const by = (f: (r: StrategyRow) => number) => candidates.reduce((a, b) => (f(b) > f(a) ? b : a));
  switch (goal) {
    case "flujo":
      best = by((r) => r.monthlyCashFlow);
      reason = `Es la opción con mayor flujo mensual estimado (${Math.round(best.monthlyCashFlow)} USD/mes) entre las de riesgo no alto.`;
      break;
    case "ganancia_rapida": {
      const flips = rows.filter((r) => r.id === "flip");
      best = flips[0] ?? null;
      reason = best && best.projectedProfit > 0
        ? `El flip estima una ganancia neta de ${Math.round(best.projectedProfit)} USD en ${Math.round((best.recoveryYears ?? 0) * 12)} meses. Su riesgo es alto: depende del ARV y del tiempo de venta.`
        : "Con estos supuestos el flip no deja ganancia; revisa el precio de compra o el ARV.";
      break;
    }
    case "poco_capital":
      best = candidates.filter((r) => r.monthlyCashFlow >= 0).reduce<StrategyRow | null>(
        (a, b) => (!a || b.capitalRequired < a.capitalRequired ? b : a), null);
      reason = best ? `Requiere el menor capital propio (${Math.round(best.capitalRequired)} USD) manteniendo flujo no negativo.` : "Ninguna opción mantiene flujo positivo con poco capital.";
      break;
    case "patrimonio":
      best = by((r) => (r.roi ?? -Infinity));
      reason = "Tiene el mayor retorno estimado a 5 años sobre el capital que queda invertido (flujo + equidad). La apreciación es un supuesto, no una predicción.";
      break;
  }
  return { row: best, reason };
}

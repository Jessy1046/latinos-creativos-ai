/**
 * "Analista — Hermanitos Cruz" en modo determinista: interpreta los números
 * del motor financiero con reglas fijas. No inventa datos ni fuentes.
 */
import type { BrrrrResult } from "./brrrr";
import type { FlipResult } from "./flip";
import type { RentalResult } from "./rental";
import type { FlipRuleResult, RentRuleResult } from "./rules";
import type { DealInputs } from "./types";

export type InsightLevel = "positivo" | "alerta" | "riesgo" | "info";
export interface Insight {
  level: InsightLevel;
  title: string;
  text: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const EXPENSE_LABELS: Record<string, string> = {
  taxes: "impuestos",
  insurance: "seguro",
  management: "administración",
  maintenance: "mantenimiento",
  capex: "reserva de CapEx",
  hoa: "HOA",
  utilities: "servicios",
  other: "otros gastos",
};

export function generateInsights(a: {
  deal: DealInputs;
  rentRule: RentRuleResult;
  flipRule: FlipRuleResult;
  rental: RentalResult;
  flip: FlipResult;
  flipTarget: number;
  brrrr: BrrrrResult;
  isDemo: boolean;
}): Insight[] {
  const { deal, rentRule, flipRule, rental, flip, brrrr } = a;
  const out: Insight[] = [];

  if (a.isDemo) {
    out.push({ level: "alerta", title: "Datos de demostración", text: "Estos números usan datos ficticios del modo demostración. Verifica cada dato con fuentes reales antes de tomar decisiones." });
  }

  // Regla del 1.5%
  if (rentRule.ratio !== null) {
    const base = `Esta propiedad tiene una renta proyectada de ${usd(deal.monthlyRent)} y requiere ${usd(rentRule.investment)} de inversión (compra + reparaciones), es decir ${pct(rentRule.ratio, 2)} mensual.`;
    if (rentRule.verdict === "cumple") {
      out.push({ level: "positivo", title: `Cumple la regla del ${pct(rentRule.target)}`, text: `${base} Sin embargo, necesitas verificar los impuestos, el estado de la propiedad y el costo real del financiamiento para saber cuánto dinero producirá cada mes.` });
    } else {
      out.push({ level: rentRule.verdict === "revision" ? "alerta" : "riesgo", title: `No llega al ${pct(rentRule.target)}`, text: `${base} Para cumplir necesitarías una renta de ${usd(rentRule.requiredRent)} o comprar en máximo ${usd(Math.max(0, rentRule.maxPurchasePrice))}.` });
    }
  }

  // Regla del 50%
  if (deal.arv > 0) {
    out.push(
      flipRule.verdict === "cumple"
        ? { level: "positivo", title: "Cumple la regla del flip", text: `Con un ARV de ${usd(deal.arv)} y reparaciones de ${usd(deal.repairs)}, la oferta máxima por la regla es ${usd(flipRule.maxOffer)} y tu precio está ${usd(-flipRule.overBy)} por debajo.` }
        : { level: "riesgo", title: "No cumple la regla del flip", text: `La oferta máxima por la regla es ${usd(flipRule.maxOffer)}; tu precio la supera por ${usd(flipRule.overBy)}. La regla es un filtro rápido: revisa el presupuesto completo.` },
    );
  }

  // Flujo y DSCR
  if (rental.monthlyCashFlow < 0) {
    out.push({ level: "riesgo", title: "Flujo de efectivo negativo", text: `Después de gastos y deuda, la propiedad pierde ${usd(-rental.monthlyCashFlow)} al mes. Tendrías que cubrir esa diferencia de tu bolsillo.` });
  } else {
    out.push({ level: "info", title: "Flujo de efectivo", text: `Flujo estimado de ${usd(rental.monthlyCashFlow)} al mes (${usd(rental.annualCashFlow)} al año) antes de impuestos sobre la renta.` });
  }
  if (rental.dscr !== null && rental.dscr < 1.2) {
    out.push({ level: rental.dscr < 1 ? "riesgo" : "alerta", title: `DSCR de ${rental.dscr.toFixed(2)}`, text: "Muchos prestamistas DSCR piden 1.20 o más. Con este nivel el préstamo podría no aprobarse o requerir más enganche." });
  }

  // Gastos principales
  const top = Object.entries(rental.expenses).sort((x, y) => y[1] - x[1]).filter(([, v]) => v > 0).slice(0, 3);
  if (top.length) {
    out.push({ level: "info", title: "Gastos principales", text: `Los gastos más grandes son ${top.map(([k, v]) => `${EXPENSE_LABELS[k]} (${usd(v)}/año)`).join(", ")}.` });
  }

  // Supuestos inconsistentes o faltantes
  if (deal.taxesAnnual <= 0) out.push({ level: "alerta", title: "Impuestos en cero", text: "No hay impuestos registrados. Casi todas las propiedades pagan impuestos; consulta el registro del condado." });
  if (deal.insuranceAnnual <= 0) out.push({ level: "alerta", title: "Seguro en cero", text: "No hay seguro registrado. Pide una cotización real de seguro para propiedad de inversión." });
  if (deal.vacancyPct <= 0) out.push({ level: "alerta", title: "Vacancia en 0%", text: "Suponer cero vacancia es optimista. Considera al menos 5% para cambios de inquilino." });
  if (deal.capexPct <= 0) out.push({ level: "alerta", title: "Sin reserva de CapEx", text: "Techo, calentador, HVAC y otros reemplazos grandes llegan tarde o temprano. Considera una reserva." });
  if (rental.expenseRatio !== null && rental.expenseRatio < 0.25 && deal.monthlyRent > 0) {
    out.push({ level: "alerta", title: "Gastos posiblemente bajos", text: `Los gastos operativos son ${pct(rental.expenseRatio)} del ingreso bruto. Es más bajo que el escenario conservador de 25%–30%; confirma cada gasto.` });
  }
  if (deal.arv > 0 && deal.arv < deal.purchasePrice + deal.repairs) {
    out.push({ level: "riesgo", title: "ARV menor que el costo", text: `El ARV (${usd(deal.arv)}) es menor que compra + reparaciones (${usd(deal.purchasePrice + deal.repairs)}). Revisa los comparables.` });
  }
  if (deal.repairs <= 0) out.push({ level: "alerta", title: "Reparaciones en cero", text: "Sin presupuesto de reparaciones. Inspecciona la propiedad o pide cotizaciones a contratistas." });

  // Flip
  if (deal.arv > 0) {
    const ok = flip.roiOnTotalCost !== null && flip.roiOnTotalCost >= a.flipTarget;
    out.push({ level: flip.netProfit <= 0 ? "riesgo" : ok ? "positivo" : "alerta", title: "Ganancia del flip", text: `Con todos los costos (financiamiento, holding, venta y contingencia), la ganancia neta estimada es ${usd(flip.netProfit)}, ${flip.roiOnTotalCost !== null ? pct(flip.roiOnTotalCost) : "—"} sobre el costo total. Objetivo: ${pct(a.flipTarget, 0)}.` });
  }

  // BRRRR
  const s = brrrr.status;
  const statusText: Record<typeof s, string> = {
    completa: `Recuperarías todo tu capital (${usd(brrrr.cashInvested)}) al refinanciar, si el préstamo se aprueba con estos supuestos.`,
    parcial: `Recuperarías ${usd(brrrr.capitalRecovered)} de ${usd(brrrr.cashInvested)}; quedarían ${usd(brrrr.capitalRemaining)} dentro de la propiedad.`,
    sin_recuperacion: "El refinanciamiento apenas cubre el préstamo anterior y los costos: no recuperarías capital.",
    requiere_capital: `El nuevo préstamo no alcanza para pagar el anterior: necesitarías ${usd(brrrr.additionalCapitalNeeded)} adicionales.`,
  };
  out.push({ level: s === "completa" ? "positivo" : s === "parcial" ? "info" : "riesgo", title: "BRRRR", text: `${statusText[s]} El préstamo quedó limitado por ${brrrr.refi.limitedBy}.` });

  return out;
}

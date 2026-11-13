"use client";
/**
 * Estado del análisis y todos los resultados derivados.
 * Los cálculos se hacen con el motor determinista en cada cambio.
 */
import { useCallback, useMemo, useState } from "react";
import type { DataKind, PropertyLookup } from "@/lib/data/types";
import { generateInsights } from "@/lib/engine/analyst";
import { analyzeBrrrr, BrrrrInputs, DEFAULT_BRRRR, ExpansionInputs, simulateExpansion } from "@/lib/engine/brrrr";
import { AdjustmentRates, DEFAULT_ADJ, estimateArv, estimateRent, RentComp, SaleComp } from "@/lib/engine/comps";
import { analyzeFlip, DEFAULT_FLIP, FlipInputs, maxOfferForTargetProfit } from "@/lib/engine/flip";
import {
  cashMethod, DEFAULT_HARD_MONEY, DEFAULT_PARTNERS, DEFAULT_PRIVATE, hardMoneyLoan, hardMoneyMethod,
  HardMoneyInputs, partnersMethod, PartnersInputs, privateLenderMethod, PrivateLenderInputs,
} from "@/lib/engine/financing";
import { analyzeRental, conventionalPurchase, project } from "@/lib/engine/rental";
import { flipRule, rentRule, Verdict } from "@/lib/engine/rules";
import { compareStrategies, Goal, recommend } from "@/lib/engine/strategies";
import {
  DEFAULT_EXPENSE_PCTS, DEFAULT_LOAN, DEFAULT_PROJECTION, DEFAULT_SETTINGS, DealInputs, LoanInputs, ProjectionInputs, Settings,
} from "@/lib/engine/types";

export const EMPTY_DEAL: DealInputs = {
  purchasePrice: 0,
  repairs: 0,
  buyClosingPct: 0.03,
  arv: 0,
  units: 1,
  monthlyRent: 0,
  otherMonthlyIncome: 0,
  ...DEFAULT_EXPENSE_PCTS,
  taxesAnnual: 0,
  insuranceAnnual: 0,
  hoaMonthly: 0,
  utilitiesMonthly: 0,
  otherExpensesMonthly: 0,
};

export interface AnalysisState {
  deal: DealInputs;
  origins: Partial<Record<keyof DealInputs, { kind: DataKind; source: string }>>;
  settings: Settings;
  loan: LoanInputs;
  projection: ProjectionInputs;
  flip: FlipInputs;
  flipUsesHardMoney: boolean;
  lenders: HardMoneyInputs[];
  lenderIndex: number;
  partners: PartnersInputs;
  priv: PrivateLenderInputs;
  brrrr: BrrrrInputs;
  brrrrUsesHardMoney: boolean;
  expansion: ExpansionInputs;
  saleComps: SaleComp[];
  rentComps: RentComp[];
  adj: AdjustmentRates;
  goal: Goal;
}

const initial: AnalysisState = {
  deal: EMPTY_DEAL,
  origins: {},
  settings: DEFAULT_SETTINGS,
  loan: DEFAULT_LOAN,
  projection: DEFAULT_PROJECTION,
  flip: DEFAULT_FLIP,
  flipUsesHardMoney: true,
  lenders: [DEFAULT_HARD_MONEY, { ...DEFAULT_HARD_MONEY, lenderName: "Prestamista B", rate: 0.1, pointsPct: 0.03, purchasePctFinanced: 0.85 }],
  lenderIndex: 0,
  partners: DEFAULT_PARTNERS,
  priv: DEFAULT_PRIVATE,
  brrrr: DEFAULT_BRRRR,
  brrrrUsesHardMoney: true,
  expansion: { startingCapital: 50000, monthlySavings: 1500, reinvestCashFlow: true, maxConcurrentProjects: 2 },
  saleComps: [],
  rentComps: [],
  adj: DEFAULT_ADJ,
  goal: "flujo",
};

/** Construye los supuestos iniciales a partir de la búsqueda, sin inventar datos. */
function fromLookup(l: PropertyLookup): Pick<AnalysisState, "deal" | "origins" | "saleComps" | "rentComps"> {
  const p = l.property;
  const origins: AnalysisState["origins"] = {};
  const deal: DealInputs = { ...EMPTY_DEAL };
  const take = (key: keyof DealInputs, v: number | null, kind: DataKind, source: string) => {
    if (v !== null && v !== undefined) {
      (deal[key] as number) = v;
      origins[key] = { kind, source };
    } else {
      origins[key] = { kind: "no_disponible", source };
    }
  };
  const subject = {
    sqft: p.squareFootage.value ?? 0, beds: p.bedrooms.value ?? 0, baths: p.bathrooms.value ?? 0,
    propertyType: p.propertyType.value ?? "", units: p.units.value ?? 1,
  };
  take("purchasePrice", p.estimatedValue.value, p.estimatedValue.kind, `${p.estimatedValue.source} — ajústalo a tu oferta`);
  take("units", p.units.value, p.units.kind, p.units.source);
  take("taxesAnnual", p.annualTaxes.value, p.annualTaxes.kind, p.annualTaxes.source);

  const arv = estimateArv(l.saleComps, subject);
  if (arv.central > 0) take("arv", Math.round(arv.central / 500) * 500, l.mode === "demo" ? "demo" : "estimado", "Comparables de venta cerrada");
  else take("arv", p.estimatedValue.value, p.estimatedValue.kind === "no_disponible" ? "no_disponible" : p.estimatedValue.kind,
    "Sin ventas cerradas: se usa el valor estimado actual (no es un ARV). Verifica comparables.");

  const rentEst = estimateRent(l.rentComps, subject);
  if (p.estimatedRent.value !== null) take("monthlyRent", Math.round(p.estimatedRent.value * subject.units), p.estimatedRent.kind, p.estimatedRent.source);
  else take("monthlyRent", rentEst.totalMonthly > 0 ? Math.round(rentEst.totalMonthly) : null, l.mode === "demo" ? "demo" : "estimado", "Promedio de comparables de renta");

  // Supuestos de la app (transparentes y editables), no datos de la propiedad.
  if (deal.purchasePrice > 0) {
    take("insuranceAnnual", Math.round(deal.purchasePrice * 0.006), "estimado", "Supuesto de la app: 0.6% del precio. Pide una cotización real.");
  }
  if (l.mode === "demo" && subject.sqft > 0) take("repairs", Math.round((subject.sqft * 15) / 500) * 500, "demo", "DEMO: $15/sqft");
  else origins.repairs = { kind: "no_disponible", source: "Introduce tu presupuesto de reparaciones" };
  return { deal, origins, saleComps: l.saleComps, rentComps: l.rentComps };
}

export function useAnalysis() {
  const [lookup, setLookup] = useState<PropertyLookup | null>(null);
  const [s, setS] = useState<AnalysisState>(initial);

  const load = useCallback((l: PropertyLookup) => {
    setLookup(l);
    setS((prev) => {
      const next = { ...prev, ...fromLookup(l) };
      const cost = next.deal.purchasePrice + next.deal.repairs;
      next.priv = { ...prev.priv, loanAmount: Math.round((cost * 0.8) / 1000) * 1000 };
      next.partners = withPartnerCapital(prev.partners, cost + next.deal.purchasePrice * next.deal.buyClosingPct);
      return next;
    });
  }, []);

  const startManual = useCallback(() => {
    setLookup(null);
    setS({ ...initial, deal: { ...EMPTY_DEAL, purchasePrice: 80000, repairs: 20000, arv: 140000, monthlyRent: 1500, taxesAnnual: 2000, insuranceAnnual: 1000 },
      origins: Object.fromEntries((["purchasePrice", "repairs", "arv", "monthlyRent", "taxesAnnual", "insuranceAnnual"] as const).map((k) => [k, { kind: "usuario" as DataKind, source: "Captura manual" }])) });
  }, []);

  const setDeal = useCallback((patch: Partial<DealInputs>) => {
    setS((prev) => {
      const origins = { ...prev.origins };
      for (const k of Object.keys(patch) as (keyof DealInputs)[]) origins[k] = { kind: "usuario", source: "Introducido por ti" };
      return { ...prev, deal: { ...prev.deal, ...patch }, origins };
    });
  }, []);

  const set = useCallback(<K extends keyof AnalysisState>(key: K, value: AnalysisState[K] | ((v: AnalysisState[K]) => AnalysisState[K])) => {
    setS((prev) => ({ ...prev, [key]: typeof value === "function" ? (value as (v: AnalysisState[K]) => AnalysisState[K])(prev[key]) : value }));
  }, []);

  const r = useMemo(() => compute(s, lookup), [s, lookup]);
  return { lookup, state: s, load, startManual, setDeal, set, r };
}

export function withPartnerCapital(p: PartnersInputs, required: number): PartnersInputs {
  const caps = p.partners.filter((x) => x.role === "capitalista");
  if (caps.length === 0) return p;
  return { ...p, partners: p.partners.map((x) => (x.role === "capitalista" ? { ...x, capital: Math.round(required / caps.length) } : { ...x, capital: 0 })) };
}

function compute(s: AnalysisState, lookup: PropertyLookup | null) {
  const { deal, settings } = s;
  const lender = s.lenders[s.lenderIndex] ?? s.lenders[0];
  const hmLoan = hardMoneyLoan(deal, lender);

  const rent = rentRule(deal.purchasePrice, deal.repairs, deal.monthlyRent, settings.rentRulePct);
  const flipR = flipRule(deal.arv, deal.repairs, deal.purchasePrice, settings.flipRulePct);
  const conv = conventionalPurchase(deal, s.loan);
  const rental = analyzeRental(deal, conv.debt, conv.cashInvested, settings, s.projection.appreciation);
  const projection = project(deal, conv.debt, s.projection, 30);

  const flipInputs: FlipInputs = s.flipUsesHardMoney
    ? { ...s.flip, financing: { loanAmount: hmLoan.loanAmount, rate: lender.rate, pointsPct: lender.pointsPct, otherLoanFees: lender.originationFee } }
    : { ...s.flip, financing: { ...s.flip.financing, loanAmount: 0 } };
  const flip = analyzeFlip(deal, flipInputs);
  const loanPct = s.flipUsesHardMoney && deal.purchasePrice > 0 ? lender.purchasePctFinanced : undefined;
  const flipMaxOffer = deal.arv > 0 ? maxOfferForTargetProfit(
    deal,
    s.flipUsesHardMoney ? { ...flipInputs, financing: { ...flipInputs.financing, loanAmount: deal.repairs * lender.rehabPctFinanced } } : flipInputs,
    settings.flipTargetProfitPct,
    loanPct,
  ) : null;

  const cash = cashMethod(deal, s.flip, settings);
  const hardMoney = s.lenders.map((l) => hardMoneyMethod(deal, s.flip, settings, l));
  const partners = partnersMethod(deal, s.flip, settings, s.partners);
  const priv = privateLenderMethod(deal, s.flip, settings, s.priv);
  const methods = [cash, hardMoney[s.lenderIndex] ?? hardMoney[0], partners, priv];

  const brrrrInputs: BrrrrInputs = s.brrrrUsesHardMoney
    ? { ...s.brrrr, initialLoanAmount: hmLoan.loanAmount, initialRate: lender.rate, initialPointsPct: lender.pointsPct, initialFees: lender.originationFee }
    : { ...s.brrrr, initialLoanAmount: 0 };
  const brrrr = analyzeBrrrr(deal, brrrrInputs, settings);
  const expansion = simulateExpansion(brrrr, s.brrrr.rehabMonths + s.brrrr.seasoningMonths, s.expansion);

  const strategies = compareStrategies({ deal, projection: s.projection, conventional: rental, methods, brrrr });
  const recommendation = recommend(strategies, s.goal);

  const subject = {
    sqft: lookup?.property.squareFootage.value ?? 0, beds: lookup?.property.bedrooms.value ?? 0,
    baths: lookup?.property.bathrooms.value ?? 0, propertyType: lookup?.property.propertyType.value ?? "", units: deal.units,
  };
  const arv = estimateArv(s.saleComps, subject, s.adj);
  const rentEst = estimateRent(s.rentComps, subject);

  const insights = generateInsights({
    deal, rentRule: rent, flipRule: flipR, rental, flip, flipTarget: settings.flipTargetProfitPct, brrrr, isDemo: lookup?.mode === "demo",
  });

  let overall: Verdict = "revision";
  if (deal.monthlyRent > 0 && deal.purchasePrice > 0) {
    if (rent.verdict === "cumple" && rental.monthlyCashFlow > 0) overall = "cumple";
    else if (rent.verdict === "no_cumple" && flipR.verdict === "no_cumple") overall = "no_cumple";
  }

  return {
    lender, hmLoan, rent, flipR, conv, rental, projection, flipInputs, flip, flipMaxOffer, cash, hardMoney, partners, priv,
    methods, brrrrInputs, brrrr, expansion, strategies, recommendation, subject, arv, rentEst, insights, overall,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;

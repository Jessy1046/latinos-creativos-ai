/**
 * BRRRR: Buy, Rehab, Rent, Refinance, Repeat.
 * El refinanciamiento es una simulación: nunca se asume que será aprobado.
 */
import { balanceAfter, LoanType, principalFromPayment } from "./finance";
import { analyzeRental, operating, RentalResult } from "./rental";
import type { DealInputs, Settings } from "./types";

export interface BrrrrInputs {
  // Etapa 1: compra
  initialLoanAmount: number;
  initialRate: number;
  initialPointsPct: number;
  initialFees: number;
  initialLoanType: LoanType;
  // Etapa 2: remodelación
  rehabMonths: number;
  contingencyPct: number;
  monthlyUtilities: number;
  // Etapa 4: refinanciamiento
  appraisal: number;
  refiLtv: number;
  refiRate: number;
  refiTermYears: number;
  refiClosingPct: number;
  reservesRequired: number;
  minDscr: number;
  /**
   * Base del DSCR del prestamista:
   * - "renta": renta mensual total ÷ PITIA (principal + interés + impuestos + seguro + HOA).
   *   Es como lo calculan la mayoría de los préstamos DSCR para 1–4 unidades.
   * - "noi": NOI ÷ servicio de deuda (estilo comercial).
   */
  dscrBasis: "renta" | "noi";
  /** Límite máximo del prestamista (0 = sin límite). */
  lenderMaxLoan: number;
  seasoningMonths: number;
}

export const DEFAULT_BRRRR: BrrrrInputs = {
  initialLoanAmount: 0,
  initialRate: 0.12,
  initialPointsPct: 0.02,
  initialFees: 1500,
  initialLoanType: "solo_interes",
  rehabMonths: 3,
  contingencyPct: 0.1,
  monthlyUtilities: 200,
  appraisal: 0,
  refiLtv: 0.75,
  refiRate: 0.075,
  refiTermYears: 30,
  refiClosingPct: 0.03,
  reservesRequired: 3000,
  minDscr: 1.2,
  dscrBasis: "renta",
  lenderMaxLoan: 0,
  seasoningMonths: 3,
};

export type RecoveryStatus = "completa" | "parcial" | "sin_recuperacion" | "requiere_capital";

export interface BrrrrResult {
  buy: { price: number; closing: number; loanAmount: number; points: number; fees: number; cashAtPurchase: number };
  rehab: { budget: number; contingency: number; total: number; months: number; holdingCosts: number; interestDuringRehab: number };
  totalInvestment: number;
  cashInvested: number;
  rent: { noi: number; monthlyRent: number; operatingExpenses: number };
  refi: {
    appraisal: number;
    ltvLoan: number;
    dscrLoan: number;
    dscrBasis: "renta" | "noi";
    /** Impuestos + seguro + HOA mensuales (la parte "TIA" de PITIA). */
    monthlyTia: number;
    /** Pago mensual total del nuevo préstamo (PITIA). */
    monthlyPitia: number;
    /** DSCR resultante con la base elegida. */
    lenderDscr: number | null;
    lenderCap: number | null;
    newLoan: number;
    limitedBy: "LTV" | "DSCR" | "Prestamista";
    existingBalance: number;
    closingCosts: number;
    reserves: number;
    cashOut: number;
  };
  capitalRecovered: number;
  excessCash: number;
  capitalRemaining: number;
  additionalCapitalNeeded: number;
  status: RecoveryStatus;
  postRefi: RentalResult;
  repeatCapital: number;
}

export function analyzeBrrrr(deal: DealInputs, b: BrrrrInputs, settings: Settings): BrrrrResult {
  const closing = deal.purchasePrice * deal.buyClosingPct;
  const loan = Math.max(0, b.initialLoanAmount);
  const points = loan * b.initialPointsPct;
  const fees = loan > 0 ? b.initialFees : 0;
  const contingency = deal.repairs * b.contingencyPct;
  const rehabTotal = deal.repairs + contingency;
  const holdMonths = b.rehabMonths + b.seasoningMonths;
  // Aproximación: interés simple sobre el monto total durante remodelación + seasoning.
  const interest = (loan * b.initialRate * holdMonths) / 12;
  const holdingCosts =
    ((deal.taxesAnnual + deal.insuranceAnnual) / 12) * holdMonths + b.monthlyUtilities * b.rehabMonths + interest;
  const totalInvestment = deal.purchasePrice + closing + points + fees + rehabTotal + holdingCosts;
  const cashInvested = Math.max(0, totalInvestment - loan);

  const op = operating(deal);
  const appraisal = b.appraisal > 0 ? b.appraisal : deal.arv;
  const ltvLoan = appraisal * b.refiLtv;
  const monthlyTia = (deal.taxesAnnual + deal.insuranceAnnual) / 12 + deal.hoaMonthly;
  // Pago máximo de principal + interés que permite el DSCR mínimo.
  const maxMonthlyDebt =
    b.dscrBasis === "renta"
      ? Math.max(0, deal.monthlyRent / b.minDscr - monthlyTia)
      : op.noi > 0 ? op.noi / b.minDscr / 12 : 0;
  const dscrLoan = principalFromPayment(maxMonthlyDebt, b.refiRate, b.refiTermYears);
  const lenderCap = b.lenderMaxLoan > 0 ? b.lenderMaxLoan : null;
  const newLoan = Math.max(0, Math.min(ltvLoan, dscrLoan, lenderCap ?? Infinity));
  const limitedBy = newLoan === ltvLoan ? "LTV" : newLoan === dscrLoan ? "DSCR" : "Prestamista";
  const existingBalance = balanceAfter(loan, b.initialRate, 30, b.initialLoanType, holdMonths);
  const refiClosing = newLoan * b.refiClosingPct;
  const cashOut = newLoan - existingBalance - refiClosing - b.reservesRequired;

  const additionalCapitalNeeded = cashOut < 0 ? -cashOut : 0;
  const capitalRecovered = Math.min(Math.max(cashOut, 0), cashInvested);
  const excessCash = Math.max(0, cashOut - cashInvested);
  const capitalRemaining = cashInvested - capitalRecovered + additionalCapitalNeeded;

  let status: RecoveryStatus;
  if (cashOut < 0) status = "requiere_capital";
  else if (capitalRecovered >= cashInvested - 0.5) status = "completa";
  else if (capitalRecovered > 0) status = "parcial";
  else status = "sin_recuperacion";

  const postRefi = analyzeRental(
    { ...deal, arv: appraisal },
    { loanAmount: newLoan, rate: b.refiRate, termYears: b.refiTermYears, type: "amortizado" },
    capitalRemaining,
    settings,
  );

  const monthlyPitia = postRefi.monthlyDebtService + monthlyTia;
  const lenderDscr =
    b.dscrBasis === "renta" ? (monthlyPitia > 0 ? deal.monthlyRent / monthlyPitia : null) : postRefi.dscr;

  return {
    buy: { price: deal.purchasePrice, closing, loanAmount: loan, points, fees, cashAtPurchase: deal.purchasePrice + closing + points + fees - Math.min(loan, deal.purchasePrice) },
    rehab: { budget: deal.repairs, contingency, total: rehabTotal, months: b.rehabMonths, holdingCosts, interestDuringRehab: interest },
    totalInvestment,
    cashInvested,
    rent: { noi: op.noi, monthlyRent: deal.monthlyRent, operatingExpenses: op.operatingExpenses },
    refi: { appraisal, ltvLoan, dscrLoan, dscrBasis: b.dscrBasis, monthlyTia, monthlyPitia, lenderDscr, lenderCap, newLoan, limitedBy, existingBalance, closingCosts: refiClosing, reserves: b.reservesRequired, cashOut },
    capitalRecovered,
    excessCash,
    capitalRemaining,
    additionalCapitalNeeded,
    status,
    postRefi,
    repeatCapital: capitalRecovered + excessCash,
  };
}

export interface ExpansionInputs {
  startingCapital: number;
  monthlySavings: number;
  reinvestCashFlow: boolean;
  maxConcurrentProjects: number;
}

export interface ExpansionMilestone {
  target: number;
  months: number | null;
  capitalTiedUp: number;
  monthlyCashFlow: number;
}

/**
 * Simulación mes a mes: cada proyecto requiere `cashInvested` (+ capital adicional),
 * dura rehab + seasoning, y al refinanciar devuelve el cash-out positivo.
 * Supone que cada nueva propiedad replica los mismos números (simplificación fuerte).
 */
export function simulateExpansion(r: BrrrrResult, cycleMonths: number, e: ExpansionInputs, targets = [1, 5, 10, 25, 100]): ExpansionMilestone[] {
  const perDeal = Math.max(1, r.cashInvested + r.additionalCapitalNeeded);
  const returned = r.capitalRecovered + r.excessCash;
  const cf = r.postRefi.monthlyCashFlow;
  const tiedPerDeal = r.capitalRemaining + r.refi.reserves;
  let cash = e.startingCapital;
  let owned = 0;
  let inProgress: number[] = [];
  const reached = new Map<number, number>();
  const maxTarget = Math.max(...targets);
  for (let m = 0; m <= 600 && owned < maxTarget; m++) {
    // Proyectos que terminan este mes
    const done = inProgress.filter((t) => t <= m).length;
    inProgress = inProgress.filter((t) => t > m);
    owned += done;
    cash += done * returned;
    for (const t of targets) if (owned >= t && !reached.has(t)) reached.set(t, m);
    if (m > 0) cash += e.monthlySavings + (e.reinvestCashFlow ? owned * cf : 0);
    while (cash >= perDeal && inProgress.length < e.maxConcurrentProjects && owned + inProgress.length < maxTarget) {
      cash -= perDeal;
      inProgress.push(m + Math.max(1, cycleMonths));
    }
  }
  return targets.map((t) => ({
    target: t,
    months: reached.get(t) ?? null,
    capitalTiedUp: t * tiedPerDeal,
    monthlyCashFlow: t * cf,
  }));
}

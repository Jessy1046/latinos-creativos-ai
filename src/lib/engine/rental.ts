/**
 * Análisis de propiedades para renta.
 *
 * NOI = ingreso operativo efectivo - gastos operativos (sin servicio de deuda).
 * Cash flow = NOI - servicio de deuda.
 * DSCR = NOI / servicio anual de deuda.
 * Cash-on-cash = flujo anual antes de impuestos / capital propio invertido.
 */
import { balanceAfter, LoanType, monthlyDebtService, safeDiv } from "./finance";
import type { DealInputs, LoanInputs, ProjectionInputs, Settings } from "./types";

export interface Debt {
  loanAmount: number;
  rate: number;
  termYears: number;
  type: LoanType;
}

export const NO_DEBT: Debt = { loanAmount: 0, rate: 0, termYears: 30, type: "amortizado" };

export interface OperatingResult {
  grossPotentialIncome: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  expenses: {
    taxes: number;
    insurance: number;
    management: number;
    maintenance: number;
    capex: number;
    hoa: number;
    utilities: number;
    other: number;
  };
  operatingExpenses: number;
  noi: number;
  /** Gastos operativos / ingreso bruto potencial. */
  expenseRatio: number | null;
}

/** Ingresos y gastos anuales del primer año. */
export function operating(deal: DealInputs, rentMultiplier = 1, expenseMultiplier = 1): OperatingResult {
  const gpi = (deal.monthlyRent + deal.otherMonthlyIncome) * 12 * rentMultiplier;
  const vacancyLoss = gpi * deal.vacancyPct;
  const egi = gpi - vacancyLoss;
  const expenses = {
    taxes: deal.taxesAnnual * expenseMultiplier,
    insurance: deal.insuranceAnnual * expenseMultiplier,
    management: egi * deal.managementPct,
    maintenance: egi * deal.maintenancePct,
    capex: egi * deal.capexPct,
    hoa: deal.hoaMonthly * 12 * expenseMultiplier,
    utilities: deal.utilitiesMonthly * 12 * expenseMultiplier,
    other: deal.otherExpensesMonthly * 12 * expenseMultiplier,
  };
  const operatingExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
  return {
    grossPotentialIncome: gpi,
    vacancyLoss,
    effectiveGrossIncome: egi,
    expenses,
    operatingExpenses,
    noi: egi - operatingExpenses,
    expenseRatio: safeDiv(operatingExpenses, gpi),
  };
}

export interface RentalResult extends OperatingResult {
  debt: Debt;
  monthlyDebtService: number;
  annualDebtService: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashInvested: number;
  totalProjectCost: number;
  capRate: number | null;
  capRateBase: Settings["capRateBase"];
  capRateBaseValue: number;
  cashOnCash: number | null;
  dscr: number | null;
  /** Equidad estimada inicial = ARV (o precio) - deuda. */
  equity: number;
  /** Retorno total año 1 = (flujo + amortización + apreciación) / capital invertido. */
  totalReturnYear1: number | null;
}

export function analyzeRental(
  deal: DealInputs,
  debt: Debt,
  cashInvested: number,
  settings: Pick<Settings, "capRateBase">,
  appreciation = 0,
): RentalResult {
  const op = operating(deal);
  const mds = monthlyDebtService(debt.loanAmount, debt.rate, debt.termYears, debt.type);
  const ads = mds * 12;
  const annualCashFlow = op.noi - ads;
  const totalProjectCost = deal.purchasePrice + deal.repairs + deal.purchasePrice * deal.buyClosingPct;
  const value = deal.arv > 0 ? deal.arv : deal.purchasePrice + deal.repairs;
  const capRateBaseValue =
    settings.capRateBase === "precio" ? deal.purchasePrice : settings.capRateBase === "arv" ? value : totalProjectCost;
  const principalPaid = debt.loanAmount - balanceAfter(debt.loanAmount, debt.rate, debt.termYears, debt.type, 12);
  const equity = value - debt.loanAmount;
  return {
    ...op,
    debt,
    monthlyDebtService: mds,
    annualDebtService: ads,
    monthlyCashFlow: annualCashFlow / 12,
    annualCashFlow,
    cashInvested,
    totalProjectCost,
    capRate: safeDiv(op.noi, capRateBaseValue),
    capRateBase: settings.capRateBase,
    capRateBaseValue,
    cashOnCash: cashInvested > 0 ? annualCashFlow / cashInvested : null,
    dscr: ads > 0 ? op.noi / ads : null,
    equity,
    totalReturnYear1: cashInvested > 0 ? (annualCashFlow + principalPaid + value * appreciation) / cashInvested : null,
  };
}

/** Compra tradicional con enganche: arma la deuda y el capital invertido. */
export function conventionalPurchase(deal: DealInputs, loan: LoanInputs) {
  const loanAmount = deal.purchasePrice * (1 - loan.downPaymentPct);
  const downPayment = deal.purchasePrice - loanAmount;
  const closing = deal.purchasePrice * deal.buyClosingPct;
  const points = loanAmount * loan.pointsPct;
  const cashInvested = downPayment + deal.repairs + closing + points;
  const debt: Debt = { loanAmount, rate: loan.rate, termYears: loan.termYears, type: loan.type };
  return { debt, downPayment, closing, points, cashInvested };
}

export interface ProjectionYear {
  year: number;
  grossRent: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
}

/** Proyección año por año (hasta 30). La apreciación es un supuesto, no una predicción. */
export function project(deal: DealInputs, debt: Debt, p: ProjectionInputs, years = 30): ProjectionYear[] {
  const out: ProjectionYear[] = [];
  const startValue = deal.arv > 0 ? deal.arv : deal.purchasePrice + deal.repairs;
  const ads = monthlyDebtService(debt.loanAmount, debt.rate, debt.termYears, debt.type) * 12;
  let cumulative = 0;
  for (let y = 1; y <= years; y++) {
    const op = operating(deal, Math.pow(1 + p.rentGrowth, y - 1), Math.pow(1 + p.expenseInflation, y - 1));
    const balance = balanceAfter(debt.loanAmount, debt.rate, debt.termYears, debt.type, y * 12);
    // Si el préstamo ya terminó, no hay servicio de deuda.
    const debtService = y <= debt.termYears ? ads : 0;
    const cashFlow = op.noi - debtService;
    cumulative += cashFlow;
    const propertyValue = startValue * Math.pow(1 + p.appreciation, y);
    out.push({
      year: y,
      grossRent: op.grossPotentialIncome,
      noi: op.noi,
      debtService,
      cashFlow,
      cumulativeCashFlow: cumulative,
      propertyValue,
      loanBalance: balance,
      equity: propertyValue - balance,
    });
  }
  return out;
}

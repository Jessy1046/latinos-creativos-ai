/**
 * Cuatro métodos de compra y financiamiento. Todos usan los mismos
 * supuestos de propiedad (DealInputs) y de flip (FlipInputs) para que
 * la comparación sea justa.
 */
import { balanceAfter, LoanType, monthlyDebtService, safeDiv } from "./finance";
import { analyzeFlip, FlipInputs, FlipResult } from "./flip";
import { analyzeRental, NO_DEBT, RentalResult } from "./rental";
import type { DealInputs, Settings } from "./types";

export type Risk = "bajo" | "medio" | "alto";
export type MethodId = "cash" | "hard_money" | "socios" | "privado";

export interface MethodSummary {
  method: MethodId;
  label: string;
  /** Efectivo que aporta el inversionista (o los socios en conjunto). */
  capitalRequired: number;
  loanAmount: number;
  monthlyPayment: number;
  /** Escenario de mantener para renta con esta deuda. */
  rental: RentalResult;
  /** Escenario de vender (flip) con esta deuda. */
  flip: FlipResult;
  /** Costos financieros durante el proyecto de flip (intereses + puntos + comisiones). */
  financeCosts: number;
  /** Años para recuperar el capital solo con el flujo de renta. */
  paybackYears: number | null;
  balloon: number;
  maturityRisk: Risk;
  notes: string[];
}

function cashOutlayBase(deal: DealInputs) {
  return deal.purchasePrice + deal.repairs + deal.purchasePrice * deal.buyClosingPct;
}

function payback(capital: number, annualCashFlow: number) {
  return annualCashFlow > 0 && capital > 0 ? capital / annualCashFlow : null;
}

// ---------------------------------------------------------------- CASH

export function cashMethod(deal: DealInputs, flip: FlipInputs, settings: Settings): MethodSummary {
  const capital = cashOutlayBase(deal);
  const rental = analyzeRental(deal, NO_DEBT, capital, settings);
  const flipR = analyzeFlip(deal, { ...flip, financing: { ...flip.financing, loanAmount: 0 } });
  return {
    method: "cash",
    label: "Cash",
    capitalRequired: capital,
    loanAmount: 0,
    monthlyPayment: 0,
    rental,
    flip: flipR,
    financeCosts: 0,
    paybackYears: payback(capital, rental.annualCashFlow),
    balloon: 0,
    maturityRisk: "bajo",
    notes: ["Sin deuda: mayor capital inmovilizado, menor riesgo de vencimiento."],
  };
}

// ---------------------------------------------------------------- HARD MONEY

export interface HardMoneyInputs {
  lenderName: string;
  purchasePctFinanced: number;
  rehabPctFinanced: number;
  /** Tope del préstamo como % del ARV. */
  maxLtvArv: number;
  /** Tope del préstamo como % del costo (compra + reparaciones). */
  maxLtc: number;
  rate: number;
  pointsPct: number;
  originationFee: number;
  termMonths: number;
  type: LoanType;
  /** Años de amortización si el préstamo es amortizado. */
  amortYears: number;
  reserves: number;
  /** LTV del refinanciamiento esperado para evaluar la salida. */
  exitRefiLtv: number;
}

export const DEFAULT_HARD_MONEY: HardMoneyInputs = {
  lenderName: "Prestamista A",
  purchasePctFinanced: 0.9,
  rehabPctFinanced: 1,
  maxLtvArv: 0.7,
  maxLtc: 0.9,
  rate: 0.12,
  pointsPct: 0.02,
  originationFee: 1500,
  termMonths: 12,
  type: "solo_interes",
  amortYears: 30,
  reserves: 3000,
  exitRefiLtv: 0.75,
};

export function hardMoneyLoan(deal: DealInputs, h: HardMoneyInputs) {
  const requested = deal.purchasePrice * h.purchasePctFinanced + deal.repairs * h.rehabPctFinanced;
  const capArv = deal.arv * h.maxLtvArv;
  const capLtc = (deal.purchasePrice + deal.repairs) * h.maxLtc;
  const loanAmount = Math.max(0, Math.min(requested, capArv, capLtc));
  const purchaseFunds = Math.min(loanAmount, deal.purchasePrice * h.purchasePctFinanced);
  const rehabFunds = loanAmount - purchaseFunds;
  const limitedBy = loanAmount < requested ? (capArv <= capLtc ? "ARV" : "LTC") : null;
  return { requested, loanAmount, purchaseFunds, rehabFunds, limitedBy };
}

export function hardMoneyMethod(deal: DealInputs, flip: FlipInputs, settings: Settings, h: HardMoneyInputs): MethodSummary {
  const { loanAmount, rehabFunds, limitedBy } = hardMoneyLoan(deal, h);
  const points = loanAmount * h.pointsPct;
  const capital = cashOutlayBase(deal) + points + h.originationFee + h.reserves - loanAmount;
  const payment = monthlyDebtService(loanAmount, h.rate, h.amortYears, h.type);
  const balloon = balanceAfter(loanAmount, h.rate, h.amortYears, h.type, h.termMonths);
  const rental = analyzeRental(deal, { loanAmount, rate: h.rate, termYears: h.amortYears, type: h.type }, capital, settings);
  const flipR = analyzeFlip(deal, {
    ...flip,
    financing: { loanAmount, rate: h.rate, pointsPct: h.pointsPct, otherLoanFees: h.originationFee },
  });
  const notes: string[] = [];
  if (limitedBy) notes.push(`El préstamo está limitado por el tope de ${limitedBy}.`);
  notes.push(`Fondos de remodelación: ${Math.round(rehabFunds).toLocaleString("en-US")} USD, normalmente en desembolsos (draws) contra avance de obra.`);
  notes.push("El interés se calcula sobre el monto total desde el día 1 (supuesto conservador).");
  let risk: Risk = "medio";
  if (flip.months > h.termMonths) {
    risk = "alto";
    notes.push("El proyecto dura más que el plazo del préstamo: riesgo de vencimiento y extensiones.");
  } else if (flip.months > h.termMonths * 0.75) {
    risk = "alto";
    notes.push("Poco margen entre la duración del proyecto y el vencimiento.");
  }
  const refiCapacity = deal.arv * h.exitRefiLtv;
  notes.push(
    refiCapacity >= balloon
      ? `Salida por refinanciamiento posible en teoría: ${Math.round(refiCapacity).toLocaleString("en-US")} USD al ${Math.round(h.exitRefiLtv * 100)}% del ARV cubre el saldo (no garantiza aprobación).`
      : "Un refinanciamiento al LTV esperado NO cubriría el saldo: se necesitaría capital adicional.",
  );
  return {
    method: "hard_money",
    label: `Hard money (${h.lenderName})`,
    capitalRequired: capital,
    loanAmount,
    monthlyPayment: payment,
    rental,
    flip: flipR,
    financeCosts: flipR.financingCosts,
    paybackYears: payback(capital, rental.annualCashFlow),
    balloon,
    maturityRisk: risk,
    notes,
  };
}

// ---------------------------------------------------------------- SOCIOS

export interface Partner {
  name: string;
  role: "operador" | "capitalista";
  capital: number;
  /** % de las ganancias (flujo y venta) después de capital y retorno preferente. */
  profitShare: number;
}

export interface PartnersInputs {
  partners: Partner[];
  /** Retorno preferente anual para capitalistas (0 = sin preferente). */
  prefReturn: number;
}

export const DEFAULT_PARTNERS: PartnersInputs = {
  partners: [
    { name: "Operador", role: "operador", capital: 0, profitShare: 0.5 },
    { name: "Socio capitalista", role: "capitalista", capital: 0, profitShare: 0.5 },
  ],
  prefReturn: 0,
};

export interface PartnerResult extends Partner {
  annualCashFlow: number;
  flipDistribution: number;
  cashOnCash: number | null;
  flipRoi: number | null;
}

export interface PartnersResult extends MethodSummary {
  partnerResults: PartnerResult[];
  contributed: number;
  shortfall: number;
  shareTotal: number;
}

/**
 * Cascada simple: (1) retorno preferente a capitalistas, prorrata a su capital;
 * (2) remanente según % de ganancias. En venta: primero se devuelve el capital.
 * Las pérdidas reducen la devolución de capital prorrata al capital aportado.
 */
export function distribute(partners: Partner[], amount: number, prefOwed: number[]) {
  const out = partners.map(() => 0);
  let remaining = amount;
  if (remaining > 0) {
    const totalPref = prefOwed.reduce((a, b) => a + b, 0);
    const paid = Math.min(remaining, totalPref);
    prefOwed.forEach((p, i) => (out[i] += totalPref > 0 ? (paid * p) / totalPref : 0));
    remaining -= paid;
    partners.forEach((p, i) => (out[i] += remaining * p.profitShare));
  } else {
    const totalCap = partners.reduce((a, p) => a + p.capital, 0);
    partners.forEach((p, i) => (out[i] += totalCap > 0 ? (amount * p.capital) / totalCap : amount * p.profitShare));
  }
  return out;
}

export function partnersMethod(deal: DealInputs, flip: FlipInputs, settings: Settings, input: PartnersInputs): PartnersResult {
  const base = cashMethod(deal, flip, settings);
  const required = base.capitalRequired;
  const contributed = input.partners.reduce((a, p) => a + p.capital, 0);
  const shortfall = Math.max(0, required - contributed);
  const shareTotal = input.partners.reduce((a, p) => a + p.profitShare, 0);
  const prefYear = input.partners.map((p) => (p.role === "capitalista" ? p.capital * input.prefReturn : 0));
  const prefFlip = prefYear.map((p) => (p * flip.months) / 12);
  const cf = distribute(input.partners, base.rental.annualCashFlow, prefYear);
  const flipD = distribute(input.partners, base.flip.netProfit, prefFlip);
  const partnerResults = input.partners.map((p, i) => ({
    ...p,
    annualCashFlow: cf[i],
    flipDistribution: flipD[i],
    cashOnCash: p.capital > 0 ? cf[i] / p.capital : null,
    flipRoi: p.capital > 0 ? flipD[i] / p.capital : null,
  }));
  const notes: string[] = [];
  if (shortfall > 0) notes.push(`Faltan ${Math.round(shortfall).toLocaleString("en-US")} USD de aportaciones para cubrir el capital requerido.`);
  if (Math.abs(shareTotal - 1) > 0.0001) notes.push(`Los porcentajes de ganancia suman ${(shareTotal * 100).toFixed(1)}%, deben sumar 100%.`);
  notes.push("Estructura simplificada. Cada sociedad debe documentarse en un acuerdo legal (operating agreement).");
  return {
    ...base,
    method: "socios",
    label: "Socios capitalistas",
    notes,
    maturityRisk: "bajo",
    partnerResults,
    contributed,
    shortfall,
    shareTotal,
  };
}

// ---------------------------------------------------------------- PRESTAMISTA PRIVADO

export interface PrivateLenderInputs {
  loanAmount: number;
  rate: number;
  termMonths: number;
  /** pago_global: sin pagos mensuales, capital + interés simple al vencimiento. */
  paymentType: "solo_interes" | "amortizado" | "pago_global";
  amortYears: number;
  pointsPct: number;
  fees: number;
  lienPosition: 1 | 2;
}

export const DEFAULT_PRIVATE: PrivateLenderInputs = {
  loanAmount: 0,
  rate: 0.1,
  termMonths: 24,
  paymentType: "solo_interes",
  amortYears: 30,
  pointsPct: 0.01,
  fees: 500,
  lienPosition: 1,
};

export interface PrivateLenderResult extends MethodSummary {
  totalInterest: number;
  lenderAnnualReturn: number | null;
}

export function privateLenderMethod(
  deal: DealInputs,
  flip: FlipInputs,
  settings: Settings,
  p: PrivateLenderInputs,
): PrivateLenderResult {
  const loan = Math.max(0, p.loanAmount);
  const points = loan * p.pointsPct;
  const capital = Math.max(0, cashOutlayBase(deal) + points + p.fees - loan);
  let payment = 0;
  let totalInterest = 0;
  let balloon = 0;
  if (p.paymentType === "solo_interes") {
    payment = (loan * p.rate) / 12;
    totalInterest = payment * p.termMonths;
    balloon = loan;
  } else if (p.paymentType === "amortizado") {
    payment = monthlyDebtService(loan, p.rate, p.amortYears, "amortizado");
    balloon = balanceAfter(loan, p.rate, p.amortYears, "amortizado", p.termMonths);
    totalInterest = payment * p.termMonths - (loan - balloon);
  } else {
    totalInterest = (loan * p.rate * p.termMonths) / 12;
    balloon = loan + totalInterest;
  }
  const debtType: LoanType = p.paymentType === "amortizado" ? "amortizado" : "solo_interes";
  const rental =
    p.paymentType === "pago_global"
      ? analyzeRental(deal, NO_DEBT, capital, settings)
      : analyzeRental(deal, { loanAmount: loan, rate: p.rate, termYears: p.amortYears, type: debtType }, capital, settings);
  const flipR = analyzeFlip(deal, { ...flip, financing: { loanAmount: loan, rate: p.rate, pointsPct: p.pointsPct, otherLoanFees: p.fees } });
  const years = p.termMonths / 12;
  const notes: string[] = [];
  let risk: Risk = "bajo";
  if (balloon > 0) {
    risk = p.termMonths <= 24 ? "alto" : "medio";
    notes.push(`Pago global al vencimiento (mes ${p.termMonths}): ${Math.round(balloon).toLocaleString("en-US")} USD.`);
  }
  if (p.paymentType === "pago_global") notes.push("Sin pagos mensuales: el flujo de renta no descuenta deuda, pero el saldo crece hasta el vencimiento.");
  if (p.lienPosition === 2) notes.push("Gravamen en segunda posición: mayor riesgo para el prestamista.");
  if (flip.months > p.termMonths) {
    risk = "alto";
    notes.push("El proyecto de flip dura más que el plazo del préstamo.");
  }
  return {
    method: "privado",
    label: "Prestamista privado",
    capitalRequired: capital,
    loanAmount: loan,
    monthlyPayment: payment,
    rental,
    flip: flipR,
    financeCosts: flipR.financingCosts,
    paybackYears: payback(capital, rental.annualCashFlow),
    balloon,
    maturityRisk: risk,
    notes,
    totalInterest,
    lenderAnnualReturn: loan > 0 && years > 0 ? (safeDiv(totalInterest + points + p.fees, loan) ?? 0) / years : null,
  };
}

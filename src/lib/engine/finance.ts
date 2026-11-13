/**
 * Primitivas financieras deterministas.
 * Todas las tasas se expresan como decimales (0.07 = 7%).
 */

/** Pago mensual de un préstamo amortizado (principal + interés). */
export function amortizedPayment(principal: number, annualRate: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const n = Math.round(termYears * 12);
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Pago mensual de solo interés. */
export function interestOnlyPayment(principal: number, annualRate: number): number {
  if (principal <= 0) return 0;
  return (principal * annualRate) / 12;
}

/** Saldo pendiente de un préstamo amortizado después de `months` pagos. */
export function remainingBalance(principal: number, annualRate: number, termYears: number, months: number): number {
  if (principal <= 0) return 0;
  const n = Math.round(termYears * 12);
  if (months >= n) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal * (1 - months / n);
  const pmt = amortizedPayment(principal, annualRate, termYears);
  return principal * Math.pow(1 + r, months) - (pmt * (Math.pow(1 + r, months) - 1)) / r;
}

/** Intereses totales pagados en los primeros `months` meses de un préstamo amortizado. */
export function interestPaid(principal: number, annualRate: number, termYears: number, months: number): number {
  const pmt = amortizedPayment(principal, annualRate, termYears);
  const paidMonths = Math.min(months, Math.round(termYears * 12));
  const principalPaid = principal - remainingBalance(principal, annualRate, termYears, paidMonths);
  return pmt * paidMonths - principalPaid;
}

/** Préstamo máximo que soporta un pago mensual dado (valor presente). */
export function principalFromPayment(monthlyPayment: number, annualRate: number, termYears: number): number {
  if (monthlyPayment <= 0) return 0;
  const n = Math.round(termYears * 12);
  const r = annualRate / 12;
  if (r === 0) return monthlyPayment * n;
  return (monthlyPayment * (1 - Math.pow(1 + r, -n))) / r;
}

export type LoanType = "amortizado" | "solo_interes";

export function monthlyDebtService(principal: number, annualRate: number, termYears: number, type: LoanType): number {
  return type === "solo_interes"
    ? interestOnlyPayment(principal, annualRate)
    : amortizedPayment(principal, annualRate, termYears);
}

export function balanceAfter(principal: number, annualRate: number, termYears: number, type: LoanType, months: number): number {
  return type === "solo_interes" ? principal : remainingBalance(principal, annualRate, termYears, months);
}

/** División segura: devuelve null cuando el denominador es 0 (p. ej. sin capital invertido). */
export function safeDiv(a: number, b: number): number | null {
  if (!isFinite(a) || !isFinite(b) || b === 0) return null;
  return a / b;
}

/** Búsqueda por bisección de x en [lo, hi] tal que f(x) = 0, asumiendo f monótona. */
export function bisect(f: (x: number) => number, lo: number, hi: number, iterations = 80): number | null {
  let flo = f(lo);
  const fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (Math.sign(flo) === Math.sign(fhi)) return null;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Percentil con interpolación lineal (p entre 0 y 1). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export interface AmortizationYear {
  year: number;
  principalPaid: number;
  interestPaid: number;
  extraPaid: number;
  endBalance: number;
}

export interface AmortizationResult {
  /** Pago mensual programado de principal + interés (sin pago extra). */
  scheduledPayment: number;
  /** Principal e interés del primer mes. */
  firstMonthPrincipal: number;
  firstMonthInterest: number;
  totalInterest: number;
  totalPaid: number;
  /** Meses hasta liquidar el préstamo (menor que el plazo si hay pagos extra). */
  payoffMonths: number;
  years: AmortizationYear[];
}

/** Tabla de amortización mes a mes, agrupada por año, con pago extra opcional a principal. */
export function amortizationSchedule(principal: number, annualRate: number, termYears: number, extraMonthly = 0): AmortizationResult {
  const pmt = amortizedPayment(principal, annualRate, termYears);
  const r = annualRate / 12;
  const n = Math.round(termYears * 12);
  const years: AmortizationYear[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  let firstP = 0;
  let firstI = 0;
  while (balance > 0.005 && month < n) {
    month++;
    const interest = balance * r;
    const principalPart = Math.min(balance, pmt - interest);
    balance -= principalPart;
    const extra = Math.min(balance, Math.max(0, extraMonthly));
    balance -= extra;
    if (month === 1) {
      firstP = principalPart;
      firstI = interest;
    }
    totalInterest += interest;
    totalPaid += interest + principalPart + extra;
    const y = Math.ceil(month / 12);
    if (!years[y - 1]) years[y - 1] = { year: y, principalPaid: 0, interestPaid: 0, extraPaid: 0, endBalance: 0 };
    const row = years[y - 1];
    row.principalPaid += principalPart;
    row.interestPaid += interest;
    row.extraPaid += extra;
    row.endBalance = Math.max(0, balance);
  }
  return { scheduledPayment: pmt, firstMonthPrincipal: firstP, firstMonthInterest: firstI, totalInterest, totalPaid, payoffMonths: month, years };
}

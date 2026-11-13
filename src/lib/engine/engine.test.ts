import { describe, expect, it } from "vitest";
import { amortizedPayment, amortizationSchedule, remainingBalance, principalFromPayment } from "./finance";
import { rentRule, flipRule } from "./rules";
import { analyzeRental, conventionalPurchase, operating, NO_DEBT, project } from "./rental";
import { analyzeFlip, DEFAULT_FLIP, maxOfferForTargetProfit } from "./flip";
import { cashMethod, distribute, hardMoneyLoan, DEFAULT_HARD_MONEY, privateLenderMethod, DEFAULT_PRIVATE, partnersRefi, DEFAULT_PARTNERS_REFI } from "./financing";
import { analyzeBrrrr, DEFAULT_BRRRR, simulateExpansion } from "./brrrr";
import { estimateArv, SaleComp } from "./comps";
import { DEFAULT_SETTINGS, DealInputs } from "./types";

const deal: DealInputs = {
  purchasePrice: 80000,
  repairs: 20000,
  buyClosingPct: 0.03,
  arv: 140000,
  units: 1,
  monthlyRent: 1500,
  otherMonthlyIncome: 0,
  vacancyPct: 0.05,
  taxesAnnual: 2400,
  insuranceAnnual: 1200,
  managementPct: 0.08,
  maintenancePct: 0.05,
  capexPct: 0.05,
  hoaMonthly: 0,
  utilitiesMonthly: 0,
  otherExpensesMonthly: 0,
};

describe("primitivas financieras", () => {
  it("pago hipotecario estándar", () => {
    // 200,000 al 6% a 30 años = 1,199.10
    expect(amortizedPayment(200000, 0.06, 30)).toBeCloseTo(1199.1, 1);
  });
  it("saldo pendiente llega a cero al final", () => {
    expect(remainingBalance(100000, 0.07, 30, 360)).toBe(0);
    expect(remainingBalance(100000, 0.07, 30, 0)).toBeCloseTo(100000, 6);
  });
  it("principalFromPayment es la inversa del pago", () => {
    const pmt = amortizedPayment(150000, 0.075, 30);
    expect(principalFromPayment(pmt, 0.075, 30)).toBeCloseTo(150000, 4);
  });
  it("tasa cero", () => {
    expect(amortizedPayment(12000, 0, 1)).toBe(1000);
  });
});

describe("regla del 1.5%", () => {
  it("ejemplo de la metodología: 80k + 20k, renta 1,500 = 1.5%", () => {
    const r = rentRule(80000, 20000, 1500);
    expect(r.investment).toBe(100000);
    expect(r.ratio).toBeCloseTo(0.015, 10);
    expect(r.verdict).toBe("cumple");
    expect(r.requiredRent).toBe(1500);
    expect(r.maxPurchasePrice).toBeCloseTo(80000, 6);
  });
  it("precio máximo = renta / 0.015 - reparaciones", () => {
    const r = rentRule(120000, 20000, 1200);
    expect(r.maxPurchasePrice).toBeCloseTo(60000, 6);
    expect(r.verdict).toBe("no_cumple");
  });
  it("sin inversión no divide entre cero", () => {
    expect(rentRule(0, 0, 1000).ratio).toBeNull();
  });
});

describe("regla del 50%", () => {
  it("ejemplo: ARV 200k, reparaciones 30k = oferta 70k", () => {
    const r = flipRule(200000, 30000, 70000);
    expect(r.arvShare).toBe(100000);
    expect(r.maxOffer).toBe(70000);
    expect(r.verdict).toBe("cumple");
  });
  it("porcentaje configurable", () => {
    expect(flipRule(200000, 30000, 0, 0.7).maxOffer).toBe(110000);
  });
});

describe("análisis de renta", () => {
  it("NOI no incluye servicio de deuda", () => {
    const op = operating(deal);
    const egi = 1500 * 12 * 0.95;
    const opex = 2400 + 1200 + egi * (0.08 + 0.05 + 0.05);
    expect(op.effectiveGrossIncome).toBeCloseTo(egi, 6);
    expect(op.noi).toBeCloseTo(egi - opex, 6);
  });
  it("cash flow = NOI - deuda, DSCR = NOI / deuda anual", () => {
    const { debt, cashInvested } = conventionalPurchase(deal, { downPaymentPct: 0.25, rate: 0.07, termYears: 30, type: "amortizado", pointsPct: 0 });
    const r = analyzeRental(deal, debt, cashInvested, DEFAULT_SETTINGS);
    expect(r.annualCashFlow).toBeCloseTo(r.noi - r.annualDebtService, 6);
    expect(r.dscr).toBeCloseTo(r.noi / r.annualDebtService, 6);
    expect(r.cashOnCash).toBeCloseTo(r.annualCashFlow / cashInvested, 6);
    // capital = 25% enganche + reparaciones + cierre
    expect(cashInvested).toBeCloseTo(20000 + 20000 + 2400, 6);
  });
  it("cap rate usa la base seleccionada", () => {
    const r = analyzeRental(deal, NO_DEBT, 102400, { capRateBase: "precio" });
    expect(r.capRate).toBeCloseTo(r.noi / 80000, 8);
    expect(r.dscr).toBeNull();
  });
  it("proyección: el saldo baja y el flujo crece con la renta", () => {
    const { debt } = conventionalPurchase(deal, { downPaymentPct: 0.25, rate: 0.07, termYears: 30, type: "amortizado", pointsPct: 0 });
    const p = project(deal, debt, { rentGrowth: 0.03, expenseInflation: 0.02, appreciation: 0.03 });
    expect(p).toHaveLength(30);
    expect(p[29].loanBalance).toBeCloseTo(0, 4);
    expect(p[9].cashFlow).toBeGreaterThan(p[0].cashFlow);
  });
});

describe("flip", () => {
  it("ganancia = venta - todos los costos", () => {
    const f = analyzeFlip(deal, DEFAULT_FLIP);
    const sum = Object.values(f.costs).reduce((a, b) => a + b, 0);
    expect(f.netProfit).toBeCloseTo(140000 - sum, 6);
  });
  it("oferta máxima para 25% de ganancia sobre costo total", () => {
    const p = maxOfferForTargetProfit(deal, DEFAULT_FLIP, 0.25)!;
    const f = analyzeFlip({ ...deal, purchasePrice: p }, DEFAULT_FLIP);
    expect(f.netProfit / f.totalCost).toBeCloseTo(0.25, 4);
  });
});

describe("financiamientos", () => {
  it("cash no tiene deuda", () => {
    const m = cashMethod(deal, DEFAULT_FLIP, DEFAULT_SETTINGS);
    expect(m.loanAmount).toBe(0);
    expect(m.capitalRequired).toBeCloseTo(102400, 6);
  });
  it("hard money respeta el tope de ARV", () => {
    const l = hardMoneyLoan({ ...deal, arv: 100000 }, DEFAULT_HARD_MONEY);
    expect(l.loanAmount).toBe(70000);
    expect(l.limitedBy).toBe("ARV");
  });
  it("prestamista privado con pago global acumula interés", () => {
    const r = privateLenderMethod(deal, DEFAULT_FLIP, DEFAULT_SETTINGS, { ...DEFAULT_PRIVATE, loanAmount: 50000, rate: 0.1, termMonths: 12, paymentType: "pago_global" });
    expect(r.monthlyPayment).toBe(0);
    expect(r.balloon).toBeCloseTo(55000, 6);
  });
  it("cascada de socios: preferente primero, después split", () => {
    const partners = [
      { name: "Op", role: "operador" as const, capital: 0, profitShare: 0.3 },
      { name: "Cap", role: "capitalista" as const, capital: 100000, profitShare: 0.7 },
    ];
    const d = distribute(partners, 10000, [0, 8000]);
    expect(d[1]).toBeCloseTo(8000 + 2000 * 0.7, 6);
    expect(d[0]).toBeCloseTo(600, 6);
  });
});

describe("BRRRR", () => {
  it("recuperación completa cuando el cash-out cubre el capital", () => {
    const r = analyzeBrrrr({ ...deal, arv: 200000 }, { ...DEFAULT_BRRRR, reservesRequired: 0, refiClosingPct: 0 }, DEFAULT_SETTINGS);
    expect(r.refi.newLoan).toBeLessThanOrEqual(150000);
    expect(r.capitalRemaining).toBeGreaterThanOrEqual(0);
    expect(["completa", "parcial"]).toContain(r.status);
  });
  it("requiere capital cuando el nuevo préstamo no paga el anterior", () => {
    const r = analyzeBrrrr({ ...deal, arv: 90000 }, { ...DEFAULT_BRRRR, initialLoanAmount: 90000 }, DEFAULT_SETTINGS);
    expect(r.status).toBe("requiere_capital");
    expect(r.additionalCapitalNeeded).toBeGreaterThan(0);
  });
  it("DSCR limita el préstamo (base NOI)", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 900, arv: 200000 }, { ...DEFAULT_BRRRR, dscrBasis: "noi" }, DEFAULT_SETTINGS);
    expect(r.refi.limitedBy).toBe("DSCR");
    expect(r.postRefi.dscr!).toBeCloseTo(DEFAULT_BRRRR.minDscr, 4);
  });
  it("DSCR con la renta total: renta ÷ PITIA = mínimo", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 1100, arv: 250000 }, DEFAULT_BRRRR, DEFAULT_SETTINGS);
    expect(r.refi.limitedBy).toBe("DSCR");
    expect(r.refi.monthlyTia).toBeCloseTo((2400 + 1200) / 12, 6);
    expect(r.refi.lenderDscr!).toBeCloseTo(1.2, 4);
    expect(1100 / r.refi.monthlyPitia).toBeCloseTo(1.2, 4);
  });
  it("expansión alcanza metas con capital reciclado", () => {
    const r = analyzeBrrrr({ ...deal, arv: 200000 }, DEFAULT_BRRRR, DEFAULT_SETTINGS);
    const m = simulateExpansion(r, 6, { startingCapital: 120000, monthlySavings: 2000, reinvestCashFlow: true, maxConcurrentProjects: 2 });
    expect(m[0].months).not.toBeNull();
    for (let i = 1; i < m.length; i++) if (m[i].months !== null) expect(m[i].months!).toBeGreaterThanOrEqual(m[i - 1].months!);
  });
});

describe("comparables y ARV", () => {
  const today = new Date("2026-10-01");
  const mk = (i: number, price: number, months: number, dist: number, status: SaleComp["status"] = "vendido"): SaleComp => ({
    id: String(i), address: `${i} Test St`, saleDate: new Date(today.getTime() - months * 30.44 * 864e5).toISOString(),
    price, sqft: 1200, beds: 3, baths: 1, distanceMi: dist, propertyType: "Single Family", status, source: "test", adjustment: 0, included: true,
  });
  const subject = { sqft: 1200, beds: 3, baths: 1, propertyType: "Single Family" };
  it("solo usa ventas cerradas", () => {
    const r = estimateArv([mk(1, 150000, 1, 0.2), mk(2, 155000, 2, 0.3), mk(3, 160000, 2, 0.4), mk(4, 400000, 1, 0.1, "anunciado")], subject, undefined, today);
    expect(r.comps).toHaveLength(3);
    expect(r.central).toBeGreaterThan(149000);
    expect(r.central).toBeLessThan(161000);
    expect(r.conservative).toBeLessThanOrEqual(r.central);
    expect(r.optimistic).toBeGreaterThanOrEqual(r.central);
  });
  it("amplía radio y tiempo cuando faltan comparables", () => {
    const r = estimateArv([mk(1, 150000, 5, 0.8), mk(2, 152000, 4, 0.9), mk(3, 149000, 5, 0.7)], subject, undefined, today);
    expect(r.criteria.miles).toBe(1);
    expect(r.criteria.months).toBe(6);
  });
  it("sin datos no inventa valor", () => {
    const r = estimateArv([], subject, undefined, today);
    expect(r.confidence).toBe("sin_datos");
    expect(r.central).toBe(0);
  });
});

describe("tabla de amortización", () => {
  it("suma de principal = préstamo y termina en cero", () => {
    const a = amortizationSchedule(200000, 0.06, 30);
    const principal = a.years.reduce((s, y) => s + y.principalPaid, 0);
    expect(principal).toBeCloseTo(200000, 2);
    expect(a.years).toHaveLength(30);
    expect(a.years[29].endBalance).toBeCloseTo(0, 2);
    expect(a.firstMonthInterest).toBeCloseTo(1000, 6);
    expect(a.totalInterest).toBeCloseTo(1199.1 * 360 - 200000, -2);
  });
  it("pagos extra acortan el plazo y bajan el interés", () => {
    const base = amortizationSchedule(200000, 0.06, 30);
    const extra = amortizationSchedule(200000, 0.06, 30, 200);
    expect(extra.payoffMonths).toBeLessThan(360);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });
});

describe("socios + refinanciamiento DSCR", () => {
  const partners = {
    prefReturn: 0,
    partners: [
      { name: "Op", role: "operador" as const, capital: 0, profitShare: 0.5 },
      { name: "Cap", role: "capitalista" as const, capital: 102400, profitShare: 0.5 },
    ],
  };
  it("el préstamo respeta el DSCR mínimo y el LTV", () => {
    const r = partnersRefi(deal, DEFAULT_SETTINGS, partners, DEFAULT_PARTNERS_REFI);
    expect(r.newLoan).toBeLessThanOrEqual(r.ltvLoan + 1e-6);
    expect(r.newLoan).toBeLessThanOrEqual(r.dscrLoan + 1e-6);
    // Renta 1,500 / 1.2 = 1,250 de PITIA; menos 300 de TIA = 950 de P&I
    expect(r.maxMonthlyPi).toBeCloseTo(950, 6);
    expect(r.limitedBy).toBe("LTV"); // 75% de 140,000 = 105,000 < préstamo por DSCR
    expect(r.newLoan).toBeCloseTo(105000, 6);
    expect(r.lenderDscr!).toBeGreaterThanOrEqual(1.2 - 1e-6);
  });
  it("con renta baja el DSCR limita el préstamo y el DSCR resultante es el mínimo", () => {
    const r = partnersRefi({ ...deal, monthlyRent: 1000 }, DEFAULT_SETTINGS, partners, DEFAULT_PARTNERS_REFI);
    expect(r.limitedBy).toBe("DSCR");
    expect(r.lenderDscr!).toBeCloseTo(1.2, 6);
  });
  it("el cash-out devuelve capital primero al capitalista", () => {
    const r = partnersRefi(deal, DEFAULT_SETTINGS, partners, DEFAULT_PARTNERS_REFI);
    const cap = r.partnerResults[1]!;
    expect(r.cashOut).toBeGreaterThan(0);
    expect(cap.cashOut).toBeCloseTo(Math.min(r.cashOut, 102400), 6);
    expect(cap.capitalRemaining).toBeCloseTo(102400 - cap.capitalReturned, 6);
    expect(r.partnerResults[0]!.cashOut).toBeCloseTo(Math.max(0, r.cashOut - 102400) * 0.5, 6);
  });
  it("con préstamo grande todo el capital regresa y el excedente se reparte", () => {
    const r = partnersRefi({ ...deal, monthlyRent: 3000, arv: 250000 }, DEFAULT_SETTINGS, partners, { ...DEFAULT_PARTNERS_REFI, reserves: 0, closingPct: 0 });
    expect(r.capitalReturned).toBeCloseTo(102400, 6);
    expect(r.partnerResults[1]!.cashOnCashAfter).toBeNull();
    expect(r.partnerResults[0]!.cashOut).toBeGreaterThan(0);
  });
  it("sin renta no hay préstamo DSCR", () => {
    const r = partnersRefi({ ...deal, monthlyRent: 0 }, DEFAULT_SETTINGS, partners, DEFAULT_PARTNERS_REFI);
    expect(r.newLoan).toBe(0);
    expect(r.cashOut).toBeLessThan(0);
  });
});

/**
 * Presupuesto completo de flip. Independiente de la regla rápida del 50%:
 * aquí se calcula la ganancia real con todos los costos.
 */
import { bisect, safeDiv } from "./finance";
import type { DealInputs } from "./types";

export interface FlipFinancing {
  /** Monto del préstamo (0 = cash). */
  loanAmount: number;
  rate: number;
  pointsPct: number;
  otherLoanFees: number;
}

export interface FlipInputs {
  months: number;
  contingencyPct: number;
  monthlyUtilities: number;
  saleCommissionPct: number;
  saleClosingPct: number;
  financing: FlipFinancing;
}

export const DEFAULT_FLIP: FlipInputs = {
  months: 6,
  contingencyPct: 0.1,
  monthlyUtilities: 200,
  saleCommissionPct: 0.05,
  saleClosingPct: 0.02,
  financing: { loanAmount: 0, rate: 0.11, pointsPct: 0.02, otherLoanFees: 1500 },
};

export interface FlipResult {
  costs: {
    purchase: number;
    repairs: number;
    contingency: number;
    buyClosing: number;
    loanPoints: number;
    loanFees: number;
    interest: number;
    taxes: number;
    insurance: number;
    utilities: number;
    saleCommission: number;
    saleClosing: number;
  };
  holdingCosts: number;
  financingCosts: number;
  totalCost: number;
  salePrice: number;
  netProfit: number;
  /** Capital propio = costos totales pagados en efectivo (excluye lo que cubre el préstamo). */
  cashInvested: number;
  /** Ganancia / capital propio. */
  roiOnCash: number | null;
  /** Ganancia / costo total del proyecto. */
  roiOnTotalCost: number | null;
  annualizedRoi: number | null;
  months: number;
}

export function analyzeFlip(deal: DealInputs, f: FlipInputs): FlipResult {
  const fin = f.financing;
  const sale = deal.arv;
  // Interés solo-interés sobre el monto total, durante todo el proyecto (supuesto conservador).
  const interest = (fin.loanAmount * fin.rate * f.months) / 12;
  const costs = {
    purchase: deal.purchasePrice,
    repairs: deal.repairs,
    contingency: deal.repairs * f.contingencyPct,
    buyClosing: deal.purchasePrice * deal.buyClosingPct,
    loanPoints: fin.loanAmount * fin.pointsPct,
    loanFees: fin.loanAmount > 0 ? fin.otherLoanFees : 0,
    interest,
    taxes: (deal.taxesAnnual * f.months) / 12,
    insurance: (deal.insuranceAnnual * f.months) / 12,
    utilities: f.monthlyUtilities * f.months,
    saleCommission: sale * f.saleCommissionPct,
    saleClosing: sale * f.saleClosingPct,
  };
  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  const holdingCosts = costs.taxes + costs.insurance + costs.utilities + costs.interest;
  const financingCosts = costs.interest + costs.loanPoints + costs.loanFees;
  const netProfit = sale - totalCost;
  // Comisiones y cierre de venta se pagan del producto de la venta, no del bolsillo.
  const cashInvested = Math.max(0, totalCost - costs.saleCommission - costs.saleClosing - fin.loanAmount);
  const roiOnCash = safeDiv(netProfit, cashInvested);
  return {
    costs,
    holdingCosts,
    financingCosts,
    totalCost,
    salePrice: sale,
    netProfit,
    cashInvested,
    roiOnCash,
    roiOnTotalCost: safeDiv(netProfit, totalCost),
    annualizedRoi: roiOnCash === null || f.months <= 0 ? null : (roiOnCash * 12) / f.months,
    months: f.months,
  };
}

/**
 * Oferta máxima para alcanzar una ganancia objetivo sobre el costo total
 * del proyecto (capital total invertido, propio + prestado).
 * Si el préstamo es un % del precio, pasar `loanPctOfPrice` para que escale:
 * préstamo = financing.loanAmount (parte fija, p. ej. reparaciones) + precio × %.
 */
export function maxOfferForTargetProfit(
  deal: DealInputs,
  f: FlipInputs,
  targetPct: number,
  loanPctOfPrice?: number,
): number | null {
  const g = (price: number) => {
    const financing = loanPctOfPrice === undefined ? f.financing : { ...f.financing, loanAmount: f.financing.loanAmount + price * loanPctOfPrice };
    const r = analyzeFlip({ ...deal, purchasePrice: price }, { ...f, financing });
    return r.netProfit - targetPct * r.totalCost;
  };
  const result = bisect(g, 0, Math.max(deal.arv, 1) * 2);
  return result === null ? null : Math.max(0, result);
}

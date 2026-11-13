/**
 * Reglas rápidas de la metodología Hermanitos Cruz.
 * Son filtros iniciales, no garantías de rentabilidad.
 */
import { safeDiv } from "./finance";

export type Verdict = "cumple" | "no_cumple" | "revision";

export interface RentRuleResult {
  investment: number;
  /** Renta / inversión (decimal). */
  ratio: number | null;
  target: number;
  requiredRent: number;
  maxPurchasePrice: number;
  /** ratio - target (decimal). */
  gap: number | null;
  verdict: Verdict;
}

/**
 * Regla del 1.5%: renta mensual / (precio + reparaciones).
 * Precio máximo = renta / objetivo - reparaciones.
 */
export function rentRule(purchasePrice: number, repairs: number, monthlyRent: number, target = 0.015): RentRuleResult {
  const investment = purchasePrice + repairs;
  const ratio = safeDiv(monthlyRent, investment);
  const requiredRent = investment * target;
  const maxPurchasePrice = monthlyRent / target - repairs;
  const gap = ratio === null ? null : ratio - target;
  let verdict: Verdict = "revision";
  if (ratio !== null && monthlyRent > 0) {
    if (ratio >= target) verdict = "cumple";
    // Dentro del 10% del objetivo: requiere revisión en lugar de descartar.
    else if (ratio >= target * 0.9) verdict = "revision";
    else verdict = "no_cumple";
  }
  return { investment, ratio, target, requiredRent, maxPurchasePrice, gap, verdict };
}

export interface FlipRuleResult {
  arvShare: number;
  maxOffer: number;
  /** Precio de compra - oferta máxima (positivo = estás pagando de más). */
  overBy: number;
  verdict: Verdict;
}

/** Regla del 50%: oferta máxima = ARV × % - reparaciones. */
export function flipRule(arv: number, repairs: number, purchasePrice: number, pct = 0.5): FlipRuleResult {
  const arvShare = arv * pct;
  const maxOffer = arvShare - repairs;
  const overBy = purchasePrice - maxOffer;
  let verdict: Verdict = "revision";
  if (arv > 0) {
    if (overBy <= 0) verdict = "cumple";
    else if (overBy <= arv * 0.03) verdict = "revision";
    else verdict = "no_cumple";
  }
  return { arvShare, maxOffer, overBy, verdict };
}

/**
 * Comparables de venta (ARV) y de renta.
 * Solo las ventas cerradas ("vendido") entran al cálculo del ARV.
 */
import { percentile } from "./finance";

export type SaleStatus = "vendido" | "anunciado" | "estimado";

export interface SaleComp {
  id: string;
  address: string;
  saleDate: string | null; // ISO
  price: number;
  sqft: number;
  beds: number;
  baths: number;
  distanceMi: number;
  propertyType: string;
  status: SaleStatus;
  source: string;
  photoUrl?: string | null;
  /** Ajuste manual en USD por diferencias (condición, garage, etc.). */
  adjustment: number;
  included: boolean;
}

export interface Subject {
  sqft: number;
  beds: number;
  baths: number;
  propertyType: string;
}

/** Ajustes estándar por diferencias, además del ajuste manual. Editables desde la UI. */
export interface AdjustmentRates {
  perBed: number;
  perBath: number;
}

export const DEFAULT_ADJ: AdjustmentRates = { perBed: 7500, perBath: 5000 };

export function monthsAgo(iso: string | null, today: Date): number {
  if (!iso) return Infinity;
  const d = new Date(iso);
  return (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/**
 * Selección progresiva: 3 meses / 0.5 mi → 6 meses → 1 mi → 2 mi,
 * hasta tener al menos `min` ventas cerradas del mismo tipo.
 */
export function selectSaleComps(comps: SaleComp[], subject: Subject, today: Date, min = 3) {
  const steps = [
    { months: 3, miles: 0.5 },
    { months: 6, miles: 0.5 },
    { months: 6, miles: 1 },
    { months: 6, miles: 2 },
    { months: 12, miles: 2 },
  ];
  const eligible = comps.filter(
    (c) => c.status === "vendido" && c.included && c.propertyType === subject.propertyType && c.price > 0,
  );
  for (const s of steps) {
    const sel = eligible.filter((c) => monthsAgo(c.saleDate, today) <= s.months && c.distanceMi <= s.miles);
    if (sel.length >= min) return { selected: sel, criteria: s };
  }
  const last = steps[steps.length - 1];
  return {
    selected: eligible.filter((c) => monthsAgo(c.saleDate, today) <= last.months && c.distanceMi <= last.miles),
    criteria: last,
  };
}

export interface AdjustedComp extends SaleComp {
  pricePerSqft: number;
  sizeAdjustment: number;
  bedBathAdjustment: number;
  adjustedPrice: number;
  weight: number;
}

export function adjustComp(c: SaleComp, s: Subject, rates: AdjustmentRates, today: Date): AdjustedComp {
  const pricePerSqft = c.sqft > 0 ? c.price / c.sqft : 0;
  // Ajuste por tamaño a la mitad del $/sqft (el valor no escala linealmente con el área).
  const sizeAdjustment = c.sqft > 0 && s.sqft > 0 ? (s.sqft - c.sqft) * pricePerSqft * 0.5 : 0;
  const bedBathAdjustment = (s.beds - c.beds) * rates.perBed + (s.baths - c.baths) * rates.perBath;
  const adjustedPrice = c.price + sizeAdjustment + bedBathAdjustment + c.adjustment;
  const age = Math.min(monthsAgo(c.saleDate, today), 12);
  const sizeDiff = s.sqft > 0 && c.sqft > 0 ? Math.abs(s.sqft - c.sqft) / s.sqft : 0.3;
  // Peso: más cercano, más reciente y más parecido = más peso.
  const weight = (1 / (1 + c.distanceMi * 2)) * (1 / (1 + age / 6)) * (1 / (1 + sizeDiff * 3));
  return { ...c, pricePerSqft, sizeAdjustment, bedBathAdjustment, adjustedPrice, weight };
}

export interface ArvResult {
  comps: AdjustedComp[];
  conservative: number;
  central: number;
  optimistic: number;
  confidence: "alta" | "media" | "baja" | "sin_datos";
  dispersion: number | null;
  criteria: { months: number; miles: number };
}

export function estimateArv(all: SaleComp[], subject: Subject, rates = DEFAULT_ADJ, today = new Date()): ArvResult {
  const { selected, criteria } = selectSaleComps(all, subject, today);
  const comps = selected.map((c) => adjustComp(c, subject, rates, today));
  if (comps.length === 0) {
    return { comps, conservative: 0, central: 0, optimistic: 0, confidence: "sin_datos", dispersion: null, criteria };
  }
  const values = comps.map((c) => c.adjustedPrice);
  const wSum = comps.reduce((a, c) => a + c.weight, 0);
  const central = comps.reduce((a, c) => a + c.adjustedPrice * c.weight, 0) / wSum;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  const dispersion = mean > 0 ? sd / mean : null;
  let confidence: ArvResult["confidence"] = "baja";
  if (comps.length >= 5 && (dispersion ?? 1) < 0.1 && criteria.miles <= 1) confidence = "alta";
  else if (comps.length >= 3 && (dispersion ?? 1) < 0.18) confidence = "media";
  return {
    comps,
    conservative: Math.min(central, percentile(values, 0.25)),
    central,
    optimistic: Math.max(central, percentile(values, 0.75)),
    confidence,
    dispersion,
    criteria,
  };
}

// ---------------------------------------------------------------- RENTA

export interface RentComp {
  id: string;
  address: string;
  rent: number;
  beds: number;
  baths: number;
  sqft: number;
  distanceMi: number;
  date: string | null;
  propertyType: string;
  kind: "anunciada" | "contratada";
  source: string;
  adjustment: number;
  included: boolean;
}

export interface RentEstimate {
  comps: (RentComp & { adjustedRent: number; rentPerSqft: number })[];
  conservative: number;
  average: number;
  optimistic: number;
  perSqft: number;
  /** Renta por unidad (los comparables se interpretan por unidad). */
  perUnit: number;
  totalMonthly: number;
  annual: number;
}

export function estimateRent(all: RentComp[], subject: Subject & { units: number }, perBed = 100): RentEstimate {
  const comps = all
    .filter((c) => c.included && c.rent > 0)
    .map((c) => ({
      ...c,
      adjustedRent: c.rent + (subject.beds - c.beds) * perBed + c.adjustment,
      rentPerSqft: c.sqft > 0 ? c.rent / c.sqft : 0,
    }));
  const values = comps.map((c) => c.adjustedRent);
  const units = Math.max(1, subject.units);
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const psf = comps.filter((c) => c.rentPerSqft > 0);
  const perSqft = psf.length ? psf.reduce((a, c) => a + c.rentPerSqft, 0) / psf.length : 0;
  return {
    comps,
    conservative: values.length ? percentile(values, 0.25) : 0,
    average,
    optimistic: values.length ? percentile(values, 0.75) : 0,
    perSqft,
    perUnit: average,
    totalMonthly: average * units,
    annual: average * units * 12,
  };
}

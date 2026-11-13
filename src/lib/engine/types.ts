/**
 * Supuestos compartidos de la propiedad. Todos los módulos (renta, flip,
 * financiamientos, BRRRR) leen de esta misma estructura para que las
 * comparaciones sean justas.
 *
 * Porcentajes en decimales (0.08 = 8%). Montos en USD.
 */
export interface DealInputs {
  purchasePrice: number;
  repairs: number;
  /** Costos de cierre de compra como % del precio. */
  buyClosingPct: number;
  arv: number;
  units: number;
  /** Renta mensual total (todas las unidades). */
  monthlyRent: number;
  otherMonthlyIncome: number;
  vacancyPct: number;
  taxesAnnual: number;
  insuranceAnnual: number;
  /** Administración, mantenimiento y CapEx como % del ingreso operativo efectivo. */
  managementPct: number;
  maintenancePct: number;
  /** Reserva de CapEx. Es la ÚNICA línea de CapEx: no se suma otra vez como gasto real. */
  capexPct: number;
  hoaMonthly: number;
  utilitiesMonthly: number;
  otherExpensesMonthly: number;
}

export interface LoanInputs {
  /** % del precio de compra financiado (0 = cash). */
  downPaymentPct: number;
  rate: number;
  termYears: number;
  type: "amortizado" | "solo_interes";
  /** Puntos y comisiones del préstamo como % del monto. */
  pointsPct: number;
}

export interface ProjectionInputs {
  rentGrowth: number;
  expenseInflation: number;
  appreciation: number;
}

export interface Settings {
  /** Regla de renta mensual sobre inversión (Hermanitos Cruz: 1.5%). */
  rentRulePct: number;
  /** Regla rápida de flip (por defecto 50% del ARV). */
  flipRulePct: number;
  /** Ganancia objetivo de flip sobre el capital total invertido (25%). */
  flipTargetProfitPct: number;
  /** Cap rate: base de cálculo. */
  capRateBase: "precio" | "costo_total" | "arv";
}

export const DEFAULT_SETTINGS: Settings = {
  rentRulePct: 0.015,
  flipRulePct: 0.5,
  flipTargetProfitPct: 0.25,
  capRateBase: "costo_total",
};

export const DEFAULT_LOAN: LoanInputs = {
  downPaymentPct: 0.25,
  rate: 0.075,
  termYears: 30,
  type: "amortizado",
  pointsPct: 0.01,
};

export const DEFAULT_PROJECTION: ProjectionInputs = {
  rentGrowth: 0.03,
  expenseInflation: 0.03,
  appreciation: 0.03,
};

/** Supuestos de gastos por defecto: editables, no apropiados para todas las propiedades. */
export const DEFAULT_EXPENSE_PCTS = {
  vacancyPct: 0.05,
  managementPct: 0.08,
  maintenancePct: 0.08,
  capexPct: 0.07,
};

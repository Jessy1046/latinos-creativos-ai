/**
 * Contrato común para proveedores de datos inmobiliarios.
 * Cambiar de RentCast a ATTOM (u otro) solo requiere un nuevo adaptador.
 */
import type { RentComp, SaleComp } from "../engine/comps";

/** Origen de cada dato, para mostrarlo siempre al usuario. */
export type DataKind = "verificado" | "estimado" | "usuario" | "no_disponible" | "demo";

export interface Field<T> {
  value: T | null;
  kind: DataKind;
  source: string;
  updatedAt: string | null;
}

export interface SaleEvent {
  date: string;
  event: string;
  price: number | null;
}

export interface PropertyRecord {
  formattedAddress: Field<string>;
  city: Field<string>;
  state: Field<string>;
  zipCode: Field<string>;
  latitude: Field<number>;
  longitude: Field<number>;
  propertyType: Field<string>;
  bedrooms: Field<number>;
  bathrooms: Field<number>;
  squareFootage: Field<number>;
  yearBuilt: Field<number>;
  lotSize: Field<number>;
  units: Field<number>;
  estimatedValue: Field<number>;
  valueRange: Field<[number, number]>;
  estimatedRent: Field<number>;
  rentRange: Field<[number, number]>;
  annualTaxes: Field<number>;
  lastSalePrice: Field<number>;
  lastSaleDate: Field<string>;
  owner: Field<string>;
  history: SaleEvent[];
}

export interface PropertyLookup {
  mode: "demo" | "rentcast";
  provider: string;
  fetchedAt: string;
  property: PropertyRecord;
  saleComps: SaleComp[];
  rentComps: RentComp[];
  warnings: string[];
}

export interface PropertyDataProvider {
  readonly name: string;
  lookup(address: string): Promise<PropertyLookup>;
}

export function field<T>(value: T | null | undefined, kind: DataKind, source: string, updatedAt: string | null): Field<T> {
  if (value === null || value === undefined || (typeof value === "number" && !isFinite(value))) {
    return { value: null, kind: "no_disponible", source, updatedAt: null };
  }
  return { value, kind, source, updatedAt };
}

export class ProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

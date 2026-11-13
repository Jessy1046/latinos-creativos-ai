/**
 * Proveedor de DEMOSTRACIÓN. Genera datos FICTICIOS pero estables a partir
 * de la dirección, para poder probar la aplicación sin una API configurada.
 * Todos los campos se marcan con kind = "demo". Nunca representan la realidad.
 */
import type { RentComp, SaleComp } from "../engine/comps";
import { field, PropertyDataProvider, PropertyLookup } from "./types";

const SRC = "DEMO — datos ficticios";

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const STREETS = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Lincoln", "Washington", "Park", "Lake", "Hill"];
const SUFFIX = ["St", "Ave", "Dr", "Ct", "Pl"];

function parseAddress(address: string) {
  const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
  return { city: m?.[1]?.trim() ?? null, state: m?.[2]?.toUpperCase() ?? null, zip: m?.[3] ?? null };
}

export class DemoProvider implements PropertyDataProvider {
  readonly name = "Demostración";

  async lookup(address: string): Promise<PropertyLookup> {
    const r = rng(hash(address));
    const now = new Date();
    const at = now.toISOString();
    const { city, state, zip } = parseAddress(address);
    const beds = 2 + Math.floor(r() * 3);
    const baths = 1 + Math.floor(r() * 2);
    const sqft = Math.round((900 + r() * 1100) / 10) * 10;
    const ppsf = 90 + r() * 90;
    const value = Math.round((sqft * ppsf) / 1000) * 1000;
    const rent = Math.round((value * (0.009 + r() * 0.006)) / 25) * 25;
    const type = "Single Family";
    const d = (n: number) => field(n, "demo" as const, SRC, at);

    const saleComps: SaleComp[] = Array.from({ length: 8 }, (_, i) => {
      const cs = Math.round((sqft * (0.8 + r() * 0.4)) / 10) * 10;
      const months = r() * 7;
      const status: SaleComp["status"] = i < 6 ? "vendido" : "anunciado";
      return {
        id: `demo-s${i}`,
        address: `${100 + Math.floor(r() * 8900)} ${STREETS[i % STREETS.length]} ${SUFFIX[i % SUFFIX.length]} (DEMO)`,
        saleDate: status === "vendido" ? new Date(now.getTime() - months * 30.44 * 864e5).toISOString() : null,
        price: Math.round((cs * ppsf * 1.25 * (0.9 + r() * 0.2)) / 500) * 500,
        sqft: cs,
        beds: Math.max(1, beds + Math.floor(r() * 3) - 1),
        baths: Math.max(1, baths + Math.floor(r() * 2) - (r() > 0.5 ? 1 : 0)),
        distanceMi: Math.round(r() * 1.4 * 100) / 100,
        propertyType: type,
        status,
        source: SRC,
        photoUrl: null,
        adjustment: 0,
        included: true,
      };
    });

    const rentComps: RentComp[] = Array.from({ length: 6 }, (_, i) => {
      const cb = Math.max(1, beds + Math.floor(r() * 3) - 1);
      return {
        id: `demo-r${i}`,
        address: `${100 + Math.floor(r() * 8900)} ${STREETS[(i + 4) % STREETS.length]} ${SUFFIX[(i + 2) % SUFFIX.length]} (DEMO)`,
        rent: Math.round((rent * (0.85 + r() * 0.3) + (cb - beds) * 100) / 25) * 25,
        beds: cb,
        baths: Math.max(1, baths + (r() > 0.6 ? 1 : 0) - (r() > 0.7 ? 1 : 0)),
        sqft: Math.round((sqft * (0.8 + r() * 0.4)) / 10) * 10,
        distanceMi: Math.round(r() * 1.2 * 100) / 100,
        date: new Date(now.getTime() - r() * 120 * 864e5).toISOString(),
        propertyType: type,
        kind: i < 4 ? "anunciada" : "contratada",
        source: SRC,
        adjustment: 0,
        included: true,
      };
    });

    const lastSale = Math.round((value * (0.55 + r() * 0.3)) / 1000) * 1000;
    const lastSaleDate = new Date(now.getTime() - (2 + r() * 10) * 365 * 864e5).toISOString().slice(0, 10);

    return {
      mode: "demo",
      provider: this.name,
      fetchedAt: at,
      property: {
        formattedAddress: field(address.trim(), "usuario", "Introducido por el usuario", at),
        city: city ? field(city, "usuario", "Dirección introducida", at) : field<string>(null, "no_disponible", SRC, null),
        state: state ? field(state, "usuario", "Dirección introducida", at) : field<string>(null, "no_disponible", SRC, null),
        zipCode: zip ? field(zip, "usuario", "Dirección introducida", at) : field<string>(null, "no_disponible", SRC, null),
        latitude: field<number>(null, "no_disponible", SRC, null),
        longitude: field<number>(null, "no_disponible", SRC, null),
        propertyType: field(type, "demo", SRC, at),
        bedrooms: d(beds),
        bathrooms: d(baths),
        squareFootage: d(sqft),
        yearBuilt: d(1920 + Math.floor(r() * 85)),
        lotSize: d(Math.round((3000 + r() * 6000) / 10) * 10),
        units: d(1),
        estimatedValue: d(value),
        valueRange: field<[number, number]>([Math.round(value * 0.9), Math.round(value * 1.1)], "demo", SRC, at),
        estimatedRent: d(rent),
        rentRange: field<[number, number]>([Math.round(rent * 0.9), Math.round(rent * 1.1)], "demo", SRC, at),
        annualTaxes: d(Math.round(value * (0.012 + r() * 0.01))),
        lastSalePrice: d(lastSale),
        lastSaleDate: field(lastSaleDate, "demo", SRC, at),
        owner: field<string>(null, "no_disponible", SRC, null),
        history: [{ date: lastSaleDate, event: "Venta (DEMO)", price: lastSale }],
      },
      saleComps,
      rentComps,
      warnings: [
        "Modo demostración: no hay una API de datos configurada. Todos los valores marcados como DEMO son ficticios.",
      ],
    };
  }
}

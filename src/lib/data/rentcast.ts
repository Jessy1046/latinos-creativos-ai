/**
 * Adaptador de RentCast (https://developers.rentcast.io).
 * Solo se ejecuta en el servidor: la clave nunca llega al navegador.
 *
 * Importante: los comparables de los endpoints AVM de RentCast provienen de
 * ANUNCIOS (listings), no de ventas cerradas verificadas. Por eso se marcan
 * como "anunciado" y no entran al ARV hasta que el usuario los verifique.
 *
 * Estado: preparado según la documentación pública; pendiente de validar con
 * una clave real. Cada consulta consume créditos de tu plan de RentCast.
 */
import type { RentComp, SaleComp } from "../engine/comps";
import { field, PropertyDataProvider, PropertyLookup, ProviderError, SaleEvent } from "./types";

const BASE = "https://api.rentcast.io/v1";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export class RentCastProvider implements PropertyDataProvider {
  readonly name = "RentCast";
  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string>): Promise<Json> {
    const url = `${BASE}${path}?${new URLSearchParams(params)}`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.status === 401) throw new ProviderError("La clave de RentCast no es válida.", 502);
    if (res.status === 429) throw new ProviderError("Límite de consultas de RentCast alcanzado.", 429);
    if (!res.ok) throw new ProviderError(`RentCast respondió ${res.status}.`, 502);
    return res.json();
  }

  async lookup(address: string): Promise<PropertyLookup> {
    const at = new Date().toISOString();
    const warnings: string[] = [];
    const [records, value, rent] = await Promise.all([
      this.get("/properties", { address }),
      this.get("/avm/value", { address, compCount: "15" }).catch((e) => (warnings.push(`Valor estimado: ${e.message}`), null)),
      this.get("/avm/rent/long-term", { address, compCount: "15" }).catch((e) => (warnings.push(`Renta estimada: ${e.message}`), null)),
    ]);
    const p: Json = Array.isArray(records) ? records[0] : records;
    if (!p) warnings.push("RentCast no encontró un registro público para esta dirección.");

    const rec = "RentCast — registro público";
    const avm = "RentCast — estimación automática (AVM)";
    const v = <T>(x: T | undefined | null, src = rec) => field<T>(x ?? null, "verificado", src, at);
    const e = <T>(x: T | undefined | null) => field<T>(x ?? null, "estimado", avm, at);

    const taxes = p?.propertyTaxes ? Object.values(p.propertyTaxes as Record<string, Json>).sort((a: Json, b: Json) => b.year - a.year)[0] : null;
    const history: SaleEvent[] = p?.history
      ? Object.values(p.history as Record<string, Json>).map((h: Json) => ({ date: h.date, event: h.event, price: h.price ?? null }))
      : [];

    const saleComps: SaleComp[] = (value?.comparables ?? []).map((c: Json, i: number) => ({
      id: c.id ?? `rc-s${i}`,
      address: c.formattedAddress,
      saleDate: c.removedDate ?? c.listedDate ?? null,
      price: c.price ?? 0,
      sqft: c.squareFootage ?? 0,
      beds: c.bedrooms ?? 0,
      baths: c.bathrooms ?? 0,
      distanceMi: c.distance ?? 0,
      propertyType: c.propertyType ?? "",
      status: "anunciado",
      source: `RentCast — anuncio ${c.status === "Inactive" ? "retirado" : "activo"}`,
      photoUrl: null,
      adjustment: 0,
      included: true,
    }));

    const rentComps: RentComp[] = (rent?.comparables ?? []).map((c: Json, i: number) => ({
      id: c.id ?? `rc-r${i}`,
      address: c.formattedAddress,
      rent: c.price ?? 0,
      beds: c.bedrooms ?? 0,
      baths: c.bathrooms ?? 0,
      sqft: c.squareFootage ?? 0,
      distanceMi: c.distance ?? 0,
      date: c.listedDate ?? null,
      propertyType: c.propertyType ?? "",
      kind: "anunciada",
      source: "RentCast — anuncio de renta",
      adjustment: 0,
      included: true,
    }));

    return {
      mode: "rentcast",
      provider: this.name,
      fetchedAt: at,
      property: {
        formattedAddress: v(p?.formattedAddress ?? address),
        city: v(p?.city),
        state: v(p?.state),
        zipCode: v(p?.zipCode),
        latitude: v(p?.latitude ?? value?.subjectProperty?.latitude),
        longitude: v(p?.longitude ?? value?.subjectProperty?.longitude),
        propertyType: v(p?.propertyType),
        bedrooms: v(p?.bedrooms),
        bathrooms: v(p?.bathrooms),
        squareFootage: v(p?.squareFootage),
        yearBuilt: v(p?.yearBuilt),
        lotSize: v(p?.lotSize),
        units: v(p?.features?.unitCount ?? (p ? 1 : null)),
        estimatedValue: e(value?.price),
        valueRange: e(value ? ([value.priceRangeLow, value.priceRangeHigh] as [number, number]) : null),
        estimatedRent: e(rent?.rent),
        rentRange: e(rent ? ([rent.rentRangeLow, rent.rentRangeHigh] as [number, number]) : null),
        annualTaxes: v(taxes?.total, taxes ? `${rec} (${taxes.year})` : rec),
        lastSalePrice: v(p?.lastSalePrice),
        lastSaleDate: v(p?.lastSaleDate?.slice(0, 10)),
        owner: v(p?.owner?.names?.join(", ")),
        history,
      },
      saleComps,
      rentComps,
      warnings: [
        ...warnings,
        "Los comparables de RentCast provienen de anuncios, no de ventas cerradas. Verifica el precio de venta real antes de marcarlos como 'vendido'.",
      ],
    };
  }
}

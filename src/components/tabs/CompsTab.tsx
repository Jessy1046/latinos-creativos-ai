"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RentComp, SaleComp } from "@/lib/engine/comps";
import { date, num, pct, usd } from "@/lib/format";
import { Card, Grid, Note, NumberField, Row, Stat, Table, Tabs } from "../ui";
import type { Analysis } from "../useAnalysis";

const STATUS_LABEL: Record<SaleComp["status"], string> = { vendido: "Vendido", anunciado: "Anunciado", estimado: "Estimado" };

export function CompsTab({ a }: { a: Analysis }) {
  const [sub, setSub] = useState<"venta" | "renta">("venta");
  return (
    <div className="space-y-4">
      <Tabs variant="pill" value={sub} onChange={setSub} tabs={[{ id: "venta", label: "Comparables de venta y ARV" }, { id: "renta", label: "Comparables de renta" }]} />
      {sub === "venta" ? <Sales a={a} /> : <Rents a={a} />}
    </div>
  );
}

function Sales({ a }: { a: Analysis }) {
  const { state: s, set, setDeal, r } = a;
  const arv = r.arv;
  const upd = (id: string, patch: Partial<SaleComp>) => set("saleComps", s.saleComps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const usedIds = new Set(arv.comps.map((c) => c.id));
  const adjById = new Map(arv.comps.map((c) => [c.id, c]));
  const [draft, setDraft] = useState({ address: "", price: 0, sqft: 0, beds: 3, baths: 1, distanceMi: 0.3, saleDate: new Date().toISOString().slice(0, 10) });

  return (
    <div className="space-y-4">
      <Card title="ARV estimado por comparables" subtitle={`Criterio aplicado: vendidos en ${arv.criteria.months} meses, dentro de ${arv.criteria.miles} mi, mismo tipo (${r.subject.propertyType || "—"})`}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat big label="ARV conservador" value={usd(arv.conservative)} />
          <Stat big label="ARV central" value={usd(arv.central)} tone="gold" />
          <Stat big label="ARV optimista" value={usd(arv.optimistic)} />
          <Stat big label="Confianza" value={<span className="capitalize">{arv.confidence.replace("_", " ")}</span>} sub={`Dispersión ${pct(arv.dispersion)} · ${arv.comps.length} comps`} />
          <div className="flex items-end">
            <button disabled={arv.central <= 0} onClick={() => setDeal({ arv: Math.round(arv.central / 500) * 500 })}
              className="w-full rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40">Usar ARV central</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Grid cols={2}>
            <NumberField label="Ajuste por habitación" value={s.adj.perBed} onChange={(v) => set("adj", { ...s.adj, perBed: v })} />
            <NumberField label="Ajuste por baño" value={s.adj.perBath} onChange={(v) => set("adj", { ...s.adj, perBath: v })} />
          </Grid>
          <Note>Solo las ventas cerradas (estado “Vendido”) entran al ARV. Los precios anunciados y las estimaciones automáticas se muestran pero no se usan. Ponderación: más cercano, más reciente y de tamaño más parecido pesa más. Ajuste por tamaño = 50% del $/sqft del comparable.</Note>
        </div>
      </Card>

      <Card title="Comparables de venta" subtitle={`Sujeto: ${num(r.subject.sqft)} sqft · ${r.subject.beds} hab · ${r.subject.baths} baños`}>
        {s.saleComps.length === 0 ? <Note tone="warn">No hay comparables. Agrega ventas que hayas verificado (MLS, registro del condado o tu agente).</Note> : (
          <Table head={["", "Dirección", "Estado", "Fecha", "Precio", "Sqft", "$/sqft", "Dist.", "Hab/Baños", "Ajuste manual", "Ajustado", "Fuente", ""]}>
            {s.saleComps.map((c) => {
              const adj = adjById.get(c.id);
              return (
                <tr key={c.id} className={usedIds.has(c.id) ? "" : "opacity-60"}>
                  <td className="px-2 py-2"><input type="checkbox" checked={c.included} onChange={(e) => upd(c.id, { included: e.target.checked })} title="Incluir" /></td>
                  <td className="px-2 py-2 font-medium whitespace-nowrap">{c.address}</td>
                  <td className="px-2 py-2">
                    <select value={c.status} onChange={(e) => upd(c.id, { status: e.target.value as SaleComp["status"] })} className="rounded border border-navy-100 bg-white px-1 py-0.5 text-xs">
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{date(c.saleDate)}</td>
                  <td className="px-2 py-2">{usd(c.price)}</td>
                  <td className="px-2 py-2">{num(c.sqft)}</td>
                  <td className="px-2 py-2">{c.sqft ? usd(c.price / c.sqft) : "—"}</td>
                  <td className="px-2 py-2">{c.distanceMi.toFixed(2)} mi</td>
                  <td className="px-2 py-2">{c.beds}/{c.baths}</td>
                  <td className="px-2 py-2 w-28"><NumberField label="" value={c.adjustment} onChange={(v) => upd(c.id, { adjustment: v })} /></td>
                  <td className="px-2 py-2 font-semibold">{adj ? usd(adj.adjustedPrice) : "No usado"}</td>
                  <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{c.source}</td>
                  <td className="px-2 py-2"><button onClick={() => set("saleComps", s.saleComps.filter((x) => x.id !== c.id))} className="text-risk-600" title="Eliminar"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </Table>
        )}
        <h4 className="mt-5 mb-2 text-sm font-semibold">Agregar venta verificada manualmente</h4>
        <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-8">
          <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Dirección</span>
            <input className="w-full rounded-lg border border-navy-100 px-2.5 py-2 text-sm" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Fecha de venta</span>
            <input type="date" className="w-full rounded-lg border border-navy-100 px-2 py-2 text-sm" value={draft.saleDate} onChange={(e) => setDraft({ ...draft, saleDate: e.target.value })} /></label>
          <NumberField label="Precio vendido" value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />
          <NumberField label="Sqft" unit="num" value={draft.sqft} onChange={(v) => setDraft({ ...draft, sqft: v })} />
          <NumberField label="Hab" unit="num" value={draft.beds} onChange={(v) => setDraft({ ...draft, beds: v })} />
          <NumberField label="Distancia (mi)" unit="num" value={draft.distanceMi} onChange={(v) => setDraft({ ...draft, distanceMi: v })} />
          <button disabled={!draft.address || draft.price <= 0}
            onClick={() => {
              set("saleComps", [...s.saleComps, { id: `m-${Date.now()}`, ...draft, saleDate: new Date(draft.saleDate).toISOString(), baths: draft.baths, propertyType: r.subject.propertyType,
                status: "vendido", source: "Introducido por ti", adjustment: 0, included: true, photoUrl: null }]);
              setDraft({ ...draft, address: "", price: 0 });
            }}
            className="flex items-center justify-center gap-1 rounded-lg bg-gold-500 px-3 py-2 text-sm font-semibold text-navy-950 disabled:opacity-40"><Plus size={14} /> Agregar</button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Las fotografías de comparables se mostrarán solo cuando exista una fuente con licencia que las autorice.</p>
      </Card>
    </div>
  );
}

function Rents({ a }: { a: Analysis }) {
  const { state: s, set, setDeal, r } = a;
  const e = r.rentEst;
  const upd = (id: string, patch: Partial<RentComp>) => set("rentComps", s.rentComps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const [draft, setDraft] = useState({ address: "", rent: 0, beds: 3, baths: 1, sqft: 0, distanceMi: 0.3 });
  return (
    <div className="space-y-4">
      <Card title="Mercado de renta">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat big label="Renta conservadora" value={usd(e.conservative)} sub="por unidad" />
          <Stat big label="Promedio ajustado" value={usd(e.average)} tone="gold" sub="por unidad" />
          <Stat big label="Renta optimista" value={usd(e.optimistic)} sub="por unidad" />
          <Stat big label="Renta por sqft" value={usd(e.perSqft, 2)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <Row label={`Renta mensual total (${s.deal.units} unidad${s.deal.units > 1 ? "es" : ""})`} value={usd(e.totalMonthly)} />
            <Row label="Renta anual proyectada" value={usd(e.annual)} />
          </div>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2">
            {([["Conservadora", e.conservative], ["Promedio", e.average], ["Optimista", e.optimistic]] as const).map(([l, v]) => (
              <button key={l} disabled={v <= 0} onClick={() => setDeal({ monthlyRent: Math.round(v * s.deal.units) })}
                className="rounded-lg border border-navy-100 px-3 py-2 text-sm hover:bg-navy-50 disabled:opacity-40">Usar renta {l.toLowerCase()}</button>
            ))}
          </div>
        </div>
        <div className="mt-3"><Note>Las rentas “anunciadas” son precios pedidos; las “contratadas” son contratos firmados. Ajuste automático: $100 por habitación de diferencia, más tu ajuste manual.</Note></div>
      </Card>
      <Card title="Comparables de renta">
        {s.rentComps.length === 0 ? <Note tone="warn">No hay comparables de renta. Agrega rentas que hayas verificado.</Note> : (
          <Table head={["", "Dirección", "Tipo de dato", "Renta", "Hab/Baños", "Sqft", "Dist.", "Fecha", "Inmueble", "Ajuste", "Fuente", ""]}>
            {s.rentComps.map((c) => (
              <tr key={c.id} className={c.included ? "" : "opacity-50"}>
                <td className="px-2 py-2"><input type="checkbox" checked={c.included} onChange={(ev) => upd(c.id, { included: ev.target.checked })} /></td>
                <td className="px-2 py-2 font-medium whitespace-nowrap">{c.address}</td>
                <td className="px-2 py-2">
                  <select value={c.kind} onChange={(ev) => upd(c.id, { kind: ev.target.value as RentComp["kind"] })} className="rounded border border-navy-100 bg-white px-1 py-0.5 text-xs">
                    <option value="anunciada">Anunciada</option><option value="contratada">Contratada</option>
                  </select>
                </td>
                <td className="px-2 py-2">{usd(c.rent)}</td>
                <td className="px-2 py-2">{c.beds}/{c.baths}</td>
                <td className="px-2 py-2">{num(c.sqft)}</td>
                <td className="px-2 py-2">{c.distanceMi.toFixed(2)} mi</td>
                <td className="px-2 py-2 whitespace-nowrap">{date(c.date)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{c.propertyType}</td>
                <td className="px-2 py-2 w-24"><NumberField label="" value={c.adjustment} onChange={(v) => upd(c.id, { adjustment: v })} /></td>
                <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{c.source}</td>
                <td className="px-2 py-2"><button onClick={() => set("rentComps", s.rentComps.filter((x) => x.id !== c.id))} className="text-risk-600"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </Table>
        )}
        <h4 className="mt-5 mb-2 text-sm font-semibold">Agregar renta manualmente</h4>
        <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-7">
          <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Dirección</span>
            <input className="w-full rounded-lg border border-navy-100 px-2.5 py-2 text-sm" value={draft.address} onChange={(ev) => setDraft({ ...draft, address: ev.target.value })} /></label>
          <NumberField label="Renta / mes" value={draft.rent} onChange={(v) => setDraft({ ...draft, rent: v })} />
          <NumberField label="Hab" unit="num" value={draft.beds} onChange={(v) => setDraft({ ...draft, beds: v })} />
          <NumberField label="Sqft" unit="num" value={draft.sqft} onChange={(v) => setDraft({ ...draft, sqft: v })} />
          <button disabled={!draft.address || draft.rent <= 0}
            onClick={() => {
              set("rentComps", [...s.rentComps, { id: `m-${Date.now()}`, ...draft, date: new Date().toISOString(), propertyType: r.subject.propertyType,
                kind: "contratada", source: "Introducido por ti", adjustment: 0, included: true }]);
              setDraft({ ...draft, address: "", rent: 0 });
            }}
            className="flex items-center justify-center gap-1 rounded-lg bg-gold-500 px-3 py-2 text-sm font-semibold text-navy-950 disabled:opacity-40"><Plus size={14} /> Agregar</button>
        </div>
      </Card>
    </div>
  );
}

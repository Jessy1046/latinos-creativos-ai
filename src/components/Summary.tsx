"use client";
import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import type { Field } from "@/lib/data/types";
import type { MethodId, MethodSummary } from "@/lib/engine/financing";
import { date, num, pct, ratio, usd } from "@/lib/format";
import { Card, DataBadge, NumberField, RiskBadge, Stat, tone, VerdictBadge } from "./ui";
import type { Analysis } from "./useAnalysis";

function Fact<T>({ label, f, render }: { label: string; f: Field<T>; render?: (v: T) => string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm" title={`${f.source}${f.updatedAt ? ` · ${date(f.updatedAt)}` : ""}`}>
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1.5 text-right font-medium text-navy-900">
        {f.value === null ? "—" : render ? render(f.value) : String(f.value)}
        <DataBadge kind={f.kind} />
      </span>
    </div>
  );
}

/**
 * Enlaces para revisar la propiedad en otros portales (fotos, Zestimate, historial).
 * Solo abren el sitio en una pestaña nueva: la app no extrae datos de ellos.
 */
function ExternalLinks({ address }: { address: string }) {
  const q = encodeURIComponent(address);
  const links = [
    { label: "Zillow", href: `https://www.zillow.com/homes/${encodeURIComponent(address.replace(/\s+/g, "-"))}_rb/` },
    { label: "Redfin", href: `https://www.google.com/search?q=${q}+site%3Aredfin.com` },
    { label: "Realtor.com", href: `https://www.google.com/search?q=${q}+site%3Arealtor.com` },
    { label: "Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${q}` },
    // Propwire pide iniciar sesión y no tiene enlace directo por dirección: abre la página principal.
    { label: "Propwire", href: "https://propwire.com/" },
  ];
  return (
    <div className="no-print mt-3">
      <div className="mb-1.5 text-xs font-medium text-slate-500">Ver fotos e historial en:</div>
      <div className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-navy-100 px-3 py-2 text-sm font-medium text-navy-800 transition hover:border-gold-500 hover:bg-gold-100/40">
            {l.label} <ExternalLink size={13} className="text-slate-400" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function Summary({ a, onOpenFinancing }: { a: Analysis; onOpenFinancing?: () => void }) {
  const { lookup, state, setDeal, r } = a;
  const d = state.deal;
  const o = state.origins;
  const p = lookup?.property;

  return (
    <div className="space-y-4">
      {lookup?.warnings.map((w) => (
        <div key={w} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${lookup.mode === "demo" ? "bg-risk-100 text-risk-600" : "bg-warn-100 text-warn-600"}`}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {w}
        </div>
      ))}
      {!lookup && (
        <div className="rounded-xl bg-gold-100 px-4 py-3 text-sm text-warn-600">
          Captura manual: todos los datos son introducidos por ti. Los números iniciales son el ejemplo de la metodología; reemplázalos.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {p && (
          <Card
            title={p.formattedAddress.value}
            subtitle={<>Fuente: {lookup.provider} · Consultado {date(lookup.fetchedAt)}</>}
            className="xl:col-span-1"
          >
            <div className="divide-y divide-navy-50">
              <Fact label="Tipo" f={p.propertyType} />
              <Fact label="Habitaciones / baños" f={{ ...p.bedrooms, value: p.bedrooms.value === null ? null : `${p.bedrooms.value} / ${p.bathrooms.value ?? "—"}` }} />
              <Fact label="Pies cuadrados" f={p.squareFootage} render={(v) => num(v)} />
              <Fact label="Año de construcción" f={p.yearBuilt} />
              <Fact label="Terreno (sqft)" f={p.lotSize} render={(v) => num(v)} />
              <Fact label="Unidades" f={p.units} />
              <Fact label="Impuestos anuales" f={p.annualTaxes} render={(v) => usd(v)} />
              <Fact label="Última venta" f={{ ...p.lastSalePrice, value: p.lastSalePrice.value === null ? null : `${usd(p.lastSalePrice.value)} · ${p.lastSaleDate.value ?? ""}` }} />
              <Fact label="Propietario" f={p.owner} />
            </div>
            {p.formattedAddress.value && <ExternalLinks address={p.formattedAddress.value} />}
            {p.latitude.value !== null && p.longitude.value !== null && (
              <iframe
                title="Mapa"
                className="no-print mt-3 h-40 w-full rounded-xl border border-navy-100"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${p.longitude.value - 0.01},${p.latitude.value - 0.006},${p.longitude.value + 0.01},${p.latitude.value + 0.006}&layer=mapnik&marker=${p.latitude.value},${p.longitude.value}`}
              />
            )}
          </Card>
        )}

        <Card className={p ? "xl:col-span-2" : "xl:col-span-3"} title="Resumen de la inversión"
          actions={<div className="flex items-center gap-2 text-xs text-slate-500">Resultado general <VerdictBadge v={r.overall} size="lg" /></div>}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
            <Stat label="Valor estimado actual" value={usd(p?.estimatedValue.value ?? null)}
              sub={p?.valueRange.value ? `${usd(p.valueRange.value[0])} – ${usd(p.valueRange.value[1])}` : p ? "No disponible" : "Sin búsqueda"} />
            <Stat label="Flujo mensual" big value={usd(r.rental.monthlyCashFlow)} tone={tone(r.rental.monthlyCashFlow)}
              sub={`Con ${pct(state.loan.downPaymentPct, 0)} de enganche al ${pct(state.loan.rate, 2)}`} />
            <Stat label={`Regla del ${pct(state.settings.rentRulePct)}`} big value={pct(r.rent.ratio, 2)}
              tone={r.rent.verdict === "cumple" ? "money" : r.rent.verdict === "no_cumple" ? "risk" : "gold"}
              sub={<VerdictBadge v={r.rent.verdict} />} />
            <Stat label={`Regla del ${pct(state.settings.flipRulePct, 0)} (flip)`} big value={usd(r.flipR.maxOffer)}
              tone={r.flipR.verdict === "cumple" ? "money" : r.flipR.verdict === "no_cumple" ? "risk" : "gold"}
              sub={<span className="flex items-center gap-1">Oferta máx. <VerdictBadge v={r.flipR.verdict} /></span>} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-navy-50 pt-4 md:grid-cols-3">
            <NumberField label="Precio de compra" value={d.purchasePrice} onChange={(v) => setDeal({ purchasePrice: v })} kind={o.purchasePrice?.kind} hint={o.purchasePrice?.source} min={0} />
            <NumberField label="Reparaciones estimadas" value={d.repairs} onChange={(v) => setDeal({ repairs: v })} kind={o.repairs?.kind} hint={o.repairs?.source} min={0} />
            <NumberField label="ARV estimado" value={d.arv} onChange={(v) => setDeal({ arv: v })} kind={o.arv?.kind} hint={o.arv?.source} min={0} />
            <NumberField label="Renta mensual proyectada" value={d.monthlyRent} onChange={(v) => setDeal({ monthlyRent: v })} kind={o.monthlyRent?.kind} hint={o.monthlyRent?.source} min={0} />
            <NumberField label="Impuestos al año" value={d.taxesAnnual} onChange={(v) => setDeal({ taxesAnnual: v })} kind={o.taxesAnnual?.kind}
              hint={`${usd(d.taxesAnnual / 12)} al mes${o.taxesAnnual?.source ? ` · ${o.taxesAnnual.source}` : ""}`} min={0} />
            <NumberField label="Aseguranza" value={d.insuranceAnnual} onChange={(v) => setDeal({ insuranceAnnual: v })} kind={o.insuranceAnnual?.kind}
              hint={`Al año · ${usd(d.insuranceAnnual / 12)} al mes${o.insuranceAnnual?.source ? ` · ${o.insuranceAnnual.source}` : ""}`} min={0} />
          </div>
          <FinancingPicker a={a} onOpen={onOpenFinancing} />
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-navy-50 p-4 md:grid-cols-4">
            <Stat label="Cash-on-cash" value={pct(r.rental.cashOnCash)} />
            <Stat label="Cap rate" value={pct(r.rental.capRate)} />
            <Stat label="Capital necesario" value={usd(r.rental.cashInvested)} sub="Préstamo tradicional" />
            <Stat label="Ganancia flip" value={usd(r.flip.netProfit)} tone={tone(r.flip.netProfit)} sub={`ROI ${pct(r.flip.roiOnCash)}`} />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            El indicador es un filtro inicial y no sustituye el análisis financiero completo de cada pestaña.
          </p>
        </Card>
      </div>
    </div>
  );
}

const METHOD_LABEL: Record<MethodId, string> = {
  cash: "Cash",
  hard_money: "Hard money",
  socios: "Socios capitalistas",
  privado: "Prestamista privado",
};

/** Elegir uno de los 4 financiamientos y ver sus números en el resumen. */
function FinancingPicker({ a, onOpen }: { a: Analysis; onOpen?: () => void }) {
  const { state: s, set, r } = a;
  const byId: Record<MethodId, MethodSummary> = {
    cash: r.cash,
    hard_money: r.hardMoney[s.lenderIndex] ?? r.hardMoney[0],
    socios: r.partners,
    privado: r.priv,
  };
  const choice = s.financingChoice;
  const m = byId[choice];
  return (
    <div className="mt-5 border-t border-navy-50 pt-4">
      <div className="mb-2 text-sm font-semibold text-navy-900">¿Cómo lo vas a financiar?</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(Object.keys(METHOD_LABEL) as MethodId[]).map((id) => (
          <button key={id} type="button" onClick={() => set("financingChoice", id)} aria-pressed={choice === id}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${choice === id ? "border-navy-900 bg-navy-900 text-white" : "border-navy-100 bg-white text-navy-900 hover:bg-navy-50"}`}>
            <div className="text-sm font-semibold">{METHOD_LABEL[id]}</div>
            <div className={`text-[11px] ${choice === id ? "text-navy-100/80" : "text-slate-500"}`}>Capital: {usd(byId[id].capitalRequired)}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-navy-100 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-navy-900">Resultado con {m.label}</div>
          <RiskBadge risk={m.maturityRisk} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Capital que necesitas" value={usd(m.capitalRequired)} />
          <Stat label="Préstamo" value={usd(m.loanAmount)} />
          <Stat label="Pago mensual" value={usd(m.monthlyPayment)} />
          <Stat label="Flujo mensual (renta)" value={usd(m.rental.monthlyCashFlow)} tone={tone(m.rental.monthlyCashFlow)} />
          <Stat label="Cash-on-cash" value={pct(m.rental.cashOnCash)} />
          <Stat label="DSCR" value={ratio(m.rental.dscr)} />
          <Stat label="Ganancia si vendes" value={usd(m.flip.netProfit)} tone={tone(m.flip.netProfit)} sub={`ROI ${pct(m.flip.roiOnCash)}`} />
          {m.balloon > 0 && <Stat label="Saldo al vencimiento" value={usd(m.balloon)} />}
        </div>
        {m.notes[0] && <p className="mt-3 text-xs text-slate-500">{m.notes[0]}</p>}
        {onOpen && (
          <button type="button" onClick={() => { set("financingSub", choice); onOpen(); }}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-100">
            Ajustar los términos de {METHOD_LABEL[choice]} <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";
import clsx from "clsx";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sparkles } from "lucide-react";
import type { InsightLevel } from "@/lib/engine/analyst";
import { pct, usd } from "@/lib/format";
import { Card } from "../ui";
import type { Analysis } from "../useAnalysis";

const ICON: Record<InsightLevel, { icon: typeof Info; cls: string }> = {
  positivo: { icon: CheckCircle2, cls: "text-money-600 bg-money-100" },
  alerta: { icon: AlertTriangle, cls: "text-warn-600 bg-warn-100" },
  riesgo: { icon: ShieldAlert, cls: "text-risk-600 bg-risk-100" },
  info: { icon: Info, cls: "text-navy-700 bg-navy-100" },
};

export function AnalystTab({ a }: { a: Analysis }) {
  const { r, state: s } = a;
  const d = s.deal;
  const answers: [string, string][] = [
    ["¿Cuánto vale esta propiedad?", a.lookup?.property.estimatedValue.value ? `${usd(a.lookup.property.estimatedValue.value)} (estimación automática)` : "Sin valor estimado disponible"],
    ["¿Cuánto debería ofrecer?", `Regla 1.5%: ${usd(Math.max(0, r.rent.maxPurchasePrice))} · Regla flip: ${usd(r.flipR.maxOffer)} · Flip ${pct(s.settings.flipTargetProfitPct, 0)}: ${usd(r.flipMaxOffer)}`],
    ["¿Cuánto costará remodelarla?", `${usd(d.repairs)} + contingencia ${usd(d.repairs * s.flip.contingencyPct)}`],
    ["¿En cuánto se rentan casas similares?", r.rentEst.average > 0 ? `${usd(r.rentEst.conservative)} – ${usd(r.rentEst.optimistic)} por unidad` : "Sin comparables de renta"],
    ["¿En cuánto se han vendido casas similares?", r.arv.central > 0 ? `${usd(r.arv.conservative)} – ${usd(r.arv.optimistic)} (ajustado)` : "Sin ventas cerradas verificadas"],
    ["¿Cumple la regla del 1.5%?", `${pct(r.rent.ratio, 2)} — ${r.rent.verdict === "cumple" ? "Sí" : r.rent.verdict === "revision" ? "Casi, requiere revisión" : "No"}`],
    ["¿Cumple la regla del 50%?", r.flipR.verdict === "cumple" ? "Sí" : "No"],
    ["¿Cuánto dinero necesito para comprar?", `Tradicional ${usd(r.rental.cashInvested)} · Cash ${usd(r.cash.capitalRequired)} · Hard money ${usd(r.methods[1].capitalRequired)}`],
    ["¿Qué financiamiento me conviene?", r.recommendation.row ? `${r.recommendation.row.label} (según tu objetivo)` : "—"],
    ["¿Cuánto será mi flujo neto mensual?", usd(r.rental.monthlyCashFlow)],
    ["¿Cuánto puedo ganar con un flip?", `${usd(r.flip.netProfit)} (ROI ${pct(r.flip.roiOnCash)})`],
    ["¿Cuánto capital recuperaría con BRRRR?", usd(r.brrrr.capitalRecovered)],
    ["¿Cuánto dinero se queda en la inversión?", usd(r.brrrr.capitalRemaining)],
    ["¿Cómo repito la operación?", r.expansion[1].months !== null ? `5 propiedades en ~${Math.round(r.expansion[1].months / 12 * 10) / 10} años con estos supuestos (ver BRRRR)` : "Con estos supuestos el capital no se recicla lo suficiente"],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3" title={
        <span className="flex items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-gold-500 bg-navy-50">
            <Image src="/brand/hermanitos-cruz.webp" alt="Hermanitos Cruz" fill sizes="48px" className="scale-125 object-cover object-top" />
          </span>
          <span className="flex items-center gap-2"><Sparkles size={16} className="text-gold-500" /> Analista — Hermanitos Cruz</span>
        </span>}
        subtitle="Modo explicativo determinista: interpreta los números del motor financiero. Aún no hay un modelo de IA conectado.">
        <ul className="space-y-3">
          {r.insights.map((i, k) => {
            const I = ICON[i.level];
            return (
              <li key={k} className="flex gap-3">
                <span className={clsx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", I.cls)}><I.icon size={15} /></span>
                <div>
                  <div className="text-sm font-semibold">{i.title}</div>
                  <p className="text-sm leading-relaxed text-slate-600">{i.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="lg:col-span-2" title="Respuestas rápidas">
        <dl className="divide-y divide-navy-50">
          {answers.map(([q, v]) => (
            <div key={q} className="py-2">
              <dt className="text-xs font-medium text-slate-500">{q}</dt>
              <dd className="text-sm font-semibold text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

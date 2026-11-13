"use client";
import { Card, Grid, Note, NumberField, Select } from "../ui";
import type { Analysis } from "../useAnalysis";

export function SettingsTab({ a }: { a: Analysis }) {
  const { state: s, set } = a;
  const st = s.settings;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Criterios de inversión" subtitle="Tus reglas personales">
        <Grid cols={2}>
          <NumberField label="Regla de renta mensual" unit="pct" value={st.rentRulePct} onChange={(v) => set("settings", { ...st, rentRulePct: v })} hint="Metodología Hermanitos Cruz: 1.5%" />
          <NumberField label="Regla rápida de flip" unit="pct" value={st.flipRulePct} onChange={(v) => set("settings", { ...st, flipRulePct: v })} hint="Oferta = ARV × % - reparaciones" />
          <NumberField label="Ganancia objetivo de flip" unit="pct" value={st.flipTargetProfitPct} onChange={(v) => set("settings", { ...st, flipTargetProfitPct: v })} hint="Sobre el capital total invertido" />
          <Select label="Base del cap rate" value={st.capRateBase} onChange={(v) => set("settings", { ...st, capRateBase: v })}
            options={[{ value: "costo_total", label: "Costo total (compra + reparaciones + cierre)" }, { value: "precio", label: "Precio de compra" }, { value: "arv", label: "Valor (ARV)" }]} />
        </Grid>
      </Card>
      <Card title="Fuentes de datos">
        <div className="space-y-2 text-sm text-slate-600">
          <p>Modo actual: <strong>{a.lookup ? a.lookup.provider : "Captura manual"}</strong>.</p>
          <p>Para usar datos reales, agrega <code className="rounded bg-navy-50 px-1">RENTCAST_API_KEY</code> en el archivo <code className="rounded bg-navy-50 px-1">.env.local</code> del servidor y reinicia la app. La clave nunca se envía al navegador.</p>
          <Note tone="warn">Cada búsqueda con RentCast consume créditos de tu plan. Los comparables de RentCast provienen de anuncios: verifica las ventas cerradas antes de usarlas para el ARV.</Note>
        </div>
      </Card>
    </div>
  );
}

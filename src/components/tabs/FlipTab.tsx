"use client";
import { pct, usd } from "@/lib/format";
import { Card, Grid, Note, NumberField, Row, Select, Stat, tone, VerdictBadge } from "../ui";
import type { Analysis } from "../useAnalysis";

export function FlipTab({ a }: { a: Analysis }) {
  const { state: s, setDeal, set, r } = a;
  const d = s.deal;
  const f = r.flip;
  const c = f.costs;
  const setFlip = (patch: Partial<typeof s.flip>) => set("flip", { ...s.flip, ...patch });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <Card title={<span className="flex items-center gap-2">Regla del {pct(s.settings.flipRulePct, 0)} <VerdictBadge v={r.flipR.verdict} /></span>}
          subtitle="Filtro rápido: no es la ganancia real del proyecto">
          <Row label="ARV" value={usd(d.arv)} />
          <Row label={`${pct(s.settings.flipRulePct, 0)} del ARV`} value={usd(r.flipR.arvShare)} />
          <Row label="Menos reparaciones" value={usd(-d.repairs)} />
          <Row strong label="Oferta máxima según la regla" value={usd(r.flipR.maxOffer)} />
          <Row label="Tu precio de compra" value={usd(d.purchasePrice)} />
          <Row label={r.flipR.overBy > 0 ? "Pagas de más" : "Margen bajo la regla"} value={usd(Math.abs(r.flipR.overBy))} tone={r.flipR.overBy > 0 ? "risk" : "money"} />
        </Card>
        <Card title="Supuestos del flip">
          <Grid cols={2}>
            <NumberField label="ARV (precio de venta)" value={d.arv} onChange={(v) => setDeal({ arv: v })} kind={s.origins.arv?.kind} />
            <NumberField label="Duración" unit="meses" value={s.flip.months} onChange={(v) => setFlip({ months: Math.max(1, v) })} />
            <NumberField label="Contingencia" unit="pct" value={s.flip.contingencyPct} onChange={(v) => setFlip({ contingencyPct: v })} hint="% de reparaciones" />
            <NumberField label="Servicios / mes" value={s.flip.monthlyUtilities} onChange={(v) => setFlip({ monthlyUtilities: v })} />
            <NumberField label="Comisión de venta" unit="pct" value={s.flip.saleCommissionPct} onChange={(v) => setFlip({ saleCommissionPct: v })} />
            <NumberField label="Cierre de venta" unit="pct" value={s.flip.saleClosingPct} onChange={(v) => setFlip({ saleClosingPct: v })} />
          </Grid>
          <div className="mt-3">
            <Select label="Financiamiento del flip" value={s.flipUsesHardMoney ? "hm" : "cash"} onChange={(v) => set("flipUsesHardMoney", v === "hm")}
              options={[{ value: "hm", label: `Hard money (${r.lender.lenderName})` }, { value: "cash", label: "Cash" }]} />
            {s.flipUsesHardMoney && (
              <p className="mt-2 text-xs text-slate-500">
                Préstamo {usd(r.hmLoan.loanAmount)} al {pct(r.lender.rate)} + {pct(r.lender.pointsPct)} puntos. Ajusta los términos en Financiamiento → Hard money.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card title="Ganancia real del proyecto">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat big label="Ganancia neta" value={usd(f.netProfit)} tone={tone(f.netProfit)} />
            <Stat big label="ROI sobre tu capital" value={pct(f.roiOnCash)} sub={`Anualizado ${pct(f.annualizedRoi)}`} />
            <Stat big label="Margen sobre costo total" value={pct(f.roiOnTotalCost)} />
            <Stat big label="Capital propio" value={usd(f.cashInvested)} sub={`${f.months} meses`} />
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold">Presupuesto</h4>
              <Row label="Precio de compra" value={usd(c.purchase)} />
              <Row label="Costos de compra" value={usd(c.buyClosing)} />
              <Row label="Reparaciones" value={usd(c.repairs)} />
              <Row label="Contingencia" value={usd(c.contingency)} />
              <Row label="Puntos y comisiones del préstamo" value={usd(c.loanPoints + c.loanFees)} />
              <Row label="Intereses" value={usd(c.interest)} />
              <Row label="Impuestos (periodo)" value={usd(c.taxes)} />
              <Row label="Seguro (periodo)" value={usd(c.insurance)} />
              <Row label="Servicios" value={usd(c.utilities)} />
              <Row label="Comisiones de venta" value={usd(c.saleCommission)} />
              <Row label="Closing costs de venta" value={usd(c.saleClosing)} />
              <Row strong label="Costo total del proyecto" value={usd(f.totalCost)} />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold">Resumen</h4>
              <Row label="Precio de venta (ARV)" value={usd(f.salePrice)} />
              <Row label="Costo total" value={usd(-f.totalCost)} />
              <Row strong label="Ganancia neta" value={usd(f.netProfit)} tone={tone(f.netProfit)} />
              <Row label="Holding costs" value={usd(f.holdingCosts)} />
              <Row label="Costos financieros" value={usd(f.financingCosts)} />

              <h4 className="mt-5 mb-1 text-sm font-semibold">Calculadora de oferta máxima</h4>
              <NumberField label="Ganancia objetivo sobre capital total invertido" unit="pct" value={s.settings.flipTargetProfitPct}
                onChange={(v) => set("settings", { ...s.settings, flipTargetProfitPct: v })} />
              <div className="mt-3 rounded-xl bg-navy-900 p-4 text-white">
                <div className="text-xs uppercase tracking-wide text-navy-100/70">Oferta máxima para {pct(s.settings.flipTargetProfitPct, 0)}</div>
                <div className="mt-1 text-3xl font-bold text-gold-400">{r.flipMaxOffer === null ? "—" : usd(r.flipMaxOffer)}</div>
                <div className="mt-1 text-xs text-navy-100/70">
                  Incluye todos los costos del presupuesto. Capital total invertido = costo total del proyecto (propio + prestado).
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3"><Note>La regla del {pct(s.settings.flipRulePct, 0)} y el presupuesto completo se calculan por separado a propósito. Una propiedad puede pasar la regla y aun así dejar poca ganancia real.</Note></div>
        </Card>
      </div>
    </div>
  );
}

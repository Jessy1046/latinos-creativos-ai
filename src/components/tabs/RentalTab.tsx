"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, ratio, usd } from "@/lib/format";
import { Card, Grid, Note, NumberField, Row, Select, Stat, Table, tone, VerdictBadge } from "../ui";
import type { Analysis } from "../useAnalysis";

export function RentalTab({ a }: { a: Analysis }) {
  const { state: s, setDeal, set, r } = a;
  const d = s.deal;
  const o = s.origins;
  const rr = r.rental;
  const allIn = rr.totalProjectCost + r.conv.points;
  const reservePct = d.managementPct + d.maintenancePct + d.capexPct + d.vacancyPct;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <Card title="Financiamiento tradicional">
          <Grid cols={2}>
            <NumberField label="Enganche" unit="pct" value={s.loan.downPaymentPct} onChange={(v) => set("loan", { ...s.loan, downPaymentPct: v })} />
            <NumberField label="Interés anual" unit="pct" value={s.loan.rate} onChange={(v) => set("loan", { ...s.loan, rate: v })} />
            <NumberField label="Plazo" unit="años" value={s.loan.termYears} onChange={(v) => set("loan", { ...s.loan, termYears: v })} />
            <NumberField label="Puntos" unit="pct" value={s.loan.pointsPct} onChange={(v) => set("loan", { ...s.loan, pointsPct: v })} />
            <NumberField label="Costos de cierre" unit="pct" value={d.buyClosingPct} onChange={(v) => setDeal({ buyClosingPct: v })} hint="% del precio de compra" />
            <Select label="Tipo de pago" value={s.loan.type} onChange={(v) => set("loan", { ...s.loan, type: v })}
              options={[{ value: "amortizado", label: "Amortizado" }, { value: "solo_interes", label: "Solo interés" }]} />
          </Grid>
          <div className="mt-3 rounded-lg bg-navy-50 p-3">
            <Row label="Préstamo" value={usd(rr.debt.loanAmount)} />
            <Row label="Pago mensual (P+I)" value={usd(rr.monthlyDebtService, 2)} />
          </div>
        </Card>
        <Card title="Ingresos">
          <Grid cols={2}>
            <NumberField label="Renta mensual total" value={d.monthlyRent} onChange={(v) => setDeal({ monthlyRent: v })} kind={o.monthlyRent?.kind} />
            <NumberField label="Unidades" unit="num" value={d.units} onChange={(v) => setDeal({ units: Math.max(1, Math.round(v)) })} />
            <NumberField label="Otros ingresos / mes" value={d.otherMonthlyIncome} onChange={(v) => setDeal({ otherMonthlyIncome: v })} hint="Lavandería, parking, etc." />
            <NumberField label="Vacancia" unit="pct" value={d.vacancyPct} onChange={(v) => setDeal({ vacancyPct: v })} />
          </Grid>
          {d.units > 1 && <p className="mt-2 text-xs text-slate-500">Renta por unidad: {usd(d.monthlyRent / d.units)}</p>}
        </Card>
        <Card title="Gastos operativos" subtitle="Administración, mantenimiento y CapEx como % del ingreso efectivo">
          <Grid cols={2}>
            <NumberField label="Impuestos / año" value={d.taxesAnnual} onChange={(v) => setDeal({ taxesAnnual: v })} kind={o.taxesAnnual?.kind} hint={o.taxesAnnual?.source} />
            <NumberField label="Seguro / año" value={d.insuranceAnnual} onChange={(v) => setDeal({ insuranceAnnual: v })} kind={o.insuranceAnnual?.kind} hint={o.insuranceAnnual?.source} />
            <NumberField label="Administración" unit="pct" value={d.managementPct} onChange={(v) => setDeal({ managementPct: v })} />
            <NumberField label="Mantenimiento" unit="pct" value={d.maintenancePct} onChange={(v) => setDeal({ maintenancePct: v })} />
            <NumberField label="Reserva CapEx" unit="pct" value={d.capexPct} onChange={(v) => setDeal({ capexPct: v })} hint="Única línea de CapEx (no se duplica)" />
            <NumberField label="HOA / mes" value={d.hoaMonthly} onChange={(v) => setDeal({ hoaMonthly: v })} />
            <NumberField label="Servicios del dueño / mes" value={d.utilitiesMonthly} onChange={(v) => setDeal({ utilitiesMonthly: v })} />
            <NumberField label="Otros gastos / mes" value={d.otherExpensesMonthly} onChange={(v) => setDeal({ otherExpensesMonthly: v })} />
          </Grid>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-lg border border-navy-100 px-2.5 py-1 text-xs hover:bg-navy-50"
              onClick={() => setDeal({ vacancyPct: 0.05, managementPct: 0.08, maintenancePct: 0.07, capexPct: 0.07 })}>
              Escenario 27% de rentas a gastos y reservas
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Vacancia + administración + mantenimiento + CapEx = {pct(reservePct)} de la renta. No es apropiado para todas las propiedades.
          </p>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card title="Resultados de renta">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat big label="Flujo mensual" value={usd(rr.monthlyCashFlow)} tone={tone(rr.monthlyCashFlow)} />
            <Stat big label="Cash-on-cash" value={pct(rr.cashOnCash)} />
            <Stat big label="Cap rate" value={pct(rr.capRate)} sub={`Base: ${rr.capRateBase === "precio" ? "precio" : rr.capRateBase === "arv" ? "ARV" : "costo total"} ${usd(rr.capRateBaseValue)}`} />
            <Stat big label="DSCR" value={ratio(rr.dscr)} tone={rr.dscr !== null && rr.dscr < 1.2 ? "risk" : "money"} />
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold">Estado de resultados (anual)</h4>
              <Row label="Ingreso bruto potencial" value={usd(rr.grossPotentialIncome)} />
              <Row label="Menos vacancia" value={usd(-rr.vacancyLoss)} />
              <Row strong label="Ingreso operativo efectivo" value={usd(rr.effectiveGrossIncome)} />
              <Row indent label="Impuestos" value={usd(-rr.expenses.taxes)} />
              <Row indent label="Seguro" value={usd(-rr.expenses.insurance)} />
              <Row indent label="Administración" value={usd(-rr.expenses.management)} />
              <Row indent label="Mantenimiento" value={usd(-rr.expenses.maintenance)} />
              <Row indent label="Reserva CapEx" value={usd(-rr.expenses.capex)} />
              <Row indent label="HOA + servicios + otros" value={usd(-(rr.expenses.hoa + rr.expenses.utilities + rr.expenses.other))} />
              <Row strong label="NOI" value={usd(rr.noi)} />
              <Row label="Servicio de deuda" value={usd(-rr.annualDebtService)} />
              <Row strong label="Flujo de efectivo anual" value={usd(rr.annualCashFlow)} tone={tone(rr.annualCashFlow)} />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold">Capital y equidad</h4>
              <Row label="Enganche" value={usd(r.conv.downPayment)} />
              <Row label="Reparaciones" value={usd(d.repairs)} />
              <Row label="Costos de cierre" value={usd(r.conv.closing)} />
              <Row label="Puntos del préstamo" value={usd(r.conv.points)} />
              <Row strong label="Capital propio invertido" value={usd(rr.cashInvested)} />
              <Row label="Equidad estimada (ARV - deuda)" value={usd(rr.equity)} />
              <Row label="Retorno total año 1" value={pct(rr.totalReturnYear1)} />
              <Row label="Gastos / ingreso bruto" value={pct(rr.expenseRatio)} />

              <h4 className="mt-4 mb-1 flex items-center gap-2 text-sm font-semibold">
                Regla del {pct(s.settings.rentRulePct)} <VerdictBadge v={r.rent.verdict} />
              </h4>
              <Row label="Inversión (compra + reparaciones)" value={usd(r.rent.investment)} />
              <Row label="Porcentaje obtenido" value={pct(r.rent.ratio, 2)} />
              <Row label="Renta necesaria" value={usd(r.rent.requiredRent)} />
              <Row label="Precio máximo de compra" value={usd(Math.max(0, r.rent.maxPurchasePrice))} />
              <Row label="Diferencia vs. objetivo" value={r.rent.gap === null ? "—" : `${(r.rent.gap * 100).toFixed(2)} pts`} />
              <Row label="Inversión total con cierre y financiamiento" value={usd(allIn)} />
              <p className="mt-1 text-[11px] text-slate-400">La regla es un filtro inicial, no una garantía de rentabilidad.</p>
            </div>
          </div>
        </Card>

        <Card title="Proyección" subtitle="La apreciación es un supuesto, no una predicción">
          <Grid cols={3}>
            <NumberField label="Crecimiento de rentas" unit="pct" value={s.projection.rentGrowth} onChange={(v) => set("projection", { ...s.projection, rentGrowth: v })} />
            <NumberField label="Inflación de gastos" unit="pct" value={s.projection.expenseInflation} onChange={(v) => set("projection", { ...s.projection, expenseInflation: v })} />
            <NumberField label="Apreciación" unit="pct" value={s.projection.appreciation} onChange={(v) => set("projection", { ...s.projection, appreciation: v })} />
          </Grid>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={r.projection} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => usd(Number(v))} labelFormatter={(l) => `Año ${l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="equity" name="Patrimonio" stroke="#1f9d55" fill="#dcf5e6" />
                <Area type="monotone" dataKey="loanBalance" name="Deuda pendiente" stroke="#13294b" fill="#e6ecf5" />
                <Area type="monotone" dataKey="cumulativeCashFlow" name="Flujo acumulado" stroke="#c9a227" fill="#f8f0d4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Table head={["Año", "Renta bruta", "NOI", "Flujo anual", "Flujo acumulado", "Valor", "Deuda", "Patrimonio"]}>
            {[1, 5, 10, 30].map((y) => {
              const p = r.projection[y - 1];
              return (
                <tr key={y}>
                  <td className="px-2 py-2 font-medium">{y}</td>
                  <td className="px-2 py-2">{usd(p.grossRent)}</td>
                  <td className="px-2 py-2">{usd(p.noi)}</td>
                  <td className="px-2 py-2">{usd(p.cashFlow)}</td>
                  <td className="px-2 py-2">{usd(p.cumulativeCashFlow)}</td>
                  <td className="px-2 py-2">{usd(p.propertyValue)}</td>
                  <td className="px-2 py-2">{usd(p.loanBalance)}</td>
                  <td className="px-2 py-2 font-semibold text-money-600">{usd(p.equity)}</td>
                </tr>
              );
            })}
          </Table>
          <div className="mt-3"><Note>Flujos antes de impuestos sobre la renta. El valor inicial es el ARV (o compra + reparaciones si no hay ARV).</Note></div>
        </Card>
      </div>
    </div>
  );
}

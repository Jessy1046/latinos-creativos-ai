"use client";
import clsx from "clsx";
import type { RecoveryStatus } from "@/lib/engine/brrrr";
import { pct, ratio, usd, years } from "@/lib/format";
import { Card, Grid, Note, NumberField, Row, Select, Stat, Table, tone } from "../ui";
import type { Analysis } from "../useAnalysis";
import { LoanCalculator } from "../LoanCalculator";

const STATUS: Record<RecoveryStatus, { label: string; cls: string }> = {
  completa: { label: "Recuperación completa", cls: "bg-money-500 text-white" },
  parcial: { label: "Recuperación parcial", cls: "bg-gold-500 text-navy-950" },
  sin_recuperacion: { label: "Sin recuperación", cls: "bg-slate-500 text-white" },
  requiere_capital: { label: "Requiere capital adicional", cls: "bg-risk-600 text-white" },
};

function Stage({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card title={<span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-navy-900 text-xs text-gold-400">{n}</span>{title}</span>}>
      {children}
    </Card>
  );
}

export function BrrrrTab({ a }: { a: Analysis }) {
  const { state: s, set, setDeal, r } = a;
  const b = r.brrrr;
  const bi = s.brrrr;
  const upd = (patch: Partial<typeof bi>) => set("brrrr", { ...bi, ...patch });
  const e = s.expansion;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-navy-900 p-5 text-white">
        <span className={clsx("rounded-full px-4 py-1.5 text-sm font-semibold", STATUS[b.status].cls)}>{STATUS[b.status].label}</span>
        <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
          <div><div className="text-xs text-navy-100/70">Capital invertido</div><div className="text-xl font-bold">{usd(b.cashInvested)}</div></div>
          <div><div className="text-xs text-navy-100/70">Capital recuperado</div><div className="text-xl font-bold text-money-500">{usd(b.capitalRecovered)}</div></div>
          <div><div className="text-xs text-navy-100/70">Se queda en la inversión</div><div className="text-xl font-bold text-gold-400">{usd(b.capitalRemaining)}</div></div>
          <div><div className="text-xs text-navy-100/70">Flujo después de refinanciar</div><div className="text-xl font-bold">{usd(b.postRefi.monthlyCashFlow)}/mes</div></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Stage n={1} title="Buy — Comprar">
          <Select label="Financiamiento inicial" value={s.brrrrUsesHardMoney ? "hm" : "cash"} onChange={(v) => set("brrrrUsesHardMoney", v === "hm")}
            options={[{ value: "hm", label: `Hard money (${r.lender.lenderName})` }, { value: "cash", label: "Cash" }]} />
          <div className="mt-3">
            <Row label="Precio" value={usd(b.buy.price)} />
            <Row label="Costos de compra" value={usd(b.buy.closing)} />
            <Row label="Préstamo inicial" value={usd(b.buy.loanAmount)} />
            <Row label="Puntos y comisiones" value={usd(b.buy.points + b.buy.fees)} />
          </div>
        </Stage>

        <Stage n={2} title="Rehab — Remodelar">
          <Grid cols={3}>
            <NumberField label="Presupuesto" value={s.deal.repairs} onChange={(v) => setDeal({ repairs: v })} />
            <NumberField label="Contingencia" unit="pct" value={bi.contingencyPct} onChange={(v) => upd({ contingencyPct: v })} />
            <NumberField label="Tiempo" unit="meses" value={bi.rehabMonths} onChange={(v) => upd({ rehabMonths: Math.max(0, v) })} />
          </Grid>
          <div className="mt-3">
            <Row label="Remodelación + contingencia" value={usd(b.rehab.total)} />
            <Row label="Holding (impuestos, seguro, servicios, interés)" value={usd(b.rehab.holdingCosts)} />
            <Row indent label="Interés durante remodelación y seasoning" value={usd(b.rehab.interestDuringRehab)} />
            <Row strong label="Inversión total" value={usd(b.totalInvestment)} />
            <Row strong label="Capital propio necesario" value={usd(b.cashInvested)} />
          </div>
        </Stage>

        <Stage n={3} title="Rent — Rentar">
          <Grid cols={2}>
            <NumberField label="Renta proyectada / mes" value={s.deal.monthlyRent} onChange={(v) => setDeal({ monthlyRent: v })} />
            <NumberField label="Seasoning antes de refinanciar" unit="meses" value={bi.seasoningMonths} onChange={(v) => upd({ seasoningMonths: Math.max(0, v) })} />
          </Grid>
          <div className="mt-3">
            <Row label="Gastos operativos anuales" value={usd(b.rent.operatingExpenses)} />
            <Row strong label="NOI anual" value={usd(b.rent.noi)} />
            <Row label="Flujo neto después del refinanciamiento" value={usd(b.postRefi.monthlyCashFlow)} tone={tone(b.postRefi.monthlyCashFlow)} />
          </div>
        </Stage>

        <Stage n={4} title="Refinance — Refinanciar">
          <Grid cols={3}>
            <NumberField label="Tasación" value={bi.appraisal || s.deal.arv} onChange={(v) => upd({ appraisal: v })} hint={bi.appraisal ? "Tu dato" : "Por defecto = ARV"} />
            <NumberField label="LTV permitido" unit="pct" value={bi.refiLtv} onChange={(v) => upd({ refiLtv: v })} />
            <NumberField label="Nuevo interés" unit="pct" value={bi.refiRate} onChange={(v) => upd({ refiRate: v })} />
            <NumberField label="Nuevo plazo" unit="años" value={bi.refiTermYears} onChange={(v) => upd({ refiTermYears: v })} />
            <NumberField label="Costos de refinanciar" unit="pct" value={bi.refiClosingPct} onChange={(v) => upd({ refiClosingPct: v })} />
            <NumberField label="Reservas exigidas" value={bi.reservesRequired} onChange={(v) => upd({ reservesRequired: v })} />
            <NumberField label="DSCR mínimo" unit="x" value={bi.minDscr} onChange={(v) => upd({ minDscr: v })} />
            <NumberField label="Límite del prestamista" value={bi.lenderMaxLoan} onChange={(v) => upd({ lenderMaxLoan: v })} hint="0 = sin límite" />
            <Select label="Base del DSCR" value={bi.dscrBasis} onChange={(v) => upd({ dscrBasis: v })}
              options={[{ value: "renta", label: "Renta total ÷ PITIA" }, { value: "noi", label: "NOI ÷ deuda" }]} />
          </Grid>
          <div className="mt-3">
            <Row label={`Préstamo por LTV (${pct(bi.refiLtv, 0)} × tasación)`} value={usd(b.refi.ltvLoan)} />
            {bi.dscrBasis === "renta" && (
              <>
                <Row label="Renta mensual total" value={usd(s.deal.monthlyRent)} />
                <Row indent label={`Pago máximo permitido (renta ÷ ${ratio(bi.minDscr)})`} value={usd(s.deal.monthlyRent / bi.minDscr)} />
                <Row indent label="Menos impuestos, seguro y HOA" value={usd(-b.refi.monthlyTia)} />
                <Row indent label="Queda para principal + interés" value={usd(Math.max(0, s.deal.monthlyRent / bi.minDscr - b.refi.monthlyTia))} />
              </>
            )}
            <Row label={`Préstamo máximo por DSCR ${ratio(bi.minDscr)}`} value={usd(b.refi.dscrLoan)} />
            <Row strong label={`Nuevo préstamo (limitado por ${b.refi.limitedBy})`} value={usd(b.refi.newLoan)} />
            <Row label="Menos saldo del préstamo existente" value={usd(-b.refi.existingBalance)} />
            <Row label="Menos costos de refinanciar" value={usd(-b.refi.closingCosts)} />
            <Row label="Menos reservas retenidas" value={usd(-b.refi.reserves)} />
            <Row strong label="Cash-out neto" value={usd(b.refi.cashOut)} tone={tone(b.refi.cashOut)} />
            {bi.dscrBasis === "renta" && <Row label="Pago mensual total (PITIA)" value={usd(b.refi.monthlyPitia, 2)} />}
            <Row strong label={`DSCR después del refinanciamiento (${bi.dscrBasis === "renta" ? "renta ÷ PITIA" : "NOI ÷ deuda"})`} value={ratio(b.refi.lenderDscr)}
              tone={b.refi.lenderDscr !== null && b.refi.lenderDscr < bi.minDscr - 0.001 ? "risk" : "money"} />
            {bi.dscrBasis === "renta" && <Row label="DSCR con NOI (referencia)" value={ratio(b.postRefi.dscr)} />}
          </div>
          <div className="mt-4 rounded-xl bg-navy-900 p-4 text-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-gold-400">¿Cuánto recuperas al refinanciar?</div>
            {b.additionalCapitalNeeded > 0 ? (
              <>
                <div className="mt-2 text-2xl font-bold text-risk-100">Necesitas poner {usd(b.additionalCapitalNeeded)} más</div>
                <p className="mt-1 text-xs text-navy-100/80">
                  El nuevo préstamo no alcanza para pagar el préstamo anterior, los costos y las reservas. No recuperas nada de tus {usd(b.cashInvested)}.
                </p>
              </>
            ) : (
              <div className="mt-2 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-navy-100/70">Recuperas de tu capital</div>
                  <div className="text-2xl font-bold text-money-500">{usd(b.capitalRecovered)}</div>
                  <div className="text-xs text-navy-100/70">
                    de {usd(b.cashInvested)} invertidos ({b.cashInvested > 0 ? Math.round((b.capitalRecovered / b.cashInvested) * 100) : 0}%)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-navy-100/70">Dinero extra (te sobra)</div>
                  <div className={`text-2xl font-bold ${b.excessCash > 0 ? "text-gold-400" : "text-white/60"}`}>{usd(b.excessCash)}</div>
                  <div className="text-xs text-navy-100/70">{b.excessCash > 0 ? "Por encima de lo que pusiste" : "No queda dinero extra"}</div>
                </div>
                <div>
                  <div className="text-xs text-navy-100/70">Se queda dentro de la propiedad</div>
                  <div className="text-2xl font-bold">{usd(b.capitalRemaining)}</div>
                  <div className="text-xs text-navy-100/70">{b.capitalRemaining <= 0 ? "Recuperaste todo tu dinero" : "Capital que no regresa"}</div>
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-navy-100/60">Cash-out neto {usd(b.refi.cashOut)} = nuevo préstamo - saldo anterior - costos - reservas. Supone que el refinanciamiento se aprueba.</p>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Con “Renta total ÷ PITIA” el DSCR se calcula como la mayoría de los préstamos DSCR residenciales: renta mensual
            dividida entre principal + interés + impuestos + seguro + HOA. Confirma el método con tu prestamista.
          </p>
        </Stage>
      </div>

      <LoanCalculator defaults={{
        loanAmount: Math.round(b.refi.newLoan), rate: bi.refiRate, termYears: bi.refiTermYears,
        taxesAnnual: s.deal.taxesAnnual, insuranceAnnual: s.deal.insuranceAnnual, hoaMonthly: s.deal.hoaMonthly, monthlyRent: s.deal.monthlyRent,
      }} />

      <Stage n={5} title="Repeat — Repetir">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat big label="Capital disponible para repetir" value={usd(b.repeatCapital)} tone="money" />
          <Stat big label="Excedente sobre tu capital" value={usd(b.excessCash)} />
          <Stat big label="Capital adicional necesario" value={usd(b.additionalCapitalNeeded)} tone={b.additionalCapitalNeeded > 0 ? "risk" : "default"} />
          <Stat big label="Cash-on-cash post-refi" value={b.capitalRemaining <= 0 ? "∞ (sin capital)" : pct(b.postRefi.cashOnCash)} />
        </div>
        <h4 className="mt-6 mb-2 text-sm font-semibold">Simulación de expansión</h4>
        <Grid cols={4}>
          <NumberField label="Capital inicial" value={e.startingCapital} onChange={(v) => set("expansion", { ...e, startingCapital: v })} />
          <NumberField label="Ahorro mensual" value={e.monthlySavings} onChange={(v) => set("expansion", { ...e, monthlySavings: v })} />
          <NumberField label="Proyectos simultáneos" unit="num" value={e.maxConcurrentProjects} onChange={(v) => set("expansion", { ...e, maxConcurrentProjects: Math.max(1, Math.round(v)) })} />
          <Select label="Reinvertir flujo de renta" value={e.reinvestCashFlow ? "si" : "no"} onChange={(v) => set("expansion", { ...e, reinvestCashFlow: v === "si" })}
            options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} />
        </Grid>
        <div className="mt-4">
          <Table head={["Propiedades", "Tiempo estimado", "Capital que queda invertido + reservas", "Flujo mensual total"]}>
            {r.expansion.map((m) => (
              <tr key={m.target}>
                <td className="px-2 py-2 font-semibold">{m.target}</td>
                <td className="px-2 py-2">{m.months === null ? <span className="text-risk-600">No alcanzable en 50 años</span> : years(m.months / 12)}</td>
                <td className="px-2 py-2">{usd(m.capitalTiedUp)}</td>
                <td className="px-2 py-2">{usd(m.monthlyCashFlow)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="mt-3"><Note tone="warn">
          Simulación simplificada: supone que cada propiedad repite estos mismos números y que cada refinanciamiento se aprueba. En la realidad cambian precios,
          tasas, tasaciones y requisitos de los prestamistas (incluyendo límites de cantidad de préstamos por persona).
        </Note></div>
      </Stage>
    </div>
  );
}

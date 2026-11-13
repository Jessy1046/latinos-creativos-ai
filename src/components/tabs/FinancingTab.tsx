"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DEFAULT_HARD_MONEY, HardMoneyInputs, MethodSummary, Partner, PartnersRefiInputs } from "@/lib/engine/financing";
import { pct, ratio, usd, years } from "@/lib/format";
import { Card, Grid, Note, NumberField, RiskBadge, Row, Select, Stat, Table, Tabs, tone } from "../ui";
import { Analysis, withPartnerCapital } from "../useAnalysis";

type Sub = "cash" | "hard_money" | "socios" | "privado" | "comparar";

function MethodResults({ m }: { m: MethodSummary }) {
  return (
    <Card title="Resultados" actions={<RiskBadge risk={m.maturityRisk} />}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat big label="Capital requerido" value={usd(m.capitalRequired)} />
        <Stat big label="Flujo mensual (renta)" value={usd(m.rental.monthlyCashFlow)} tone={tone(m.rental.monthlyCashFlow)} />
        <Stat big label="Cash-on-cash" value={pct(m.rental.cashOnCash)} />
        <Stat big label="Ganancia si vendes" value={usd(m.flip.netProfit)} tone={tone(m.flip.netProfit)} sub={`ROI ${pct(m.flip.roiOnCash)}`} />
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <Row label="Préstamo" value={usd(m.loanAmount)} />
          <Row label="Pago mensual" value={usd(m.monthlyPayment, 2)} />
          <Row label="Saldo al vencimiento" value={usd(m.balloon)} />
          <Row label="Costos financieros (flip)" value={usd(m.financeCosts)} />
        </div>
        <div>
          <Row label="NOI anual" value={usd(m.rental.noi)} />
          <Row label="Cap rate" value={pct(m.rental.capRate)} />
          <Row label="DSCR" value={ratio(m.rental.dscr)} />
          <Row label="Recuperación del capital" value={years(m.paybackYears)} />
        </div>
      </div>
      {m.notes.length > 0 && <ul className="mt-4 space-y-1.5">{m.notes.map((n) => <li key={n}><Note>{n}</Note></li>)}</ul>}
    </Card>
  );
}

export function FinancingTab({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const [sub, setSubLocal] = useState<Sub>(s.financingSub);
  const setSub = (v: Sub) => { setSubLocal(v); set("financingSub", v); };

  return (
    <div className="space-y-4">
      <Tabs variant="pill" value={sub} onChange={setSub} tabs={[
        { id: "comparar", label: "Comparar financiamientos" },
        { id: "cash", label: "1 · Cash" },
        { id: "hard_money", label: "2 · Hard money" },
        { id: "socios", label: "3 · Socios capitalistas" },
        { id: "privado", label: "4 · Prestamista privado" },
      ]} />
      <Note>Los cuatro métodos usan exactamente los mismos supuestos de precio, reparaciones, ARV, renta y gastos. Cámbialos en el resumen o en la pestaña Renta.</Note>

      {sub === "cash" && <MethodResults m={r.cash} />}
      {sub === "hard_money" && <HardMoney a={a} />}
      {sub === "socios" && <Partners a={a} />}
      {sub === "privado" && <PrivateLender a={a} />}
      {sub === "comparar" && <Compare methods={r.methods} onPickLender={(i) => set("lenderIndex", i)} lenderIndex={s.lenderIndex} lenders={s.lenders} />}
    </div>
  );
}

function HardMoney({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const h = s.lenders[s.lenderIndex];
  const upd = (patch: Partial<HardMoneyInputs>) =>
    set("lenders", s.lenders.map((l, i) => (i === s.lenderIndex ? { ...l, ...patch } : l)));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Prestamista" className="lg:col-span-1" actions={
        <button className="flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1 text-xs hover:bg-navy-50"
          onClick={() => { set("lenders", [...s.lenders, { ...DEFAULT_HARD_MONEY, lenderName: `Prestamista ${String.fromCharCode(65 + s.lenders.length)}` }]); set("lenderIndex", s.lenders.length); }}>
          <Plus size={12} /> Agregar
        </button>}>
        <div className="mb-3 flex flex-wrap gap-1">
          {s.lenders.map((l, i) => (
            <button key={i} onClick={() => set("lenderIndex", i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${i === s.lenderIndex ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700"}`}>
              {l.lenderName}
            </button>
          ))}
        </div>
        <Grid cols={2}>
          <NumberField label="% de compra financiado" unit="pct" value={h.purchasePctFinanced} onChange={(v) => upd({ purchasePctFinanced: v })} />
          <NumberField label="% de reparaciones financiado" unit="pct" value={h.rehabPctFinanced} onChange={(v) => upd({ rehabPctFinanced: v })} />
          <NumberField label="Límite sobre ARV" unit="pct" value={h.maxLtvArv} onChange={(v) => upd({ maxLtvArv: v })} />
          <NumberField label="Límite LTC" unit="pct" value={h.maxLtc} onChange={(v) => upd({ maxLtc: v })} />
          <NumberField label="Interés anual" unit="pct" value={h.rate} onChange={(v) => upd({ rate: v })} />
          <NumberField label="Points" unit="pct" value={h.pointsPct} onChange={(v) => upd({ pointsPct: v })} />
          <NumberField label="Origination fee" value={h.originationFee} onChange={(v) => upd({ originationFee: v })} />
          <NumberField label="Plazo" unit="meses" value={h.termMonths} onChange={(v) => upd({ termMonths: v })} />
          <Select label="Pagos" value={h.type} onChange={(v) => upd({ type: v })}
            options={[{ value: "solo_interes", label: "Solo interés" }, { value: "amortizado", label: "Amortizado" }]} />
          <NumberField label="Reservas requeridas" value={h.reserves} onChange={(v) => upd({ reserves: v })} />
          <NumberField label="LTV de refinanciamiento" unit="pct" value={h.exitRefiLtv} onChange={(v) => upd({ exitRefiLtv: v })} />
          <NumberField label="Meses del proyecto" unit="meses" value={s.flip.months} onChange={(v) => set("flip", { ...s.flip, months: Math.max(1, v) })} />
        </Grid>
        <div className="mt-3 rounded-lg bg-navy-50 p-3">
          <Row label="Solicitado" value={usd(r.hmLoan.requested)} />
          <Row label="Para compra" value={usd(r.hmLoan.purchaseFunds)} />
          <Row label="Fondos de remodelación (draws)" value={usd(r.hmLoan.rehabFunds)} />
          <Row strong label="Dinero del prestamista" value={usd(r.hmLoan.loanAmount)} />
        </div>
      </Card>
      <div className="lg:col-span-2">
        <MethodResults m={r.hardMoney[s.lenderIndex]} />
        <div className="mt-4">
          <Card title="Flujo durante el proyecto">
            <Row label="Pago mensual mientras remodelas (sin renta)" value={usd(-r.hardMoney[s.lenderIndex].monthlyPayment, 2)} tone="risk" />
            <Row label={`Total de pagos en ${s.flip.months} meses`} value={usd(-r.hardMoney[s.lenderIndex].monthlyPayment * s.flip.months)} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Partners({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const p = r.partners;
  const updP = (i: number, patch: Partial<Partner>) =>
    set("partners", { ...s.partners, partners: s.partners.partners.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const split = (op: number) =>
    set("partners", { ...s.partners, partners: s.partners.partners.map((x) => ({ ...x, profitShare: x.role === "operador" ? op : (1 - op) / Math.max(1, s.partners.partners.filter((y) => y.role === "capitalista").length) })) });
  return (
    <div className="space-y-4">
      <Card title="Estructura de la sociedad" subtitle={`Capital requerido (compra cash): ${usd(p.capitalRequired)} · Aportado: ${usd(p.contributed)}`}
        actions={<div className="flex flex-wrap gap-1">
          {[0.5, 0.6, 0.7].map((x) => (
            <button key={x} onClick={() => split(x)} className="rounded-lg bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-100">
              {Math.round(x * 100)}/{Math.round((1 - x) * 100)}
            </button>))}
          <button onClick={() => set("partners", withPartnerCapital(s.partners, p.capitalRequired))} className="rounded-lg bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-100">
            Repartir capital requerido
          </button>
          <button onClick={() => set("partners", { ...s.partners, partners: [...s.partners.partners, { name: `Socio ${s.partners.partners.length + 1}`, role: "capitalista", capital: 0, profitShare: 0 }] })}
            className="flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1 text-xs hover:bg-navy-50"><Plus size={12} /> Socio</button>
        </div>}>
        <div className="space-y-3">
          {s.partners.partners.map((x, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-navy-50 p-3 md:grid-cols-5">
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Nombre</span>
                <input className="w-full rounded-lg border border-navy-100 px-2.5 py-2 text-sm" value={x.name} onChange={(e) => updP(i, { name: e.target.value })} /></label>
              <Select label="Rol" value={x.role} onChange={(v) => updP(i, { role: v })}
                options={[{ value: "operador", label: "Operador" }, { value: "capitalista", label: "Capitalista" }]} />
              <NumberField label="Capital aportado" value={x.capital} onChange={(v) => updP(i, { capital: v })} />
              <NumberField label="% de ganancias" unit="pct" value={x.profitShare} onChange={(v) => updP(i, { profitShare: v })} />
              <button disabled={s.partners.partners.length <= 1} onClick={() => set("partners", { ...s.partners, partners: s.partners.partners.filter((_, j) => j !== i) })}
                className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs text-risk-600 hover:bg-risk-100 disabled:opacity-30"><Trash2 size={14} /> Quitar</button>
            </div>
          ))}
        </div>
        <div className="mt-3 max-w-xs">
          <NumberField label="Retorno preferente anual (capitalistas)" unit="pct" value={s.partners.prefReturn} onChange={(v) => set("partners", { ...s.partners, prefReturn: v })} hint="0% = sin preferente" />
        </div>
        {p.notes.map((n) => <div key={n} className="mt-2"><Note tone={n.startsWith("Faltan") || n.includes("deben sumar") ? "warn" : "info"}>{n}</Note></div>)}
      </Card>
      <Card title="Resultados por socio">
        <Table head={["Socio", "Rol", "Capital", "% ganancias", "Flujo anual", "Cash-on-cash", "Ganancia por venta", "ROI venta"]}>
          {p.partnerResults.map((x, i) => (
            <tr key={i}>
              <td className="px-2 py-2 font-medium">{x.name}</td>
              <td className="px-2 py-2 capitalize">{x.role}</td>
              <td className="px-2 py-2">{usd(x.capital)}</td>
              <td className="px-2 py-2">{pct(x.profitShare, 0)}</td>
              <td className="px-2 py-2">{usd(x.annualCashFlow)}</td>
              <td className="px-2 py-2">{x.cashOnCash === null ? "Sin capital" : pct(x.cashOnCash)}</td>
              <td className="px-2 py-2">{usd(x.flipDistribution)}</td>
              <td className="px-2 py-2">{x.flipRoi === null ? "Sin capital" : pct(x.flipRoi)}</td>
            </tr>
          ))}
        </Table>
        <div className="mt-3"><Note>En una venta, primero se devuelve el capital aportado; después el retorno preferente; el resto se reparte por % de ganancias. Las pérdidas reducen el capital de cada socio en proporción a lo aportado.</Note></div>
      </Card>
      <PartnersRefi a={a} />
    </div>
  );
}

function PartnersRefi({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const f = s.partnersRefi;
  const x = r.partnersRefi;
  const upd = (patch: Partial<PartnersRefiInputs>) => set("partnersRefi", { ...f, ...patch });
  const belowMin = x.lenderDscr !== null && x.lenderDscr < f.minDscr - 0.001;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Refinanciamiento con préstamo DSCR" subtitle="Compran en efectivo, rentan y refinancian para devolver capital a los socios.">
        <Grid cols={2}>
          <NumberField label="Tasación" value={f.appraisal || s.deal.arv} onChange={(v) => upd({ appraisal: v })} hint={f.appraisal ? "Tu dato" : "Por defecto = ARV"} />
          <NumberField label="LTV permitido" unit="pct" value={f.ltv} onChange={(v) => upd({ ltv: v })} />
          <NumberField label="Interés DSCR" unit="pct" value={f.rate} onChange={(v) => upd({ rate: v })} />
          <NumberField label="Plazo" unit="años" value={f.termYears} onChange={(v) => upd({ termYears: Math.max(1, v) })} />
          <NumberField label="DSCR mínimo" unit="x" value={f.minDscr} onChange={(v) => upd({ minDscr: v })} />
          <Select label="Base del DSCR" value={f.dscrBasis} onChange={(v) => upd({ dscrBasis: v })}
            options={[{ value: "renta", label: "Renta ÷ PITIA" }, { value: "noi", label: "NOI ÷ deuda" }]} />
          <NumberField label="Costos de refinanciar" unit="pct" value={f.closingPct} onChange={(v) => upd({ closingPct: v })} />
          <NumberField label="Reservas exigidas" value={f.reserves} onChange={(v) => upd({ reserves: v })} />
          <NumberField label="Límite del prestamista" value={f.lenderMaxLoan} onChange={(v) => upd({ lenderMaxLoan: v })} hint="0 = sin límite" />
          <NumberField label="Seasoning" unit="meses" value={f.seasoningMonths} onChange={(v) => upd({ seasoningMonths: Math.max(0, v) })} />
        </Grid>
        <div className="mt-3">
          <Select label="Reparto del cash-out" value={f.cashOutSplit} onChange={(v) => upd({ cashOutSplit: v })}
            options={[{ value: "capital_primero", label: "Primero devolver capital" }, { value: "porcentaje", label: "Por % de ganancias" }]} />
        </div>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card title="Cálculo del préstamo DSCR">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <Row label={`Préstamo por LTV (${pct(f.ltv, 0)} × ${usd(x.appraisal)})`} value={usd(x.ltvLoan)} />
              {f.dscrBasis === "renta" ? (
                <>
                  <Row label="Renta mensual" value={usd(s.deal.monthlyRent)} />
                  <Row indent label={`Pago máximo (renta ÷ ${ratio(f.minDscr)})`} value={usd(f.minDscr > 0 ? s.deal.monthlyRent / f.minDscr : 0)} />
                  <Row indent label="Menos impuestos, seguro y HOA" value={usd(-x.monthlyTia)} />
                  <Row indent label="Queda para principal + interés" value={usd(x.maxMonthlyPi)} />
                </>
              ) : (
                <Row label={`Pago máximo (NOI ÷ ${ratio(f.minDscr)} ÷ 12)`} value={usd(x.maxMonthlyPi)} />
              )}
              <Row label={`Préstamo máximo por DSCR ${ratio(f.minDscr)}`} value={usd(x.dscrLoan)} />
              <Row strong label={`Nuevo préstamo (limitado por ${x.limitedBy})`} value={usd(x.newLoan)} />
            </div>
            <div>
              <Row label="Menos costos de refinanciar" value={usd(-x.closingCosts)} />
              <Row label="Menos reservas" value={usd(-x.reserves)} />
              <Row strong label="Cash-out para los socios" value={usd(x.cashOut)} tone={tone(x.cashOut)} />
              <Row label="Pago mensual (principal + interés)" value={usd(x.monthlyPayment, 2)} />
              {f.dscrBasis === "renta" && <Row label="Pago total (PITIA)" value={usd(x.monthlyPitia, 2)} />}
              <Row strong label="DSCR resultante" value={ratio(x.lenderDscr)} tone={belowMin ? "risk" : "money"} />
            </div>
          </div>
        </Card>

        <Card title="Antes y después del refinanciamiento">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Flujo mensual antes" value={usd(x.before.monthlyCashFlow)} tone={tone(x.before.monthlyCashFlow)} />
            <Stat label="Flujo mensual después" value={usd(x.after.monthlyCashFlow)} tone={tone(x.after.monthlyCashFlow)} />
            <Stat label="Capital devuelto" value={usd(x.capitalReturned)} sub={`de ${usd(x.contributed)}`} tone="money" />
            <Stat label="Capital que queda dentro" value={usd(x.capitalRemaining)} />
          </div>
        </Card>

        <Card title="Resultado por socio después del refinanciamiento">
          <Table head={["Socio", "Capital", "Recibe del cash-out", "Capital recuperado", "Queda dentro", "Flujo anual después", "Cash-on-cash después"]}>
            {x.partnerResults.map((p, i) => (
              <tr key={i}>
                <td className="px-2 py-2 font-medium">{p.name}</td>
                <td className="px-2 py-2">{usd(p.capital)}</td>
                <td className="px-2 py-2">{usd(p.cashOut)}</td>
                <td className="px-2 py-2">{p.recoveredPct === null ? "—" : pct(p.recoveredPct, 0)}</td>
                <td className="px-2 py-2">{usd(p.capitalRemaining)}</td>
                <td className="px-2 py-2">{usd(p.annualCashFlowAfter)}</td>
                <td className="px-2 py-2">{p.cashOnCashAfter === null ? (p.capital > 0 ? "∞ (ya recuperó su capital)" : "Sin capital") : pct(p.cashOnCashAfter)}</td>
              </tr>
            ))}
          </Table>
          <ul className="mt-3 space-y-1.5">
            {x.notes.map((n) => <li key={n}><Note tone={n.startsWith("El nuevo préstamo") || n.includes("por debajo") || n.includes("negativo") ? "warn" : "info"}>{n}</Note></li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function PrivateLender({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const p = s.priv;
  const upd = (patch: Partial<typeof p>) => set("priv", { ...p, ...patch });
  const m = r.priv;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Términos del préstamo privado">
        <Grid cols={2}>
          <NumberField label="Monto prestado" value={p.loanAmount} onChange={(v) => upd({ loanAmount: v })} />
          <NumberField label="Interés anual" unit="pct" value={p.rate} onChange={(v) => upd({ rate: v })} />
          <NumberField label="Plazo" unit="meses" value={p.termMonths} onChange={(v) => upd({ termMonths: Math.max(1, v) })} />
          <Select label="Tipo de pago" value={p.paymentType} onChange={(v) => upd({ paymentType: v })}
            options={[{ value: "solo_interes", label: "Solo interés" }, { value: "amortizado", label: "Amortizado" }, { value: "pago_global", label: "Pago global al vencimiento" }]} />
          {p.paymentType === "amortizado" && <NumberField label="Amortización" unit="años" value={p.amortYears} onChange={(v) => upd({ amortYears: v })} />}
          <NumberField label="Puntos" unit="pct" value={p.pointsPct} onChange={(v) => upd({ pointsPct: v })} />
          <NumberField label="Comisiones" value={p.fees} onChange={(v) => upd({ fees: v })} />
          <Select label="Posición de gravamen" value={String(p.lienPosition) as "1" | "2"} onChange={(v) => upd({ lienPosition: Number(v) as 1 | 2 })}
            options={[{ value: "1", label: "Primera posición" }, { value: "2", label: "Segunda posición" }]} />
        </Grid>
        <button className="mt-3 rounded-lg bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-100"
          onClick={() => upd({ loanAmount: Math.round(((s.deal.purchasePrice + s.deal.repairs) * 0.8) / 1000) * 1000 })}>
          Usar 80% de compra + reparaciones
        </button>
        <div className="mt-3 rounded-lg bg-navy-50 p-3">
          <Row label="Capital propio" value={usd(m.capitalRequired)} />
          <Row label="Intereses totales" value={usd(m.totalInterest)} />
          <Row label="Rentabilidad del prestamista" value={`${pct(m.lenderAnnualReturn)} anual`} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Documenta garantías, pagaré y gravamen con un abogado o compañía de título.</p>
      </Card>
      <div className="lg:col-span-2"><MethodResults m={m} /></div>
    </div>
  );
}

function Compare({ methods, lenders, lenderIndex, onPickLender }: {
  methods: MethodSummary[]; lenders: HardMoneyInputs[]; lenderIndex: number; onPickLender: (i: number) => void;
}) {
  const data = methods.map((m) => ({ name: m.label.replace(/ \(.+\)/, ""), capital: Math.round(m.capitalRequired), flujo: Math.round(m.rental.annualCashFlow), venta: Math.round(m.flip.netProfit) }));
  return (
    <div className="space-y-4">
      {lenders.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">Hard money a comparar:
          {lenders.map((l, i) => (
            <button key={i} onClick={() => onPickLender(i)} className={`rounded-lg px-2 py-1 font-medium ${i === lenderIndex ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700"}`}>{l.lenderName}</button>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {methods.map((m) => (
          <Card key={m.method} title={m.label} actions={<RiskBadge risk={m.maturityRisk} />}>
            <Stat big label="Capital requerido" value={usd(m.capitalRequired)} />
            <div className="mt-3">
              <Row label="Préstamo" value={usd(m.loanAmount)} />
              <Row label="Pago mensual" value={usd(m.monthlyPayment)} />
              <Row label="Flujo mensual (renta)" value={usd(m.rental.monthlyCashFlow)} tone={tone(m.rental.monthlyCashFlow)} />
              <Row label="Cash-on-cash" value={pct(m.rental.cashOnCash)} />
              <Row label="Cap rate" value={pct(m.rental.capRate)} />
              <Row label="DSCR" value={ratio(m.rental.dscr)} />
              <Row label="Ganancia si vendes" value={usd(m.flip.netProfit)} tone={tone(m.flip.netProfit)} />
              <Row label="ROI de la venta" value={pct(m.flip.roiOnCash)} />
              <Row label="Costos financieros" value={usd(m.financeCosts)} />
              <Row label="Saldo al vencimiento" value={usd(m.balloon)} />
              <Row label="Recuperación" value={years(m.paybackYears)} />
            </div>
          </Card>
        ))}
      </div>
      <Card title="Capital vs. resultados">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} width={50} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="capital" name="Capital requerido" fill="#13294b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="flujo" name="Flujo anual (renta)" fill="#1f9d55" radius={[4, 4, 0, 0]} />
              <Bar dataKey="venta" name="Ganancia si vendes" fill="#c9a227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

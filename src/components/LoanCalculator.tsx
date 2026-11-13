"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { amortizationSchedule } from "@/lib/engine/finance";
import { usd, years } from "@/lib/format";
import { Card, Grid, Note, NumberField, Row, Stat, Table, tone } from "./ui";

export interface LoanDefaults {
  loanAmount: number;
  rate: number;
  termYears: number;
  taxesAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
  monthlyRent: number;
}

type Inputs = LoanDefaults & { pmiPct: number; extraMonthly: number };

const COLORS = { principal: "#13294b", interest: "#c9a227", taxes: "#1f9d55", insurance: "#5b7fb3", hoa: "#94a3b8", pmi: "#c0392b" };

/**
 * Calculadora completa de pago mensual (PITI): principal, intereses,
 * impuestos, seguro, HOA y PMI. Toma por defecto los datos del
 * refinanciamiento BRRRR; cualquier campo editado queda fijo hasta restablecer.
 */
export function LoanCalculator({ defaults }: { defaults: LoanDefaults }) {
  const [over, setOver] = useState<Partial<Inputs>>({});
  const v: Inputs = { pmiPct: 0, extraMonthly: 0, ...defaults, ...over };
  const setV = (patch: Partial<Inputs>) => setOver((o) => ({ ...o, ...patch }));

  const am = useMemo(() => amortizationSchedule(v.loanAmount, v.rate, v.termYears, v.extraMonthly), [v.loanAmount, v.rate, v.termYears, v.extraMonthly]);
  const base = useMemo(() => amortizationSchedule(v.loanAmount, v.rate, v.termYears), [v.loanAmount, v.rate, v.termYears]);

  const taxes = v.taxesAnnual / 12;
  const insurance = v.insuranceAnnual / 12;
  const pmi = (v.loanAmount * v.pmiPct) / 12;
  const total = am.scheduledPayment + taxes + insurance + v.hoaMonthly + pmi + v.extraMonthly;
  const afterRent = v.monthlyRent - total;
  const parts = [
    { key: "principal", name: "Principal", value: am.firstMonthPrincipal },
    { key: "interest", name: "Intereses", value: am.firstMonthInterest },
    { key: "taxes", name: "Impuestos", value: taxes },
    { key: "insurance", name: "Seguro (aseguranza)", value: insurance },
    { key: "hoa", name: "HOA", value: v.hoaMonthly },
    { key: "pmi", name: "PMI", value: pmi },
  ].filter((p) => p.value > 0) as { key: keyof typeof COLORS; name: string; value: number }[];
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? am.years : am.years.filter((y) => [1, 2, 3, 5, 10, 15, 20, 25, 30].includes(y.year) || y.year === am.years.length);
  const edited = Object.keys(over).length > 0;

  return (
    <Card title="Calculadora completa del préstamo" subtitle="Principal, intereses, impuestos, seguro, HOA y PMI. Por defecto usa el nuevo préstamo del refinanciamiento."
      actions={edited && <button onClick={() => setOver({})} className="rounded-lg border border-navy-100 px-2.5 py-1 text-xs hover:bg-navy-50">Usar datos del refinanciamiento</button>}>
      <Grid cols={4}>
        <NumberField label="Monto del préstamo" value={v.loanAmount} onChange={(x) => setV({ loanAmount: x })} min={0} />
        <NumberField label="Interés anual" unit="pct" value={v.rate} onChange={(x) => setV({ rate: x })} min={0} />
        <NumberField label="Plazo" unit="años" value={v.termYears} onChange={(x) => setV({ termYears: Math.max(1, x) })} />
        <NumberField label="Pago extra a principal / mes" value={v.extraMonthly} onChange={(x) => setV({ extraMonthly: x })} min={0} />
        <NumberField label="Impuestos / año" value={v.taxesAnnual} onChange={(x) => setV({ taxesAnnual: x })} min={0} />
        <NumberField label="Seguro (aseguranza) / año" value={v.insuranceAnnual} onChange={(x) => setV({ insuranceAnnual: x })} min={0} />
        <NumberField label="HOA / mes" value={v.hoaMonthly} onChange={(x) => setV({ hoaMonthly: x })} min={0} />
        <NumberField label="PMI anual" unit="pct" value={v.pmiPct} onChange={(x) => setV({ pmiPct: x })} min={0} hint="% del préstamo. Suele aplicar con menos de 20% de equidad" />
      </Grid>

      <div className="mt-5 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-navy-900 p-4 text-white">
            <div className="text-xs uppercase tracking-wide text-navy-100/70">Pago mensual total</div>
            <div className="mt-1 text-3xl font-bold text-gold-400">{usd(total)}</div>
            <div className="mt-1 text-xs text-navy-100/70">Principal + intereses: {usd(am.scheduledPayment, 2)}</div>
          </div>
          <div className="mt-3">
            <Row label="Principal (1er mes)" value={usd(am.firstMonthPrincipal, 2)} />
            <Row label="Intereses (1er mes)" value={usd(am.firstMonthInterest, 2)} />
            <Row label="Impuestos" value={usd(taxes, 2)} />
            <Row label="Seguro (aseguranza)" value={usd(insurance, 2)} />
            {v.hoaMonthly > 0 && <Row label="HOA" value={usd(v.hoaMonthly, 2)} />}
            {pmi > 0 && <Row label="PMI" value={usd(pmi, 2)} />}
            {v.extraMonthly > 0 && <Row label="Pago extra a principal" value={usd(v.extraMonthly, 2)} />}
            <Row strong label="Total mensual" value={usd(total, 2)} />
            <Row label="Renta mensual" value={usd(v.monthlyRent)} />
            <Row strong label="Renta - pago del préstamo" value={usd(afterRent)} tone={tone(afterRent)} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">No incluye vacancia, mantenimiento, administración ni CapEx; esos están en el flujo neto de la etapa 3.</p>
        </div>
        <div className="lg:col-span-3">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={parts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {parts.map((p) => <Cell key={p.key} fill={COLORS[p.key]} />)}
                </Pie>
                <Tooltip formatter={(x) => usd(Number(x), 2)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Intereses totales" value={usd(am.totalInterest)} />
            <Stat label="Total pagado (P+I)" value={usd(am.totalPaid)} />
            <Stat label="Se liquida en" value={years(am.payoffMonths / 12)} />
            <Stat label="Ahorro por pago extra" value={usd(base.totalInterest - am.totalInterest)} tone={v.extraMonthly > 0 ? "money" : "default"} />
          </div>
        </div>
      </div>

      <h4 className="mt-6 mb-2 text-sm font-semibold">Saldo del préstamo</h4>
      <div className="h-56">
        <ResponsiveContainer>
          <AreaChart data={am.years}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(x) => `$${Math.round(x / 1000)}k`} tick={{ fontSize: 11 }} width={50} />
            <Tooltip formatter={(x) => usd(Number(x))} labelFormatter={(l) => `Año ${l}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="endBalance" name="Saldo pendiente" stroke="#13294b" fill="#e6ecf5" />
            <Area type="monotone" dataKey="interestPaid" name="Intereses del año" stroke="#c9a227" fill="#f8f0d4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Tabla de amortización por año</h4>
        <button onClick={() => setShowAll((x) => !x)} className="text-xs font-medium text-navy-700 underline-offset-2 hover:underline">
          {showAll ? "Ver resumen" : "Ver todos los años"}
        </button>
      </div>
      <Table head={["Año", "Principal", "Intereses", "Pago extra", "Impuestos", "Seguro", "Saldo al final"]}>
        {rows.map((y) => (
          <tr key={y.year}>
            <td className="px-2 py-2 font-medium">{y.year}</td>
            <td className="px-2 py-2">{usd(y.principalPaid)}</td>
            <td className="px-2 py-2">{usd(y.interestPaid)}</td>
            <td className="px-2 py-2">{usd(y.extraPaid)}</td>
            <td className="px-2 py-2">{usd(v.taxesAnnual)}</td>
            <td className="px-2 py-2">{usd(v.insuranceAnnual)}</td>
            <td className="px-2 py-2 font-semibold">{usd(y.endBalance)}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-3"><Note>Impuestos y seguro se muestran constantes; en la realidad suelen subir cada año. Confirma la tasa, el PMI y el escrow con tu prestamista.</Note></div>
    </Card>
  );
}

"use client";
import { Goal, GOAL_LABELS } from "@/lib/engine/strategies";
import { pct, usd, years } from "@/lib/format";
import { Card, Note, RiskBadge, Table, tone } from "../ui";
import type { Analysis } from "../useAnalysis";

export function StrategiesTab({ a }: { a: Analysis }) {
  const { state: s, set, r } = a;
  const rec = r.recommendation;
  return (
    <div className="space-y-4">
      <Card title="¿Cuál es tu objetivo?">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <button key={g} onClick={() => set("goal", g)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${s.goal === g ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700 hover:bg-navy-100"}`}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        {rec.row && (
          <div className="mt-4 rounded-xl border-l-4 border-gold-500 bg-gold-100/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-warn-600">Recomendación explicable</div>
            <div className="mt-1 text-lg font-semibold">{rec.row.label}</div>
            <p className="mt-1 text-sm text-slate-700">{rec.reason}</p>
            <p className="mt-2 text-[11px] text-slate-500">Basado únicamente en los supuestos de este análisis. No es una garantía de ganancia ni asesoría financiera.</p>
          </div>
        )}
      </Card>
      <Card title="Comparación de estrategias">
        <Table head={["Estrategia", "Capital requerido", "Flujo mensual", "Ganancia proyectada", "ROI", "Riesgo", "Recuperación", "Equidad", "Costos financieros"]}>
          {r.strategies.map((row) => (
            <tr key={row.id} className={rec.row?.id === row.id ? "bg-gold-100/40" : ""}>
              <td className="px-2 py-2 font-medium">{row.label}</td>
              <td className="px-2 py-2">{usd(row.capitalRequired)}</td>
              <td className={`px-2 py-2 ${tone(row.monthlyCashFlow) === "risk" ? "text-risk-600" : ""}`}>{usd(row.monthlyCashFlow)}</td>
              <td className="px-2 py-2" title={row.profitBasis}>{usd(row.projectedProfit)}<div className="text-[10px] text-slate-400">{row.profitBasis}</div></td>
              <td className="px-2 py-2">{pct(row.roi)}</td>
              <td className="px-2 py-2"><RiskBadge risk={row.risk} /></td>
              <td className="px-2 py-2">{row.id === "brrrr" && row.recoveryYears === 0 ? "Al refinanciar" : years(row.recoveryYears)}</td>
              <td className="px-2 py-2">{usd(row.equity)}</td>
              <td className="px-2 py-2">{usd(row.financeCosts)}</td>
            </tr>
          ))}
        </Table>
        <div className="mt-3"><Note>Costos financieros: intereses del primer año para estrategias de renta; intereses, puntos y comisiones del proyecto para el flip.</Note></div>
      </Card>
    </div>
  );
}

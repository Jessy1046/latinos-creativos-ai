"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { DataKind } from "@/lib/data/types";
import type { Verdict } from "@/lib/engine/rules";

export function Card({ title, subtitle, children, className, actions }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  return (
    <section className={clsx("rounded-2xl border border-navy-100 bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] fade-in", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-base font-semibold text-navy-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", big }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "money" | "risk" | "gold"; big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx("mt-1 truncate font-semibold tabular-nums", big ? "text-xl xl:text-2xl" : "text-lg",
        tone === "money" && "text-money-600", tone === "risk" && "text-risk-600", tone === "gold" && "text-gold-500")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

const KIND_STYLE: Record<DataKind, { label: string; cls: string }> = {
  verificado: { label: "Verificado", cls: "bg-money-100 text-money-600" },
  estimado: { label: "Estimación", cls: "bg-navy-100 text-navy-700" },
  usuario: { label: "Tu dato", cls: "bg-gold-100 text-warn-600" },
  no_disponible: { label: "No disponible", cls: "bg-slate-100 text-slate-500" },
  demo: { label: "DEMO", cls: "bg-risk-100 text-risk-600" },
};

export function DataBadge({ kind, title }: { kind: DataKind; title?: string }) {
  const s = KIND_STYLE[kind];
  return (
    <span title={title} className={clsx("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", s.cls)}>
      {s.label}
    </span>
  );
}

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  cumple: { label: "Cumple", cls: "bg-money-500 text-white" },
  no_cumple: { label: "No cumple", cls: "bg-risk-600 text-white" },
  revision: { label: "Requiere revisión", cls: "bg-gold-500 text-navy-950" },
};

export function VerdictBadge({ v, size = "sm" }: { v: Verdict; size?: "sm" | "lg" }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full font-semibold", VERDICT[v].cls, size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs")}>
      {VERDICT[v].label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: "bajo" | "medio" | "alto" }) {
  const cls = risk === "bajo" ? "bg-money-100 text-money-600" : risk === "medio" ? "bg-warn-100 text-warn-600" : "bg-risk-100 text-risk-600";
  return <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", cls)}>Riesgo {risk}</span>;
}

type Unit = "usd" | "pct" | "num" | "años" | "meses" | "x";

const fmtInput = (n: number) => (isFinite(n) ? String(Math.round(n * 10000) / 10000) : "");

/** Campo numérico editable. Para porcentajes guarda decimales (0.08) y muestra 8. */
export function NumberField({ label, value, onChange, unit = "usd", hint, kind, step, min }: {
  label: string; value: number; onChange: (n: number) => void; unit?: Unit; hint?: string; kind?: DataKind; step?: number; min?: number;
}) {
  const factor = unit === "pct" ? 100 : 1;
  const [text, setText] = useState(fmtInput(value * factor));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmtInput(value * factor));
  }, [value, factor]);
  const prefix = unit === "usd" ? "$" : null;
  const suffix = unit === "pct" ? "%" : unit === "años" ? "años" : unit === "meses" ? "meses" : unit === "x" ? "×" : null;
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <span className="truncate">{label}</span>
        {kind && <span className="hidden shrink-0 sm:inline-flex"><DataBadge kind={kind} /></span>}
      </span>
      <span className="flex items-center rounded-lg border border-navy-100 bg-white px-2.5 transition focus-within:border-navy-700 focus-within:ring-2 focus-within:ring-navy-100">
        {prefix && <span className="mr-1 text-sm text-slate-400">{prefix}</span>}
        <input
          inputMode="decimal"
          className="w-full min-w-0 bg-transparent py-2 text-sm tabular-nums text-navy-900 outline-none"
          value={text}
          step={step}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setText(fmtInput(value * factor));
          }}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = parseFloat(t.replace(/[,$\s]/g, ""));
            if (t.trim() === "") onChange(0);
            else if (!isNaN(n)) onChange(Math.max(min ?? -Infinity, n) / factor);
          }}
        />
        {suffix && <span className="ml-1 text-xs text-slate-400">{suffix}</span>}
      </span>
      {kind && <span className="mt-1 inline-flex sm:hidden"><DataBadge kind={kind} /></span>}
      {hint && <span className="mt-1 block text-[11px] leading-tight text-slate-400">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        className="w-full rounded-lg border border-navy-100 bg-white px-2.5 py-2 text-sm text-navy-900 outline-none focus:border-navy-700"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, variant = "main" }: {
  tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; variant?: "main" | "pill";
}) {
  return (
    <div className={clsx("no-print flex gap-1 overflow-x-auto", variant === "main" ? "border-b border-navy-100" : "rounded-xl bg-navy-50 p-1")}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "shrink-0 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition",
            variant === "main"
              ? value === t.id ? "border-b-2 border-gold-500 text-navy-900" : "border-b-2 border-transparent text-slate-500 hover:text-navy-900"
              : value === t.id ? "rounded-lg bg-white text-navy-900 shadow-sm" : "rounded-lg text-slate-500 hover:text-navy-900",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, value, strong, tone, indent }: {
  label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: "money" | "risk" | "default"; indent?: boolean;
}) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-3 py-1.5 text-sm", strong && "border-t border-navy-100 pt-2 font-semibold")}>
      <span className={clsx("text-slate-600", indent && "pl-3", strong && "text-navy-900")}>{label}</span>
      <span className={clsx("tabular-nums", tone === "money" && "text-money-600", tone === "risk" && "text-risk-600")}>{value}</span>
    </div>
  );
}

export function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={clsx("grid gap-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3", cols === 4 && "grid-cols-2 lg:grid-cols-4")}>
      {children}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "risk" }) {
  return (
    <p className={clsx("rounded-lg px-3 py-2 text-xs leading-relaxed",
      tone === "info" && "bg-navy-50 text-navy-700", tone === "warn" && "bg-warn-100 text-warn-600", tone === "risk" && "bg-risk-100 text-risk-600")}>
      {children}
    </p>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => <th key={i} className="px-2 py-2 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50 tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}

export const tone = (n: number) => (n > 0 ? "money" : n < 0 ? "risk" : "default") as "money" | "risk" | "default";

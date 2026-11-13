"use client";
import { useState } from "react";
import Image from "next/image";
import { Loader2, MapPin, PenLine, Printer, Search } from "lucide-react";
import type { PropertyLookup } from "@/lib/data/types";
import { useAnalysis } from "@/components/useAnalysis";
import { Summary } from "@/components/Summary";
import { Tabs } from "@/components/ui";
import { RentalTab } from "@/components/tabs/RentalTab";
import { FlipTab } from "@/components/tabs/FlipTab";
import { FinancingTab } from "@/components/tabs/FinancingTab";
import { BrrrrTab } from "@/components/tabs/BrrrrTab";
import { CompsTab } from "@/components/tabs/CompsTab";
import { StrategiesTab } from "@/components/tabs/StrategiesTab";
import { AnalystTab } from "@/components/tabs/AnalystTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";

const TABS = [
  { id: "analista", label: "Analista" },
  { id: "renta", label: "Renta" },
  { id: "flip", label: "Flip" },
  { id: "financiamiento", label: "Financiamiento" },
  { id: "brrrr", label: "BRRRR" },
  { id: "comparables", label: "Comparables" },
  { id: "estrategias", label: "Estrategias" },
  { id: "config", label: "Configuración" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const a = useAnalysis();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<TabId>("analista");

  async function analyze(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // En la web el backend está en el mismo dominio; en la app móvil (Capacitor) apunta al servidor publicado.
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/property?address=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      a.load(data as PropertyLookup);
      setStarted(true);
      setTab("analista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="no-print border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white px-2 py-1">
              <Image src="/brand/latinos-creativos-logo.jpg" alt="Latinos Creativos — Hermanitos Cruz" width={936} height={588} priority className="h-12 w-auto" />
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold">Real Estate AI</div>
              <div className="text-[11px] text-navy-100/70">Metodología Hermanitos Cruz</div>
            </div>
          </div>
          {started && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10">
              <Printer size={14} /> Exportar PDF
            </button>
          )}
        </div>
      </header>

      <section className={`no-print overflow-hidden bg-gradient-to-b from-navy-900 to-navy-800 text-white ${started ? "py-6" : "pt-10 md:pt-14"}`}>
        <div className={started ? "mx-auto max-w-3xl px-4" : "mx-auto grid max-w-6xl items-end gap-6 px-4 md:grid-cols-5"}>
        <div className={started ? "" : "pb-12 md:col-span-3 md:pb-20"}>
          {!started && (
            <div className="mb-8 text-center fade-in md:text-left">
              <div className="mb-3 inline-block rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-400">
                Metodología Hermanitos Cruz
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                ¿Es una buena <span className="text-gold-400">inversión</span>?
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-navy-100/80 md:mx-0">
                Escribe una dirección en Estados Unidos y obtén renta, flip, financiamiento y BRRRR en un solo análisis.
              </p>
            </div>
          )}
          <form onSubmit={analyze} className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3">
              <MapPin className="shrink-0 text-gold-500" size={20} />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Introduce la dirección de una propiedad"
                aria-label="Introduce la dirección de una propiedad"
                className="w-full py-3 text-base text-navy-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-6 py-3 font-semibold text-navy-950 transition hover:bg-gold-400 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Analizar inversión
            </button>
          </form>
          {error && <p className="mt-3 rounded-lg bg-risk-600/90 px-3 py-2 text-sm">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-navy-100/70">
            <button type="button" onClick={() => setAddress("6401 W Morgan Ave, Milwaukee, WI 53220")} className="underline-offset-2 hover:underline">
              Ejemplo: 6401 W Morgan Ave, Milwaukee, WI 53220
            </button>
            <button type="button" onClick={() => { a.startManual(); setStarted(true); }} className="flex items-center gap-1 underline-offset-2 hover:underline">
              <PenLine size={12} /> Capturar datos manualmente
            </button>
          </div>
        </div>
        {!started && (
          <div className="relative mx-auto w-full max-w-sm md:col-span-2 md:max-w-none fade-in">
            <div className="absolute inset-x-6 bottom-0 top-1/4 rounded-t-full bg-gold-500/20 blur-2xl" />
            <Image src="/brand/hermanitos-cruz.webp" alt="Los Hermanitos Cruz" width={1080} height={1080} priority className="relative h-auto w-full" />
          </div>
        )}
        </div>
      </section>

      {started && (
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
          <Summary a={a} />
          <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
          <div className="fade-in" key={tab}>
            {tab === "analista" && <AnalystTab a={a} />}
            {tab === "renta" && <RentalTab a={a} />}
            {tab === "flip" && <FlipTab a={a} />}
            {tab === "financiamiento" && <FinancingTab a={a} />}
            {tab === "brrrr" && <BrrrrTab a={a} />}
            {tab === "comparables" && <CompsTab a={a} />}
            {tab === "estrategias" && <StrategiesTab a={a} />}
            {tab === "config" && <SettingsTab a={a} />}
          </div>
          <footer className="border-t border-navy-100 pt-4 pb-8 text-xs leading-relaxed text-slate-500">
            Herramienta educativa. Los resultados dependen de los supuestos introducidos y no son asesoría financiera, legal ni fiscal,
            ni garantía de ganancia. Verifica datos, impuestos, seguros, condición de la propiedad y condiciones de financiamiento con profesionales.
          </footer>
        </main>
      )}
    </div>
  );
}

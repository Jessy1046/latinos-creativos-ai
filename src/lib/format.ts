export const usd = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || !isFinite(n)
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });

export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || !isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

export const ratio = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? "—" : n.toFixed(2));

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

export const years = (n: number | null | undefined) =>
  n === null || n === undefined || !isFinite(n) ? "—" : n < 1 ? `${Math.round(n * 12)} meses` : `${n.toFixed(1)} años`;

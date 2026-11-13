import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/data";
import { ProviderError } from "@/lib/data/types";

const Query = z.object({
  address: z.string().trim().min(8, "Introduce una dirección completa.").max(200),
});

/** Orígenes de las apps móviles de Capacitor (iOS y Android) más los que se agreguen por entorno. */
const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
  ...(process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
]);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", Vary: "Origin" };
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req: Request) {
  const headers = cors(req);
  const parsed = Query.safeParse({ address: new URL(req.url).searchParams.get("address") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers });
  }
  try {
    const data = await getProvider().lookup(parsed.data.address);
    return NextResponse.json(data, { headers });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    const message = e instanceof ProviderError ? e.message : "No se pudo obtener la información de la propiedad.";
    if (!(e instanceof ProviderError)) console.error(e);
    return NextResponse.json({ error: message }, { status, headers });
  }
}

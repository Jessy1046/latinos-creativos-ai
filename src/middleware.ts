import { NextResponse, type NextRequest } from "next/server";

/**
 * Protección simple con contraseña (HTTP Basic Auth) para cuando la app se publica
 * con un link. Solo se activa si APP_PASSWORD está definido en el servidor.
 * Usuario: cualquiera (o APP_USER si se define). Contraseña: APP_PASSWORD.
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  // Las apps móviles (Capacitor) hacen preflight sin credenciales.
  if (req.method === "OPTIONS") return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    const expectedUser = process.env.APP_USER;
    if (pass === password && (!expectedUser || user === expectedUser)) return NextResponse.next();
  }
  return new NextResponse("Se requiere contraseña", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Latinos Creativos Real Estate AI", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

# Guía técnica: build, backend y Capacitor (iOS / Android)

Documento para el desarrollador que va a empaquetar la app con Capacitor.

## 1. Cómo correr y compilar

```bash
export PATH="$PWD/.tools/node/bin:$PATH"   # Node 22 local (la Mac no tiene Node del sistema)
npm ci
npm run dev       # http://localhost:3000
npm test          # 29 pruebas del motor financiero (Vitest)
npm run build     # build de producción de Next.js
```

- Next.js 15.5 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, Zod.
- No hay base de datos, autenticación ni almacenamiento en servidor todavía.

## 2. ¿Qué depende de un servidor?

| Función | Dónde corre | ¿Necesita servidor? |
|---|---|---|
| Todos los cálculos (1.5%, 50%, renta, flip, 4 financiamientos, BRRRR, DSCR, calculadora PITI, comparables, estrategias, Analista) | Navegador — `src/lib/engine/*` | **No.** Funciona sin internet |
| Captura manual de datos | Navegador | **No** |
| Búsqueda por dirección (RentCast) | Servidor — `GET /api/property` | **Sí** |
| Mapa (OpenStreetMap) y botones Zillow / Redfin / Realtor / Maps / Propwire | Navegador → sitios externos | Solo internet |

## 3. Backend / API

Un único endpoint:

```
GET /api/property?address=<dirección>
```

- Código: `src/app/api/property/route.ts`.
- Proveedores de datos: `src/lib/data/` (`rentcast.ts`, `demo.ts`, `index.ts`). `index.ts` usa `server-only`.
- Usa `RENTCAST_API_KEY` de `.env.local` (solo servidor). Sin clave usa el proveedor de **demostración**.
- Respuesta: `PropertyLookup` (`src/lib/data/types.ts`), donde cada dato trae su origen, fuente y fecha.
- CORS ya está habilitado para `capacitor://localhost`, `https://localhost` y `http://localhost`. Para agregar más orígenes se usa la variable `CORS_ALLOWED_ORIGINS`, separada por comas.

**La clave de RentCast NUNCA debe ir dentro de la app móvil.** El backend tiene que estar publicado (por ejemplo, en Vercel) y la app lo llama por HTTPS.

El frontend ya lee `NEXT_PUBLIC_API_BASE_URL`:
- En la web va vacío, porque el API está en el mismo dominio.
- En el build móvil se pone la URL publicada, por ejemplo `https://latinos-creativos.vercel.app`.

## 4. Plan recomendado para Capacitor

### Paso A — Publicar el backend
Desplegar el proyecto tal cual en Vercel con `RENTCAST_API_KEY` en las variables de entorno. Antes de hacerlo público conviene agregar autenticación, para que nadie más gaste créditos de RentCast.

### Paso B — Build estático para el móvil
Capacitor empaqueta archivos estáticos. En un export estático los Route Handlers no se ejecutan, así que el build móvil:
1. Usa `output: "export"` e `images: { unoptimized: true }` en `next.config.ts`. Hay que hacerlo condicional, por ejemplo con `MOBILE_EXPORT=1`, para no romper el build web.
2. Excluye `src/app/api/` durante ese build. Por ejemplo, un script que mueva la carpeta antes de `next build` y la regrese después, o mover el API a un proyecto aparte.
3. Se compila con `NEXT_PUBLIC_API_BASE_URL=https://<backend-publicado>`.
4. El resultado queda en `out/`, que es el `webDir` de Capacitor.

### Paso C — Capacitor
```bash
npm i @capacitor/core @capacitor/ios @capacitor/android
npm i -D @capacitor/cli @capacitor/assets
npx cap init "Latinos Creativos" com.latinoscreativos.realestate --web-dir=out
npx cap add ios
npx cap add android
npx @capacitor/assets generate      # íconos y splash desde assets/icon.png y assets/splash.png
npx cap sync
npx cap open ios                    # requiere Xcode
npx cap open android                # requiere Android Studio
```

Recursos de marca disponibles: `public/brand/latinos-creativos-logo.jpg` y `public/brand/hermanitos-cruz.webp`. Para `@capacitor/assets` hace falta un ícono cuadrado de 1024×1024; el logo actual es horizontal y hay que adaptarlo.

### Alternativa rápida
`server.url` en `capacitor.config.ts`, apuntando al sitio publicado. Es más simple, pero la app depende al 100% de internet, y Apple puede rechazar apps que solo envuelven una web (guía 4.2).

## 5. Requisitos de esta Mac

- **No tiene Xcode ni las Command Line Tools.** Hace falta instalar Xcode desde la App Store para compilar iOS, y Android Studio para Android.
- **No tiene Node del sistema.** Node 22 está en `.tools/node`.

## 6. Estructura

```
src/app/page.tsx              Página principal (cliente)
src/app/api/property/route.ts Backend (único endpoint)
src/components/               UI: Summary, pestañas, calculadora de préstamo
src/lib/engine/               Motor financiero determinista + pruebas
src/lib/data/                 Proveedores de datos (RentCast, demo)
public/brand/                 Logo y foto
```

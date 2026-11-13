# Latinos Creativos Real Estate AI

Análisis de inversiones inmobiliarias en EE. UU. con la metodología de los Hermanitos Cruz.
Next.js 15 · TypeScript · Tailwind CSS 4 · Recharts · Zod · Vitest.

## Cómo abrirla

```bash
# Node 22 está instalado localmente en ./.tools/node (no en el sistema)
export PATH="$PWD/.tools/node/bin:$PATH"
npm run dev        # http://localhost:3000
npm test           # pruebas del motor financiero
npm run build      # build de producción
```

Sin clave de API la app funciona en **modo demostración** (datos ficticios, marcados como DEMO).
Para datos reales: copia `.env.example` a `.env.local` y agrega `RENTCAST_API_KEY`.

## Arquitectura

```
src/lib/engine/     Motor financiero determinista (sin React, 100% probado con Vitest)
  finance.ts        Pagos, amortización, saldos, bisección
  rules.ts          Regla del 1.5% y regla del 50%
  rental.ts         NOI, cash flow, cap rate, cash-on-cash, DSCR, proyecciones 1–30 años
  flip.ts           Presupuesto completo de flip y oferta máxima por ganancia objetivo
  financing.ts      Cash, hard money, socios capitalistas, prestamista privado
  brrrr.ts          BRRRR de 5 etapas y simulación de expansión
  comps.ts          Selección progresiva de comparables, ARV y renta de mercado
  strategies.ts     Comparación de estrategias y recomendación explicable
  analyst.ts        "Analista" en modo determinista (reglas, sin LLM)
src/lib/data/       Proveedores de datos intercambiables (solo servidor)
  demo.ts           Datos ficticios estables por dirección
  rentcast.ts       Adaptador de RentCast (pendiente de validar con clave real)
src/app/api/property  Endpoint que consulta el proveedor; la clave nunca llega al navegador
src/components/     Interfaz: resumen, pestañas, campos editables
```

Cada dato muestra su origen: **Verificado**, **Estimación**, **Tu dato**, **No disponible** o **DEMO**.

## Estado por fase

| Fase | Estado |
|---|---|
| 1. Diseño, buscador, captura manual | ✅ |
| 2. Motor: 1.5%, 50%, rentas, flips | ✅ |
| 3. Cash, hard money, socios, privado + comparador | ✅ |
| 4. BRRRR y comparación de estrategias | ✅ |
| 5. API de propiedades y comparables | 🟡 Adaptador RentCast escrito, sin probar con clave real. Comparables manuales ✅ |
| 6. IA, cuentas, historial, PDF | 🟡 Analista determinista ✅ · PDF vía impresión del navegador ✅ · IA, cuentas, historial ⏳ |
| 7. Pruebas, seguridad, producción | 🟡 26 pruebas unitarias del motor ✅ · integración/E2E ⏳ |

Pendiente: PostgreSQL + Prisma, autenticación, favoritos, historial, estados del pipeline,
Analista con LLM, mapa de comparables, pruebas E2E.

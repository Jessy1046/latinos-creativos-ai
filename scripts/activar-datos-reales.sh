#!/bin/sh
# Activa los datos reales en el link publicado:
# 1) Copia RENTCAST_API_KEY de .env.local a Vercel (producción), sin mostrarla.
# 2) Pide la contraseña de la app (oculta) y la guarda en Vercel.
# 3) Vuelve a publicar la app con esos valores.
cd "$(dirname "$0")/.." || exit 1
PATH="$PWD/.tools/node/bin:$PATH"

RC=$(grep '^RENTCAST_API_KEY=' .env.local | head -1 | cut -d= -f2-)
if [ -z "$RC" ]; then echo "❌ No encontré la clave de RentCast en .env.local"; exit 1; fi

echo ""
printf "Escribe la contraseña para abrir la app y presiona Enter (no se verá): "
stty -echo; read -r PW; stty echo; echo ""
if [ -z "$PW" ]; then echo "❌ La contraseña no puede estar vacía"; exit 1; fi

echo "Guardando en Vercel..."
printf %s "$RC" | npx vercel env add RENTCAST_API_KEY --environment production --sensitive --force --yes >/dev/null 2>&1 \
  && echo "✅ Clave de RentCast guardada" || { echo "❌ No se pudo guardar la clave de RentCast"; exit 1; }
printf %s "$PW" | npx vercel env add APP_PASSWORD --environment production --sensitive --force --yes >/dev/null 2>&1 \
  && echo "✅ Contraseña guardada" || { echo "❌ No se pudo guardar la contraseña"; exit 1; }
unset RC PW

echo "Publicando (tarda 1 o 2 minutos)..."
npx vercel deploy --prod --yes >/dev/null 2>&1 && echo "✅ Publicado" || { echo "❌ No se pudo publicar"; exit 1; }
echo ""
echo "LISTO: abre https://latinos-creativos-ai.vercel.app y avísale a Claude"

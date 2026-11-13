#!/bin/sh
# Guarda la clave de RentCast y la contraseña de la app en Vercel (producción).
# Lo que escribes no se muestra en pantalla y no queda guardado en esta Mac.
cd "$(dirname "$0")/.." || exit 1
PATH="$PWD/.tools/node/bin:$PATH"

echo ""
printf "1) Pega tu clave de RentCast y presiona Enter: "
stty -echo; read -r RC; stty echo; echo ""
printf "2) Escribe la contraseña para abrir la app y presiona Enter: "
stty -echo; read -r PW; stty echo; echo ""

printf %s "$RC" | npx vercel env add RENTCAST_API_KEY --environment production --sensitive --force --yes >/dev/null 2>&1 \
  && echo "✅ Clave de RentCast guardada" || { echo "❌ No se pudo guardar la clave de RentCast"; exit 1; }
printf %s "$PW" | npx vercel env add APP_PASSWORD --environment production --sensitive --force --yes >/dev/null 2>&1 \
  && echo "✅ Contraseña guardada" || { echo "❌ No se pudo guardar la contraseña"; exit 1; }
unset RC PW
echo ""
echo "LISTO - avísale a Claude"

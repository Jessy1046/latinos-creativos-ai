import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde otros dispositivos de la red local.
  allowedDevOrigins: ["192.168.1.62"],
};

export default nextConfig;

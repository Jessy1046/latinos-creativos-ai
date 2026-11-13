import "server-only";
import { DemoProvider } from "./demo";
import { RentCastProvider } from "./rentcast";
import type { PropertyDataProvider } from "./types";

/** Elige el proveedor según las variables de entorno del servidor. */
export function getProvider(): PropertyDataProvider {
  const key = process.env.RENTCAST_API_KEY;
  if (key && key.trim()) return new RentCastProvider(key.trim());
  return new DemoProvider();
}

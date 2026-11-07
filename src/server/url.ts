import "server-only";

import { headers } from "next/headers";

/**
 * Origen público de la app (por ejemplo https://rifas.ejemplo.com) según la petición actual,
 * para armar enlaces que se comparten fuera de la app (WhatsApp, QR, PDF).
 */
export async function urlBase(): Promise<string> {
  const encabezados = await headers();
  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host") ?? "localhost:3000";
  const protocolo =
    encabezados.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

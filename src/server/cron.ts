import { timingSafeEqual } from "node:crypto";

/**
 * true si el encabezado Authorization trae el secreto del cron ("Bearer <CRON_SECRET>").
 * Así lo manda Vercel Cron; cualquier otro programador (pg_net, cron-job.org) puede mandar lo mismo.
 * Sin secreto configurado, nadie está autorizado.
 */
export function autorizarCron(encabezado: string | null, secreto: string | undefined): boolean {
  if (!secreto || !encabezado) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(encabezado);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

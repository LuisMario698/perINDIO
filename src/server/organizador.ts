import { eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { organizadores } from "@/db/schema";
import { LOGO_MAXIMO_BYTES, tipoDeImagen, type DatosPerfil } from "@/lib/validacion/organizador";

import { ErrorDeNegocio } from "./errores";

/** Perfil del organizador sin el logo (solo si existe y una versión para el caché). */
export async function obtenerPerfil(db: Db, organizadorId: string) {
  const [perfil] = await db
    .select({
      id: organizadores.id,
      nombre: organizadores.nombre,
      whatsapp: organizadores.whatsapp,
      datosPago: organizadores.datosPago,
      logoVersion: sql<string | null>`left(md5(${organizadores.logo}), 8)`,
    })
    .from(organizadores)
    .where(eq(organizadores.id, organizadorId));
  if (!perfil) throw new ErrorDeNegocio("El organizador no existe.");
  return perfil;
}

export async function actualizarPerfil(db: Db, organizadorId: string, datos: DatosPerfil) {
  await db.update(organizadores).set(datos).where(eq(organizadores.id, organizadorId));
}

/** Guarda el logo en la base después de revisar su tamaño y su tipo real. */
export async function guardarLogo(db: Db, organizadorId: string, bytes: Uint8Array) {
  if (bytes.length === 0) throw new ErrorDeNegocio("Elige una imagen.");
  if (bytes.length > LOGO_MAXIMO_BYTES) {
    throw new ErrorDeNegocio("El logo pesa más de 256 KB; usa una imagen más pequeña.");
  }
  const tipo = tipoDeImagen(bytes);
  if (!tipo) throw new ErrorDeNegocio("El logo debe ser PNG, JPG o WebP.");

  await db
    .update(organizadores)
    .set({ logo: Buffer.from(bytes), logoTipo: tipo })
    .where(eq(organizadores.id, organizadorId));
}

export async function quitarLogo(db: Db, organizadorId: string) {
  await db
    .update(organizadores)
    .set({ logo: null, logoTipo: null })
    .where(eq(organizadores.id, organizadorId));
}

/** Logo para incrustarlo en los PDF (jsPDF solo acepta PNG y JPEG de forma nativa). */
export async function logoParaPdf(db: Db, organizadorId: string) {
  const [fila] = await db
    .select({ logo: organizadores.logo, tipo: organizadores.logoTipo })
    .from(organizadores)
    .where(eq(organizadores.id, organizadorId));
  if (!fila?.logo || (fila.tipo !== "image/png" && fila.tipo !== "image/jpeg")) return undefined;
  return { datos: new Uint8Array(fila.logo), formato: fila.tipo === "image/png" ? "PNG" : "JPEG" } as const;
}

import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { numerosEstado, rifas } from "@/db/schema";

/**
 * Rifas del organizador con el conteo de sus números por estado, de la más reciente a la más antigua.
 * Los apartados vencidos se cuentan aparte, así que los cuatro conteos suman el total de números.
 */
export async function listarRifasConResumen(db: Db, organizadorId: string) {
  return db
    .select({
      id: rifas.id,
      nombre: rifas.nombre,
      estado: rifas.estado,
      precioNumero: rifas.precioNumero,
      cantidadNumeros: rifas.cantidadNumeros,
      liberacionAutomatica: rifas.liberacionAutomatica,
      fechaSorteo: rifas.fechaSorteo,
      disponibles: sql<number>`count(*) filter (where ${numerosEstado.estado} = 'disponible')::int`,
      apartados: sql<number>`count(*) filter (where ${numerosEstado.estado} = 'apartado' and not ${numerosEstado.vencido})::int`,
      vencidos: sql<number>`count(*) filter (where ${numerosEstado.vencido})::int`,
      vendidos: sql<number>`count(*) filter (where ${numerosEstado.estado} = 'vendido')::int`,
    })
    .from(rifas)
    .innerJoin(numerosEstado, eq(numerosEstado.rifaId, rifas.id))
    .where(eq(rifas.organizadorId, organizadorId))
    .groupBy(rifas.id)
    .orderBy(desc(rifas.creadoEn));
}

export type RifaConResumen = Awaited<ReturnType<typeof listarRifasConResumen>>[number];

/** Una rifa del organizador, o null si no existe o es de otro organizador. */
export async function obtenerRifa(db: Db, rifaId: string, organizadorId: string) {
  const [rifa] = await db
    .select()
    .from(rifas)
    .where(and(eq(rifas.id, rifaId), eq(rifas.organizadorId, organizadorId)));
  return rifa ?? null;
}

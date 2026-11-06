import { and, desc, eq, ne, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import {
  asignaciones,
  compradores,
  movimientos,
  numeros,
  numerosEstado,
  rifas,
  usuarios,
} from "@/db/schema";

/**
 * Rifas del organizador con el conteo de sus números por estado y el dinero cobrado y por
 * cobrar, de la más reciente a la más antigua. Los apartados vencidos se cuentan aparte, así
 * que los cuatro conteos suman el total de números. Los montos son el precio guardado en cada
 * asignación (texto con dos decimales).
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
      cobrado: sql<string>`coalesce(sum(${numerosEstado.monto}) filter (where ${numerosEstado.estadoPago} = 'confirmado'), 0)::numeric(14, 2)`,
      porCobrar: sql<string>`coalesce(sum(${numerosEstado.monto}) filter (where ${numerosEstado.estadoPago} = 'pendiente'), 0)::numeric(14, 2)`,
      porCobrarVencido: sql<string>`coalesce(sum(${numerosEstado.monto}) filter (where ${numerosEstado.vencido}), 0)::numeric(14, 2)`,
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

/**
 * Números ocupados (apartados o vendidos) de una rifa con los datos de su asignación vigente.
 * Los disponibles no se envían: el tablero los deduce del rango de la rifa.
 */
export async function listarOcupados(db: Db, rifaId: string) {
  return db
    .select({
      numero: numerosEstado.numero,
      asignacionId: numerosEstado.asignacionId,
      estado: numerosEstado.estado,
      vencido: numerosEstado.vencido,
      estadoPago: numerosEstado.estadoPago,
      compradorId: numerosEstado.compradorId,
      compradorNombre: numerosEstado.compradorNombre,
      compradorTelefono: numerosEstado.compradorTelefono,
      monto: numerosEstado.monto,
      fechaLimite: numerosEstado.fechaLimite,
      fechaPago: numerosEstado.fechaPago,
      asignadoEn: numerosEstado.asignadoEn,
      observaciones: numerosEstado.observaciones,
    })
    .from(numerosEstado)
    .where(and(eq(numerosEstado.rifaId, rifaId), ne(numerosEstado.estado, "disponible")))
    .orderBy(numerosEstado.numero);
}

export type NumeroOcupado = Awaited<ReturnType<typeof listarOcupados>>[number];

export type TipoMovimiento = (typeof movimientos.$inferSelect)["tipo"];

export type FiltroMovimientos = {
  tipo?: TipoMovimiento;
  numero?: number;
  /** Id del último movimiento de la página anterior: devuelve los anteriores a él. */
  antesDe?: number;
  limite?: number;
};

/**
 * Historial de una rifa, del más reciente al más antiguo, con el número, el comprador y el
 * usuario que hizo cada operación (null si fue el sistema). Paginado por cursor.
 */
export async function listarMovimientos(
  db: Db,
  rifaId: string,
  { tipo, numero, antesDe, limite = 100 }: FiltroMovimientos = {},
) {
  const filas = await db
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      creadoEn: movimientos.creadoEn,
      detalle: movimientos.detalle,
      numero: numeros.numero,
      comprador: compradores.nombre,
      usuario: usuarios.name,
    })
    .from(movimientos)
    .innerJoin(numeros, eq(numeros.id, movimientos.numeroId))
    .innerJoin(asignaciones, eq(asignaciones.id, movimientos.asignacionId))
    .innerJoin(compradores, eq(compradores.id, asignaciones.compradorId))
    .leftJoin(usuarios, eq(usuarios.id, movimientos.usuarioId))
    .where(
      and(
        eq(movimientos.rifaId, rifaId),
        tipo ? eq(movimientos.tipo, tipo) : undefined,
        numero !== undefined ? eq(numeros.numero, numero) : undefined,
        // Se ordena por fecha y, a igual fecha, por id; el cursor compara la misma pareja.
        antesDe
          ? sql`(${movimientos.creadoEn}, ${movimientos.id}) < (select creado_en, id from movimientos where id = ${antesDe})`
          : undefined,
      ),
    )
    .orderBy(desc(movimientos.creadoEn), desc(movimientos.id))
    .limit(limite + 1);

  const pagina = filas.slice(0, limite);
  return {
    movimientos: pagina,
    siguiente: filas.length > limite ? pagina[pagina.length - 1].id : null,
  };
}

export type Movimiento = Awaited<ReturnType<typeof listarMovimientos>>["movimientos"][number];

/** Todos los números de la rifa con su estado y asignación vigente, en orden, para los PDF. */
export async function listarNumerosParaPdf(db: Db, rifaId: string) {
  return db
    .select({
      numero: numerosEstado.numero,
      estado: numerosEstado.estado,
      vencido: numerosEstado.vencido,
      estadoPago: numerosEstado.estadoPago,
      compradorNombre: numerosEstado.compradorNombre,
      compradorTelefono: numerosEstado.compradorTelefono,
      monto: numerosEstado.monto,
      asignadoEn: numerosEstado.asignadoEn,
      fechaLimite: numerosEstado.fechaLimite,
      fechaPago: numerosEstado.fechaPago,
    })
    .from(numerosEstado)
    .where(eq(numerosEstado.rifaId, rifaId))
    .orderBy(numerosEstado.numero);
}

export type NumeroParaPdf = Awaited<ReturnType<typeof listarNumerosParaPdf>>[number];

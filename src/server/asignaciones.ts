import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db, Tx } from "@/db/client";
import { asignaciones, compradores, movimientos, numeros, rifas } from "@/db/schema";
import { formatearNumero } from "@/lib/numeros";

import { AsignacionesNoVigentesError, ErrorDeNegocio, NumerosNoDisponiblesError } from "./errores";

export type Asignacion = typeof asignaciones.$inferSelect;
type TipoMovimiento = (typeof movimientos.$inferInsert)["tipo"];

export type DatosComprador =
  | { id: string }
  | { nombre: string; telefono?: string | null; notas?: string | null };

export type ApartarNumeros = {
  rifaId: string;
  numeros: number[];
  comprador: DatosComprador;
  /** Venta directa: el pago se recibe en el momento y los números quedan vendidos. */
  pagoConfirmado?: boolean;
  /** Horas para pagar. Predeterminado: el plazo configurado en la rifa. */
  plazoHoras?: number;
  observaciones?: string | null;
  usuarioId?: string | null;
};

type OperacionSobreAsignaciones = {
  asignacionIds: string[];
  usuarioId?: string | null;
};

/**
 * Aparta (o vende, con pagoConfirmado) uno o varios números para un comprador.
 * Todo o nada: si alguno ya está ocupado no se aparta ninguno y se lanza NumerosNoDisponiblesError.
 */
export async function apartarNumeros(db: Db, datos: ApartarNumeros): Promise<Asignacion[]> {
  // Orden ascendente fijo: dos apartados simultáneos con números en común toman los
  // bloqueos en el mismo orden y no pueden interbloquearse.
  const pedidos = [...new Set(datos.numeros)].sort((a, b) => a - b);
  if (pedidos.length === 0) {
    throw new ErrorDeNegocio("Selecciona al menos un número.");
  }

  return db.transaction(async (tx) => {
    // FOR SHARE: varios apartados pueden correr juntos, pero ninguno mientras alguien cambia
    // el rango de la rifa (actualizarRifa la toma con FOR UPDATE).
    const [rifa] = await tx.select().from(rifas).where(eq(rifas.id, datos.rifaId)).for("share");
    if (!rifa) throw new ErrorDeNegocio("La rifa no existe.");
    if (rifa.estado !== "activa") throw new ErrorDeNegocio("La rifa está cerrada.");

    const plazoHoras = datos.plazoHoras ?? rifa.plazoApartadoHoras;
    if (!Number.isInteger(plazoHoras) || plazoHoras <= 0) {
      throw new ErrorDeNegocio("El plazo para pagar debe ser de al menos una hora.");
    }

    const filas = await tx
      .select({ id: numeros.id, numero: numeros.numero })
      .from(numeros)
      .where(and(eq(numeros.rifaId, rifa.id), inArray(numeros.numero, pedidos)))
      .orderBy(numeros.numero);
    if (filas.length !== pedidos.length) {
      const existentes = new Set(filas.map((f) => f.numero));
      const faltantes = pedidos
        .filter((n) => !existentes.has(n))
        .map((n) => formatearNumero(n, rifa.digitos));
      throw new ErrorDeNegocio(`La rifa no tiene los números ${faltantes.join(", ")}.`);
    }

    const compradorId = await resolverComprador(tx, rifa.organizadorId, datos.comprador);
    const pagado = datos.pagoConfirmado ?? false;

    // El índice asignaciones_vigente_por_numero impide dos asignaciones vigentes del mismo
    // número; con "do nothing" sabemos exactamente cuáles ya estaban ocupados.
    const creadas = await tx
      .insert(asignaciones)
      .values(
        filas.map((f) => ({
          rifaId: rifa.id,
          numeroId: f.id,
          compradorId,
          estado: pagado ? ("vendido" as const) : ("apartado" as const),
          estadoPago: pagado ? ("confirmado" as const) : ("pendiente" as const),
          monto: rifa.precioNumero,
          // Las fechas se calculan con el reloj de la base, no con el del servidor web.
          fechaLimite: pagado ? null : sql`now() + make_interval(hours => ${plazoHoras}::int)`,
          fechaPago: pagado ? sql`now()` : null,
          observaciones: datos.observaciones?.trim() || null,
          creadaPor: datos.usuarioId ?? null,
        })),
      )
      .onConflictDoNothing({
        target: asignaciones.numeroId,
        where: sql`estado in ('apartado', 'vendido')`,
      })
      .returning();

    if (creadas.length !== filas.length) {
      const asignados = new Set(creadas.map((a) => a.numeroId));
      const ocupados = filas.filter((f) => !asignados.has(f.id)).map((f) => f.numero);
      throw new NumerosNoDisponiblesError(ocupados, rifa.digitos);
    }

    await registrarMovimientos(tx, pagado ? "venta" : "apartado", creadas, datos.usuarioId, (a) => ({
      monto: a.monto,
      fechaLimite: a.fechaLimite,
    }));

    return creadas;
  });
}

/** Confirma el pago de apartados (o ventas) pendientes. Todo o nada. */
export async function confirmarPago(
  db: Db,
  { asignacionIds, usuarioId }: OperacionSobreAsignaciones,
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    const pagadas = await tx
      .update(asignaciones)
      .set({ estado: "vendido", estadoPago: "confirmado", fechaPago: sql`now()` })
      .where(
        and(
          inArray(asignaciones.id, ids),
          inArray(asignaciones.estado, ["apartado", "vendido"]),
          eq(asignaciones.estadoPago, "pendiente"),
        ),
      )
      .returning();

    exigirTodas(
      ids,
      pagadas,
      "No se pudo confirmar el pago: algún apartado ya fue liberado, cancelado o pagado.",
    );
    await registrarMovimientos(tx, "pago_confirmado", pagadas, usuarioId, (a) => ({
      monto: a.monto,
    }));
    return pagadas;
  });
}

/** Libera apartados con pago pendiente para que el número vuelva a estar disponible. Todo o nada. */
export async function liberarAsignaciones(
  db: Db,
  { asignacionIds, usuarioId }: OperacionSobreAsignaciones,
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    const liberadas = await tx
      .update(asignaciones)
      .set({ estado: "liberado", finalizadaEn: sql`now()` })
      .where(
        and(
          inArray(asignaciones.id, ids),
          eq(asignaciones.estado, "apartado"),
          eq(asignaciones.estadoPago, "pendiente"),
        ),
      )
      .returning();

    exigirTodas(
      ids,
      liberadas,
      "No se pudo liberar: algún apartado ya fue pagado, liberado o cancelado.",
    );
    await registrarMovimientos(tx, "liberacion_manual", liberadas, usuarioId, (a) => ({
      fechaLimite: a.fechaLimite,
    }));
    return liberadas;
  });
}

/** Cancela apartados o ventas (por ejemplo, el comprador desistió o fue un error de captura). Todo o nada. */
export async function cancelarAsignaciones(
  db: Db,
  { asignacionIds, usuarioId, motivo }: OperacionSobreAsignaciones & { motivo?: string | null },
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    const canceladas = await tx
      .update(asignaciones)
      .set({ estado: "cancelado", finalizadaEn: sql`now()` })
      .where(
        and(inArray(asignaciones.id, ids), inArray(asignaciones.estado, ["apartado", "vendido"])),
      )
      .returning();

    exigirTodas(ids, canceladas, "No se pudo cancelar: alguna asignación ya fue liberada o cancelada.");
    await registrarMovimientos(tx, "cancelacion", canceladas, usuarioId, (a) => ({
      motivo: motivo?.trim() || null,
      estadoPago: a.estadoPago,
    }));
    return canceladas;
  });
}

/**
 * Libera los apartados vencidos de las rifas con liberación automática.
 * La lógica vive en la función SQL liberar_apartados_vencidos() para que un cron
 * de la base (pg_cron) pueda ejecutarla sin pasar por la app.
 */
export async function liberarApartadosVencidos(db: Db): Promise<number> {
  const [fila] = await db.execute<{ liberados: number }>(
    sql`select liberar_apartados_vencidos() as liberados`,
  );
  return fila.liberados;
}

async function resolverComprador(tx: Tx, organizadorId: string, comprador: DatosComprador) {
  if ("id" in comprador) {
    const [existente] = await tx
      .select({ id: compradores.id })
      .from(compradores)
      .where(and(eq(compradores.id, comprador.id), eq(compradores.organizadorId, organizadorId)));
    if (!existente) throw new ErrorDeNegocio("El comprador no existe.");
    return existente.id;
  }

  const nombre = comprador.nombre.trim();
  if (!nombre) throw new ErrorDeNegocio("Escribe el nombre del comprador.");

  const [nuevo] = await tx
    .insert(compradores)
    .values({
      organizadorId,
      nombre,
      telefono: comprador.telefono?.trim() || null,
      notas: comprador.notas?.trim() || null,
    })
    .returning({ id: compradores.id });
  return nuevo.id;
}

async function registrarMovimientos(
  tx: Tx,
  tipo: TipoMovimiento,
  lista: Asignacion[],
  usuarioId: string | null | undefined,
  detalle: (a: Asignacion) => Record<string, unknown>,
) {
  if (lista.length === 0) return;
  await tx.insert(movimientos).values(
    lista.map((a) => ({
      rifaId: a.rifaId,
      numeroId: a.numeroId,
      asignacionId: a.id,
      tipo,
      usuarioId: usuarioId ?? null,
      detalle: detalle(a),
    })),
  );
}

function idsUnicos(ids: string[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) throw new ErrorDeNegocio("Selecciona al menos un apartado.");
  return unicos;
}

// Lanzar dentro de la transacción la revierte: no se modifica ninguna asignación.
function exigirTodas(ids: string[], afectadas: Asignacion[], mensaje: string) {
  if (afectadas.length === ids.length) return;
  const afectadasIds = new Set(afectadas.map((a) => a.id));
  throw new AsignacionesNoVigentesError(
    ids.filter((id) => !afectadasIds.has(id)),
    mensaje,
  );
}

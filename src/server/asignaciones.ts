import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db, Tx } from "@/db/client";
import { asignaciones, compradores, movimientos, numeros, rifas } from "@/db/schema";
import { formatearNumero } from "@/lib/numeros";
import { normalizarTelefono } from "@/lib/telefono";

import { AsignacionesNoVigentesError, ErrorDeNegocio, NumerosNoDisponiblesError } from "./errores";
import { bloquearPedidoPorToken, crearPedido } from "./pedidos";

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
  /** Usuario que lo captura; queda como vendedor del pedido. */
  usuarioId?: string | null;
  /** Predeterminado: "interno" si hay usuario, "publico" si no. */
  origen?: "publico" | "interno";
  /** Si ya existe un comprador del organizador con ese teléfono, se reutiliza (página pública). */
  reutilizarCompradorPorTelefono?: boolean;
};

type OperacionSobreAsignaciones = {
  asignacionIds: string[];
  usuarioId?: string | null;
  /** Si se indica, solo se tocan asignaciones de esa rifa (las demás cuentan como no vigentes). */
  rifaId?: string;
};

/**
 * Aparta (o vende, con pagoConfirmado) uno o varios números para un comprador y los agrupa en
 * un pedido nuevo (folio + enlace secreto). Cada asignación devuelta trae su pedidoId.
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
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada.");
    if (rifa.estado !== "activa") throw new ErrorDeNegocio("Las ventas de esta rifa están cerradas.");

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

    const compradorId = await resolverComprador(
      tx,
      rifa.organizadorId,
      datos.comprador,
      datos.reutilizarCompradorPorTelefono ?? false,
    );
    const pagado = datos.pagoConfirmado ?? false;
    const origen = datos.origen ?? (datos.usuarioId ? "interno" : "publico");
    const pedido = await crearPedido(tx, {
      rifaId: rifa.id,
      compradorId,
      origen,
      vendedorId: origen === "interno" ? (datos.usuarioId ?? null) : null,
    });

    // El índice asignaciones_vigente_por_numero impide dos asignaciones vigentes del mismo
    // número; con "do nothing" sabemos exactamente cuáles ya estaban ocupados.
    const creadas = await tx
      .insert(asignaciones)
      .values(
        filas.map((f) => ({
          rifaId: rifa.id,
          numeroId: f.id,
          pedidoId: pedido.id,
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
      folio: pedido.folio,
      origen,
      monto: a.monto,
      fechaLimite: a.fechaLimite,
    }));

    return creadas;
  });
}

/** Confirma el pago de apartados (o ventas) pendientes. Todo o nada. */
export async function confirmarPago(
  db: Db,
  { asignacionIds, usuarioId, rifaId }: OperacionSobreAsignaciones,
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    await exigirRifasModificables(tx, ids);
    const pagadas = await tx
      .update(asignaciones)
      .set({ estado: "vendido", estadoPago: "confirmado", fechaPago: sql`now()` })
      .where(
        and(
          inArray(asignaciones.id, ids),
          rifaId ? eq(asignaciones.rifaId, rifaId) : undefined,
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
  { asignacionIds, usuarioId, rifaId }: OperacionSobreAsignaciones,
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    await exigirRifasModificables(tx, ids);
    const liberadas = await tx
      .update(asignaciones)
      .set({ estado: "liberado", finalizadaEn: sql`now()` })
      .where(
        and(
          inArray(asignaciones.id, ids),
          rifaId ? eq(asignaciones.rifaId, rifaId) : undefined,
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

/**
 * Cancela apartados o ventas (por ejemplo, el comprador desistió o fue un error de captura). Todo o nada.
 * Con soloPendientes no toca números ya pagados (así cancela un operador; las devoluciones son del admin).
 */
export async function cancelarAsignaciones(
  db: Db,
  {
    asignacionIds,
    usuarioId,
    rifaId,
    motivo,
    soloPendientes = false,
  }: OperacionSobreAsignaciones & { motivo?: string | null; soloPendientes?: boolean },
): Promise<Asignacion[]> {
  const ids = idsUnicos(asignacionIds);

  return db.transaction(async (tx) => {
    await exigirRifasModificables(tx, ids);
    const canceladas = await tx
      .update(asignaciones)
      .set({ estado: "cancelado", finalizadaEn: sql`now()` })
      .where(
        and(
          inArray(asignaciones.id, ids),
          rifaId ? eq(asignaciones.rifaId, rifaId) : undefined,
          inArray(asignaciones.estado, ["apartado", "vendido"]),
          soloPendientes ? eq(asignaciones.estadoPago, "pendiente") : undefined,
        ),
      )
      .returning();

    exigirTodas(
      ids,
      canceladas,
      soloPendientes
        ? "No se pudo cancelar: algún número ya está pagado (solo un administrador cancela ventas pagadas) o ya no está vigente."
        : "No se pudo cancelar: alguna asignación ya fue liberada o cancelada.",
    );
    await registrarMovimientos(tx, "cancelacion", canceladas, usuarioId, (a) => ({
      motivo: motivo?.trim() || null,
      estadoPago: a.estadoPago,
    }));
    return canceladas;
  });
}

/**
 * El comprador cancela, desde el enlace secreto de su pedido, los apartados que aún no ha pagado.
 * Los números vuelven a estar disponibles. Devuelve cuántos canceló.
 */
export async function cancelarPedidoPorComprador(db: Db, token: string): Promise<number> {
  return db.transaction(async (tx) => {
    const pedido = await bloquearPedidoPorToken(tx, token);
    if (!pedido) throw new ErrorDeNegocio("El pedido no existe.");
    const [rifa] = await tx
      .select({ estado: rifas.estado })
      .from(rifas)
      .where(eq(rifas.id, pedido.rifaId));
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada.");

    const canceladas = await tx
      .update(asignaciones)
      .set({ estado: "cancelado", finalizadaEn: sql`now()` })
      .where(
        and(
          eq(asignaciones.pedidoId, pedido.id),
          eq(asignaciones.estado, "apartado"),
          eq(asignaciones.estadoPago, "pendiente"),
        ),
      )
      .returning();
    if (canceladas.length === 0) {
      throw new ErrorDeNegocio("Este pedido ya no tiene apartados pendientes de pago.");
    }
    await registrarMovimientos(tx, "cancelacion_comprador", canceladas, null, () => ({
      folio: pedido.folio,
    }));
    return canceladas.length;
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

async function resolverComprador(
  tx: Tx,
  organizadorId: string,
  comprador: DatosComprador,
  reutilizarPorTelefono: boolean,
) {
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
  const telefono = comprador.telefono?.trim() || null;
  const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : null;

  if (reutilizarPorTelefono && telefonoNormalizado) {
    const [existente] = await tx
      .select({ id: compradores.id })
      .from(compradores)
      .where(
        and(
          eq(compradores.organizadorId, organizadorId),
          eq(compradores.telefonoNormalizado, telefonoNormalizado),
        ),
      )
      .orderBy(sql`${compradores.creadoEn} desc`)
      .limit(1);
    if (existente) return existente.id;
  }

  const [nuevo] = await tx
    .insert(compradores)
    .values({
      organizadorId,
      nombre,
      telefono,
      telefonoNormalizado,
      notas: comprador.notas?.trim() || null,
    })
    .returning({ id: compradores.id });
  return nuevo.id;
}

// Una rifa sorteada es de solo lectura (también lo impide un trigger en la base).
async function exigirRifasModificables(tx: Tx, asignacionIds: string[]) {
  const [sorteada] = await tx
    .select({ id: rifas.id })
    .from(asignaciones)
    .innerJoin(rifas, eq(rifas.id, asignaciones.rifaId))
    .where(and(inArray(asignaciones.id, asignacionIds), eq(rifas.estado, "sorteada")))
    .limit(1);
  if (sorteada) {
    throw new ErrorDeNegocio("La rifa ya fue sorteada; sus números ya no se pueden modificar.");
  }
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

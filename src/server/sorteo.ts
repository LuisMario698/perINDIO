import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { asignaciones, compradores, numeros, pedidos, premios, rifas } from "@/db/schema";

import { liberarAsignaciones } from "./asignaciones";
import { formatearNumero } from "@/lib/numeros";

import { ErrorDeNegocio } from "./errores";
import { bloquearRifa } from "./rifas";

export const MAXIMO_PREMIOS = 20;

/** Premios de la rifa con los datos completos del ganador (solo para el panel). */
export async function listarPremios(db: Db, rifaId: string) {
  return db
    .select({
      id: premios.id,
      lugar: premios.lugar,
      descripcion: premios.descripcion,
      numeroGanador: premios.numeroGanador,
      ganador: compradores.nombre,
      telefono: compradores.telefono,
      estadoPago: asignaciones.estadoPago,
      folio: pedidos.folio,
      token: pedidos.token,
    })
    .from(premios)
    .leftJoin(asignaciones, eq(asignaciones.id, premios.asignacionGanadoraId))
    .leftJoin(compradores, eq(compradores.id, asignaciones.compradorId))
    .leftJoin(pedidos, eq(pedidos.id, asignaciones.pedidoId))
    .where(eq(premios.rifaId, rifaId))
    .orderBy(asc(premios.lugar));
}

export type PremioDelPanel = Awaited<ReturnType<typeof listarPremios>>[number];

/** Reemplaza la lista de premios (el orden es el lugar). Solo antes del sorteo. */
export async function guardarPremios(
  db: Db,
  organizadorId: string,
  rifaId: string,
  descripciones: string[],
) {
  const lista = descripciones.map((d) => d.trim()).filter(Boolean);
  if (lista.length > MAXIMO_PREMIOS) throw new ErrorDeNegocio(`Máximo ${MAXIMO_PREMIOS} premios.`);
  if (lista.some((d) => d.length > 200)) throw new ErrorDeNegocio("Cada premio admite hasta 200 caracteres.");

  await db.transaction(async (tx) => {
    const rifa = await bloquearRifa(tx, rifaId, organizadorId);
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada; los premios quedan fijos.");
    await tx.delete(premios).where(eq(premios.rifaId, rifaId));
    if (lista.length > 0) {
      await tx.insert(premios).values(lista.map((descripcion, i) => ({ rifaId, lugar: i + 1, descripcion })));
    }
  });
}

/**
 * Cierra las ventas: ya nadie puede apartar (ni en el panel ni en la página pública).
 * Con liberarPendientes, los apartados sin pagar vuelven a estar libres antes del sorteo.
 */
export async function cerrarVentas(
  db: Db,
  { organizadorId, rifaId, usuarioId, liberarPendientes }: {
    organizadorId: string;
    rifaId: string;
    usuarioId: string;
    liberarPendientes: boolean;
  },
) {
  await db.transaction(async (tx) => {
    const rifa = await bloquearRifa(tx, rifaId, organizadorId);
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada.");
    await tx.update(rifas).set({ estado: "cerrada" }).where(eq(rifas.id, rifaId));
  });
  if (!liberarPendientes) return 0;

  const pendientes = await db
    .select({ id: asignaciones.id })
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.rifaId, rifaId),
        eq(asignaciones.estado, "apartado"),
        eq(asignaciones.estadoPago, "pendiente"),
      ),
    );
  if (pendientes.length === 0) return 0;
  const liberadas = await liberarAsignaciones(db, {
    asignacionIds: pendientes.map((p) => p.id),
    usuarioId,
    rifaId,
  });
  return liberadas.length;
}

export async function reabrirVentas(db: Db, organizadorId: string, rifaId: string) {
  await db.transaction(async (tx) => {
    const rifa = await bloquearRifa(tx, rifaId, organizadorId);
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada; no se puede reabrir.");
    await tx.update(rifas).set({ estado: "activa" }).where(eq(rifas.id, rifaId));
  });
}

export type ResultadoSorteo =
  | { registrado: true }
  /** Nada se guardó: hay números ganadores sin pagar o sin comprador; se pide confirmar. */
  | { registrado: false; advertencias: string[] };

/**
 * Registra el número ganador de cada premio y deja la rifa como sorteada (solo lectura).
 * Si algún número está libre o sin pagar, no guarda nada y devuelve advertencias, salvo que
 * se confirme con aunqueNoEstenPagados.
 */
export async function registrarResultado(
  db: Db,
  {
    organizadorId,
    rifaId,
    ganadores,
    aunqueNoEstenPagados = false,
  }: {
    organizadorId: string;
    rifaId: string;
    /** premioId → número ganador */
    ganadores: Record<string, number>;
    aunqueNoEstenPagados?: boolean;
  },
): Promise<ResultadoSorteo> {
  return db.transaction(async (tx) => {
    const rifa = await bloquearRifa(tx, rifaId, organizadorId);
    if (rifa.estado === "sorteada") throw new ErrorDeNegocio("La rifa ya fue sorteada.");
    if (rifa.estado !== "cerrada") {
      throw new ErrorDeNegocio("Primero cierra las ventas para que nadie aparte durante el sorteo.");
    }

    const lista = await tx.select().from(premios).where(eq(premios.rifaId, rifaId)).orderBy(asc(premios.lugar));
    if (lista.length === 0) throw new ErrorDeNegocio("Agrega al menos un premio antes de registrar el resultado.");

    const ultimo = rifa.numeroInicial + rifa.cantidadNumeros - 1;
    const elegidos = lista.map((p) => ({ premio: p, numero: ganadores[p.id] }));
    for (const { premio, numero } of elegidos) {
      if (!Number.isInteger(numero) || numero < rifa.numeroInicial || numero > ultimo) {
        throw new ErrorDeNegocio(
          `El número del ${premio.lugar}.º lugar debe estar entre ${formatearNumero(rifa.numeroInicial, rifa.digitos)} y ${formatearNumero(ultimo, rifa.digitos)}.`,
        );
      }
    }
    if (new Set(elegidos.map((e) => e.numero)).size !== elegidos.length) {
      throw new ErrorDeNegocio("Un mismo número no puede ganar dos premios.");
    }

    // Asignación vigente de cada número ganador (si la hay).
    const vigentes = await tx
      .select({
        id: asignaciones.id,
        numero: numeros.numero,
        estadoPago: asignaciones.estadoPago,
      })
      .from(asignaciones)
      .innerJoin(numeros, eq(numeros.id, asignaciones.numeroId))
      .where(
        and(
          eq(asignaciones.rifaId, rifaId),
          inArray(asignaciones.estado, ["apartado", "vendido"]),
          inArray(
            numeros.numero,
            elegidos.map((e) => e.numero),
          ),
        ),
      );
    const porNumero = new Map(vigentes.map((v) => [v.numero, v]));

    const advertencias = elegidos.flatMap(({ premio, numero }) => {
      const asignacion = porNumero.get(numero);
      const etiqueta = formatearNumero(numero, rifa.digitos);
      if (!asignacion) return [`${premio.lugar}.º lugar: el número ${etiqueta} no tiene comprador.`];
      if (asignacion.estadoPago !== "confirmado") {
        return [`${premio.lugar}.º lugar: el número ${etiqueta} está apartado pero no pagado.`];
      }
      return [];
    });
    if (advertencias.length > 0 && !aunqueNoEstenPagados) return { registrado: false, advertencias };

    for (const { premio, numero } of elegidos) {
      await tx
        .update(premios)
        .set({ numeroGanador: numero, asignacionGanadoraId: porNumero.get(numero)?.id ?? null })
        .where(eq(premios.id, premio.id));
    }
    await tx
      .update(rifas)
      .set({ estado: "sorteada", sorteadaEn: sql`now()` })
      .where(eq(rifas.id, rifaId));
    return { registrado: true };
  });
}

import { and, eq, sql } from "drizzle-orm";

import type { Db, Tx } from "@/db/client";
import { asignaciones, numeros, rifas } from "@/db/schema";
import { digitosNecesarios } from "@/lib/numeros";

import { ErrorDeNegocio } from "./errores";

export type NuevaRifa = {
  organizadorId: string;
  nombre: string;
  descripcion?: string | null;
  /** Primer número de la rifa. Predeterminado: 0. */
  numeroInicial?: number;
  cantidadNumeros: number;
  /** Predeterminado: los necesarios para el último número (0–1999 → 4 dígitos). */
  digitos?: number;
  precioNumero: string | number;
  plazoApartadoHoras?: number;
  liberacionAutomatica?: boolean;
  /** Día del sorteo, "AAAA-MM-DD". */
  fechaSorteo?: string | null;
};

/** Todo lo que se puede configurar de una rifa existente. */
export type ConfiguracionRifa = {
  nombre: string;
  descripcion: string | null;
  numeroInicial: number;
  cantidadNumeros: number;
  digitos: number;
  precioNumero: string;
  plazoApartadoHoras: number;
  liberacionAutomatica: boolean;
  fechaSorteo: string | null;
  estado: "activa" | "cerrada";
};

/** Crea la rifa y genera todos sus números en la misma transacción. */
export async function crearRifa(db: Db, datos: NuevaRifa) {
  const numeroInicial = datos.numeroInicial ?? 0;
  const ultimoNumero = numeroInicial + datos.cantidadNumeros - 1;

  return db.transaction(async (tx) => {
    const [rifa] = await tx
      .insert(rifas)
      .values({
        organizadorId: datos.organizadorId,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        numeroInicial,
        cantidadNumeros: datos.cantidadNumeros,
        digitos: datos.digitos ?? digitosNecesarios(ultimoNumero),
        precioNumero: String(datos.precioNumero),
        plazoApartadoHoras: datos.plazoApartadoHoras,
        liberacionAutomatica: datos.liberacionAutomatica,
        fechaSorteo: datos.fechaSorteo ?? null,
      })
      .returning();

    await generarNumeros(tx, rifa.id, numeroInicial, datos.cantidadNumeros);
    return rifa;
  });
}

/**
 * Guarda la configuración de una rifa del organizador.
 * El rango y los dígitos solo se pueden cambiar mientras la rifa no tenga ninguna asignación
 * (ni siquiera liberada o cancelada), porque regenerarlos borraría ese historial.
 * El precio nuevo solo aplica a los apartados que se hagan después.
 */
export async function actualizarRifa(
  db: Db,
  rifaId: string,
  organizadorId: string,
  datos: ConfiguracionRifa,
) {
  return db.transaction(async (tx) => {
    const actual = await bloquearRifa(tx, rifaId, organizadorId);

    const cambiaRango =
      actual.numeroInicial !== datos.numeroInicial ||
      actual.cantidadNumeros !== datos.cantidadNumeros;
    if ((cambiaRango || actual.digitos !== datos.digitos) && (await tieneAsignaciones(tx, rifaId))) {
      throw new ErrorDeNegocio(
        "Esta rifa ya tiene números apartados o vendidos, así que el rango y los dígitos ya no se pueden cambiar.",
      );
    }

    const [rifa] = await tx
      .update(rifas)
      .set({ ...datos, nombre: datos.nombre.trim(), descripcion: datos.descripcion?.trim() || null })
      .where(eq(rifas.id, rifaId))
      .returning();

    if (cambiaRango) {
      await tx.delete(numeros).where(eq(numeros.rifaId, rifaId));
      await generarNumeros(tx, rifaId, datos.numeroInicial, datos.cantidadNumeros);
    }
    return rifa;
  });
}

/** Elimina una rifa del organizador con sus números. Solo si nunca tuvo asignaciones. */
export async function eliminarRifa(db: Db, rifaId: string, organizadorId: string) {
  await db.transaction(async (tx) => {
    await bloquearRifa(tx, rifaId, organizadorId);
    if (await tieneAsignaciones(tx, rifaId)) {
      throw new ErrorDeNegocio(
        "Esta rifa ya tiene números apartados o vendidos y no se puede eliminar. Puedes cerrarla.",
      );
    }
    await tx.delete(rifas).where(eq(rifas.id, rifaId));
  });
}

/** true si la rifa tiene o tuvo alguna asignación (vigente, liberada o cancelada). */
export async function tieneAsignaciones(db: Db | Tx, rifaId: string) {
  const [fila] = await db
    .select({ existe: sql<boolean>`true` })
    .from(asignaciones)
    .where(eq(asignaciones.rifaId, rifaId))
    .limit(1);
  return Boolean(fila);
}

// FOR UPDATE espera a los apartados en curso (que leen la rifa con FOR SHARE) y detiene
// los nuevos hasta terminar, así el rango no cambia a la mitad de un apartado.
async function bloquearRifa(tx: Tx, rifaId: string, organizadorId: string) {
  const [rifa] = await tx
    .select()
    .from(rifas)
    .where(and(eq(rifas.id, rifaId), eq(rifas.organizadorId, organizadorId)))
    .for("update");
  if (!rifa) throw new ErrorDeNegocio("La rifa no existe.");
  return rifa;
}

async function generarNumeros(tx: Tx, rifaId: string, numeroInicial: number, cantidad: number) {
  await tx.execute(sql`
    insert into numeros (rifa_id, numero)
    select ${rifaId}::uuid, n
    from generate_series(${numeroInicial}::int, ${numeroInicial + cantidad - 1}::int) as n
  `);
}

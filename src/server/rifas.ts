import { sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { rifas } from "@/db/schema";
import { digitosNecesarios } from "@/lib/numeros";

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
  fechaSorteo?: Date | null;
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

    await tx.execute(sql`
      insert into numeros (rifa_id, numero)
      select ${rifa.id}::uuid, n from generate_series(${numeroInicial}::int, ${ultimoNumero}::int) as n
    `);

    return rifa;
  });
}

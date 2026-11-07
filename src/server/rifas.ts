import { randomBytes } from "node:crypto";

import { and, eq, like, or, sql } from "drizzle-orm";

import type { Db, Tx } from "@/db/client";
import { asignaciones, numeros, rifas } from "@/db/schema";
import { digitosNecesarios } from "@/lib/numeros";
import { FORMATO_SLUG, slugDe } from "@/lib/slug";

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
  /** Enlace público /r/<slug>. Predeterminado: a partir del nombre. */
  slug?: string;
} & Partial<OpcionesPublicas>;

/** Lo que controla la página pública de la rifa. */
export type OpcionesPublicas = {
  publica: boolean;
  plazoPublicoHoras: number;
  maxNumerosPublico: number;
  instruccionesPago: string | null;
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
  /** Una rifa sorteada ya no se configura; el sorteo se registra aparte. */
  estado: "activa" | "cerrada";
} & Partial<OpcionesPublicas & { slug: string }>;

/** Crea la rifa y genera todos sus números en la misma transacción. */
export async function crearRifa(db: Db, datos: NuevaRifa) {
  const numeroInicial = datos.numeroInicial ?? 0;
  const ultimoNumero = numeroInicial + datos.cantidadNumeros - 1;

  return db.transaction(async (tx) => {
    const slug = datos.slug ? validarSlug(datos.slug) : await slugDisponible(tx, datos.nombre);
    const [rifa] = await tx
      .insert(rifas)
      .values({
        slug,
        publica: datos.publica,
        plazoPublicoHoras: datos.plazoPublicoHoras,
        maxNumerosPublico: datos.maxNumerosPublico,
        instruccionesPago: datos.instruccionesPago?.trim() || null,
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
    if (actual.estado === "sorteada") {
      throw new ErrorDeNegocio("La rifa ya fue sorteada; ya no se puede modificar.");
    }
    if (datos.slug !== undefined && datos.slug !== actual.slug) {
      const slug = validarSlug(datos.slug);
      const [ocupado] = await tx.select({ id: rifas.id }).from(rifas).where(eq(rifas.slug, slug));
      if (ocupado) throw new ErrorDeNegocio("Ese enlace ya lo usa otra rifa; elige otro.");
    }

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
      .set({
        ...datos,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        instruccionesPago:
          datos.instruccionesPago === undefined ? undefined : datos.instruccionesPago?.trim() || null,
      })
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
export async function bloquearRifa(tx: Tx, rifaId: string, organizadorId: string) {
  const [rifa] = await tx
    .select()
    .from(rifas)
    .where(and(eq(rifas.id, rifaId), eq(rifas.organizadorId, organizadorId)))
    .for("update");
  if (!rifa) throw new ErrorDeNegocio("La rifa no existe.");
  return rifa;
}

function validarSlug(slug: string) {
  const limpio = slug.trim().toLowerCase();
  if (!FORMATO_SLUG.test(limpio) || limpio.length < 3 || limpio.length > 60) {
    throw new ErrorDeNegocio(
      "El enlace solo puede tener minúsculas, números y guiones (de 3 a 60 caracteres).",
    );
  }
  return limpio;
}

/** Slug a partir del nombre; si ya existe, le agrega 4 caracteres al azar. */
async function slugDisponible(tx: Tx, nombre: string) {
  const base = slugDe(nombre).length >= 3 ? slugDe(nombre) : "rifa";
  const usados = await tx
    .select({ slug: rifas.slug })
    .from(rifas)
    .where(or(eq(rifas.slug, base), like(rifas.slug, `${base}-%`)));
  if (!usados.some((r) => r.slug === base)) return base;
  for (;;) {
    const candidato = `${base}-${randomBytes(3).toString("hex").slice(0, 4)}`;
    if (!usados.some((r) => r.slug === candidato)) return candidato;
  }
}

async function generarNumeros(tx: Tx, rifaId: string, numeroInicial: number, cantidad: number) {
  await tx.execute(sql`
    insert into numeros (rifa_id, numero)
    select ${rifaId}::uuid, n
    from generate_series(${numeroInicial}::int, ${numeroInicial + cantidad - 1}::int) as n
  `);
}

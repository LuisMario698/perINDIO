"use server";

import { refresh } from "next/cache";

import { db } from "@/db";
import { esUuid } from "@/lib/validacion/rifa";
import { ErrorDeNegocio } from "@/server/errores";
import { obtenerUsuarioActual } from "@/server/sesion";
import { cerrarVentas, guardarPremios, reabrirVentas, registrarResultado } from "@/server/sorteo";

export type EstadoSorteo = { error?: string; mensaje?: string; advertencias?: string[] };

async function contexto(rifaId: string) {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") throw new ErrorDeNegocio("Solo un administrador puede manejar el sorteo.");
  if (!esUuid(rifaId)) throw new ErrorDeNegocio("La rifa no existe.");
  return { usuario, base: { organizadorId: usuario.organizadorId, rifaId } };
}

async function ejecutar(fn: () => Promise<EstadoSorteo>): Promise<EstadoSorteo> {
  try {
    const resultado = await fn();
    refresh();
    return resultado;
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return { error: error.message };
    throw error;
  }
}

export async function guardarPremiosAccion(
  rifaId: string,
  _previo: EstadoSorteo,
  formData: FormData,
): Promise<EstadoSorteo> {
  return ejecutar(async () => {
    const { base } = await contexto(rifaId);
    const lista = formData.getAll("premio").filter((v): v is string => typeof v === "string");
    await guardarPremios(db, base.organizadorId, base.rifaId, lista);
    return { mensaje: "Premios guardados." };
  });
}

export async function cerrarVentasAccion(
  rifaId: string,
  _previo: EstadoSorteo,
  formData: FormData,
): Promise<EstadoSorteo> {
  return ejecutar(async () => {
    const { usuario, base } = await contexto(rifaId);
    const liberados = await cerrarVentas(db, {
      ...base,
      usuarioId: usuario.id,
      liberarPendientes: formData.get("liberar") === "on",
    });
    return {
      mensaje:
        liberados > 0
          ? `Ventas cerradas; ${liberados === 1 ? "se liberó 1 apartado" : `se liberaron ${liberados} apartados`} sin pagar.`
          : "Ventas cerradas.",
    };
  });
}

export async function reabrirVentasAccion(rifaId: string): Promise<EstadoSorteo> {
  return ejecutar(async () => {
    const { base } = await contexto(rifaId);
    await reabrirVentas(db, base.organizadorId, base.rifaId);
    return { mensaje: "Ventas reabiertas." };
  });
}

export async function registrarResultadoAccion(
  rifaId: string,
  _previo: EstadoSorteo,
  formData: FormData,
): Promise<EstadoSorteo> {
  return ejecutar(async () => {
    const { base } = await contexto(rifaId);
    const ganadores: Record<string, number> = {};
    for (const [campo, valor] of formData.entries()) {
      if (campo.startsWith("ganador-") && typeof valor === "string") {
        const texto = valor.trim();
        ganadores[campo.slice("ganador-".length)] = /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
      }
    }
    const resultado = await registrarResultado(db, {
      ...base,
      ganadores,
      aunqueNoEstenPagados: formData.get("confirmar") === "1",
    });
    if (!resultado.registrado) return { advertencias: resultado.advertencias };
    return { mensaje: "Resultado registrado. La rifa quedó como sorteada." };
  });
}

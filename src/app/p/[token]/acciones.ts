"use server";

import { refresh } from "next/cache";

import { db } from "@/db";
import { cancelarPedidoPorComprador } from "@/server/asignaciones";
import { ErrorDeNegocio } from "@/server/errores";

export type EstadoCancelacion = { error?: string; mensaje?: string };

/** El comprador cancela sus apartados sin pagar. Quien tiene el enlace secreto puede hacerlo. */
export async function cancelarPedidoAccion(token: string): Promise<EstadoCancelacion> {
  try {
    const cancelados = await cancelarPedidoPorComprador(db, token);
    refresh();
    return {
      mensaje:
        cancelados === 1
          ? "Cancelaste tu apartado; el número quedó libre."
          : `Cancelaste ${cancelados} apartados; los números quedaron libres.`,
    };
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return { error: error.message };
    throw error;
  }
}

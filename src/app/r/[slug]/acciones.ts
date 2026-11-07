"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  esquemaApartadoPublico,
  leerFormularioApartadoPublico,
  type CampoApartadoPublico,
} from "@/lib/validacion/publico";
import { ErrorDeNegocio } from "@/server/errores";
import { apartarPublico } from "@/server/publico";

export type EstadoApartadoPublico = {
  error?: string;
  errores?: Partial<Record<CampoApartadoPublico, string>>;
};

/** El comprador aparta desde la página pública; si todo sale bien, va al enlace de su pedido. */
export async function apartarPublicoAccion(
  slug: string,
  _previo: EstadoApartadoPublico,
  formData: FormData,
): Promise<EstadoApartadoPublico> {
  const resultado = esquemaApartadoPublico.safeParse(leerFormularioApartadoPublico(formData));
  if (!resultado.success) {
    const { fieldErrors } = z.flattenError(resultado.error);
    if (fieldErrors.sitio) return { error: "No se pudo enviar. Recarga la página e intenta de nuevo." };
    const errores: EstadoApartadoPublico["errores"] = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.[0]) errores[campo as CampoApartadoPublico] = mensajes[0];
    }
    return { error: errores.numeros ?? "Revisa los datos marcados.", errores };
  }

  // Detrás de un proxy (Vercel) la IP real viene en x-forwarded-for.
  const encabezados = await headers();
  const ip =
    encabezados.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    encabezados.get("x-real-ip") ||
    "desconocida";

  let token: string;
  try {
    token = await apartarPublico(db, { slug, ...resultado.data, ip });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      // Si alguien más tomó un número, la cuadrícula se actualiza para mostrarlo ocupado.
      refresh();
      return { error: error.message };
    }
    throw error;
  }
  redirect(`/p/${token}`);
}

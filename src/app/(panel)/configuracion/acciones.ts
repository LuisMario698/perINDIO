"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { esquemaPerfil, leerFormularioPerfil, type CampoPerfil } from "@/lib/validacion/organizador";
import { ErrorDeNegocio } from "@/server/errores";
import { actualizarPerfil, guardarLogo, quitarLogo } from "@/server/organizador";
import { obtenerUsuarioActual } from "@/server/sesion";

export type EstadoPerfil = {
  error?: string;
  errores?: Partial<Record<CampoPerfil, string>>;
  mensaje?: string;
};

const SOLO_ADMIN = "Solo un administrador puede cambiar el perfil del organizador.";

export async function actualizarPerfilAccion(
  _previo: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") return { error: SOLO_ADMIN };

  const resultado = esquemaPerfil.safeParse(leerFormularioPerfil(formData));
  if (!resultado.success) {
    const { fieldErrors } = z.flattenError(resultado.error);
    const errores: EstadoPerfil["errores"] = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.[0]) errores[campo as CampoPerfil] = mensajes[0];
    }
    return { error: "Revisa los campos marcados.", errores };
  }

  await actualizarPerfil(db, usuario.organizadorId, resultado.data);
  refresh();
  return { mensaje: "Perfil guardado." };
}

export async function logoAccion(_previo: EstadoPerfil, formData: FormData): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") return { error: SOLO_ADMIN };

  try {
    if (formData.get("quitar") === "1") {
      await quitarLogo(db, usuario.organizadorId);
      refresh();
      return { mensaje: "Logo quitado." };
    }
    const archivo = formData.get("logo");
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige una imagen." };
    await guardarLogo(db, usuario.organizadorId, new Uint8Array(await archivo.arrayBuffer()));
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return { error: error.message };
    throw error;
  }
  refresh();
  return { mensaje: "Logo actualizado." };
}

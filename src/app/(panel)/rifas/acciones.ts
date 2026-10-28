"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  esquemaRifa,
  esUuid,
  leerFormularioRifa,
  type CampoRifa,
  type DatosRifa,
} from "@/lib/validacion/rifa";
import { ErrorDeNegocio } from "@/server/errores";
import { actualizarRifa, crearRifa, eliminarRifa } from "@/server/rifas";
import { obtenerUsuarioActual } from "@/server/sesion";

export type EstadoFormularioRifa = {
  error?: string;
  errores?: Partial<Record<CampoRifa, string>>;
  mensaje?: string;
};

const SOLO_ADMIN = "Solo un administrador puede crear o configurar rifas.";

export async function crearRifaAccion(
  _previo: EstadoFormularioRifa,
  formData: FormData,
): Promise<EstadoFormularioRifa> {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") return { error: SOLO_ADMIN };

  const validacion = validar(formData);
  if ("estadoConErrores" in validacion) return validacion.estadoConErrores;

  try {
    // crearRifa ignora el estado: una rifa nueva siempre empieza activa.
    await crearRifa(db, { ...validacion.datos, organizadorId: usuario.organizadorId });
  } catch (error) {
    return errorDeNegocio(error);
  }
  redirect("/");
}

export async function actualizarRifaAccion(
  rifaId: string,
  _previo: EstadoFormularioRifa,
  formData: FormData,
): Promise<EstadoFormularioRifa> {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") return { error: SOLO_ADMIN };
  if (!esUuid(rifaId)) return { error: "La rifa no existe." };

  const validacion = validar(formData);
  if ("estadoConErrores" in validacion) return validacion.estadoConErrores;

  try {
    await actualizarRifa(db, rifaId, usuario.organizadorId, validacion.datos);
  } catch (error) {
    return errorDeNegocio(error);
  }
  refresh();
  return { mensaje: "Cambios guardados." };
}

export async function eliminarRifaAccion(rifaId: string): Promise<EstadoFormularioRifa> {
  const usuario = await obtenerUsuarioActual();
  if (usuario.rol !== "admin") return { error: SOLO_ADMIN };
  if (!esUuid(rifaId)) return { error: "La rifa no existe." };

  try {
    await eliminarRifa(db, rifaId, usuario.organizadorId);
  } catch (error) {
    return errorDeNegocio(error);
  }
  redirect("/");
}

function validar(
  formData: FormData,
): { datos: DatosRifa } | { estadoConErrores: EstadoFormularioRifa } {
  const resultado = esquemaRifa.safeParse(leerFormularioRifa(formData));
  if (resultado.success) return { datos: resultado.data };

  const { fieldErrors } = z.flattenError(resultado.error);
  const errores: EstadoFormularioRifa["errores"] = {};
  for (const [campo, mensajes] of Object.entries(fieldErrors)) {
    if (mensajes?.[0]) errores[campo as CampoRifa] = mensajes[0];
  }
  return { estadoConErrores: { error: "Revisa los campos marcados.", errores } };
}

// Los errores de negocio se muestran en el formulario; cualquier otro llega a la página de error.
function errorDeNegocio(error: unknown): EstadoFormularioRifa {
  if (error instanceof ErrorDeNegocio) return { error: error.message };
  throw error;
}

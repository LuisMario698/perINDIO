"use server";

import { refresh } from "next/cache";

import { db } from "@/db";
import { esquemaEdicionUsuario, esquemaUsuario, erroresPorCampo } from "@/lib/validacion/usuario";
import { auth } from "@/server/auth";
import { ErrorDeNegocio } from "@/server/errores";
import {
  actualizarUsuario,
  cambiarActivo,
  crearUsuarioDelOrganizador,
  restablecerContrasena,
} from "@/server/usuarios";
import { obtenerUsuarioActual } from "@/server/sesion";

export type EstadoUsuarios = {
  error?: string;
  errores?: Record<string, string>;
  mensaje?: string;
  /** Contraseña temporal recién generada: se muestra una sola vez. */
  credenciales?: { email: string; password: string };
};

const SOLO_ADMIN = "Solo un administrador puede administrar usuarios.";

async function actorAdmin() {
  const usuario = await obtenerUsuarioActual();
  return usuario.rol === "admin" ? { id: usuario.id, organizadorId: usuario.organizadorId } : null;
}

function comoEstado(error: unknown): EstadoUsuarios {
  if (error instanceof ErrorDeNegocio) return { error: error.message };
  throw error;
}

export async function crearUsuarioAccion(
  _previo: EstadoUsuarios,
  formData: FormData,
): Promise<EstadoUsuarios> {
  const actor = await actorAdmin();
  if (!actor) return { error: SOLO_ADMIN };

  const datos = esquemaUsuario.safeParse({
    nombre: formData.get("nombre") ?? "",
    email: formData.get("email") ?? "",
    rol: formData.get("rol") ?? "",
  });
  if (!datos.success) return { error: "Revisa los campos marcados.", errores: erroresPorCampo(datos.error) };

  try {
    const { password } = await crearUsuarioDelOrganizador(auth, actor, datos.data);
    refresh();
    return {
      mensaje: `${datos.data.nombre} ya puede entrar.`,
      credenciales: { email: datos.data.email, password },
    };
  } catch (error) {
    return comoEstado(error);
  }
}

export async function actualizarUsuarioAccion(
  usuarioId: string,
  _previo: EstadoUsuarios,
  formData: FormData,
): Promise<EstadoUsuarios> {
  const actor = await actorAdmin();
  if (!actor) return { error: SOLO_ADMIN };

  const datos = esquemaEdicionUsuario.safeParse({
    nombre: formData.get("nombre") ?? "",
    rol: formData.get("rol") ?? "",
  });
  if (!datos.success) return { error: "Revisa los campos marcados.", errores: erroresPorCampo(datos.error) };

  try {
    await actualizarUsuario(db, actor, usuarioId, datos.data);
  } catch (error) {
    return comoEstado(error);
  }
  refresh();
  return { mensaje: "Cambios guardados." };
}

export async function restablecerContrasenaAccion(usuarioId: string, email: string): Promise<EstadoUsuarios> {
  const actor = await actorAdmin();
  if (!actor) return { error: SOLO_ADMIN };
  try {
    const password = await restablecerContrasena(db, auth, actor, usuarioId);
    return { mensaje: "Contraseña restablecida; sus sesiones se cerraron.", credenciales: { email, password } };
  } catch (error) {
    return comoEstado(error);
  }
}

export async function cambiarActivoAccion(usuarioId: string, activo: boolean): Promise<EstadoUsuarios> {
  const actor = await actorAdmin();
  if (!actor) return { error: SOLO_ADMIN };
  try {
    await cambiarActivo(db, actor, usuarioId, activo);
  } catch (error) {
    return comoEstado(error);
  }
  refresh();
  return { mensaje: activo ? "Usuario reactivado." : "Usuario desactivado; sus sesiones se cerraron." };
}

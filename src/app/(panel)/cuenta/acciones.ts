"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import { esquemaCambioContrasena, erroresPorCampo } from "@/lib/validacion/usuario";
import { auth } from "@/server/auth";
import { obtenerUsuarioActual } from "@/server/sesion";

export type EstadoCuenta = { error?: string; errores?: Record<string, string>; mensaje?: string };

export async function cambiarContrasenaAccion(
  _previo: EstadoCuenta,
  formData: FormData,
): Promise<EstadoCuenta> {
  await obtenerUsuarioActual();
  const datos = esquemaCambioContrasena.safeParse({
    actual: formData.get("actual") ?? "",
    nueva: formData.get("nueva") ?? "",
    confirmacion: formData.get("confirmacion") ?? "",
  });
  if (!datos.success) return { error: "Revisa los campos marcados.", errores: erroresPorCampo(datos.error) };

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: datos.data.actual,
        newPassword: datos.data.nueva,
        // Si alguien más conocía la contraseña anterior, pierde el acceso.
        revokeOtherSessions: true,
      },
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { error: "Revisa los campos marcados.", errores: { actual: "No es tu contraseña actual." } };
    }
    throw error;
  }
  return { mensaje: "Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos." };
}

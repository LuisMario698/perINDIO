import { APIError } from "better-auth/api";

import type { Rol } from "@/db/schema";

import type { Auth } from "./auth-config";
import { ErrorDeNegocio } from "./errores";

export const LONGITUD_MINIMA_CONTRASENA = 10;

export type NuevoUsuario = {
  email: string;
  nombre: string;
  password: string;
  rol: Rol;
  organizadorId: string;
};

const MENSAJES: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  INVALID_EMAIL: "El correo no es válido.",
};

/**
 * Crea una cuenta con correo y contraseña. Llamar sin sesión (seed, scripts) salta los permisos
 * del plugin admin, así que esta función no debe exponerse sin revisar antes que quien la usa sea admin.
 */
export async function crearUsuario(auth: Auth, datos: NuevoUsuario) {
  if (datos.password.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new ErrorDeNegocio(
      `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
    );
  }

  try {
    const { user } = await auth.api.createUser({
      body: {
        email: datos.email.trim(),
        name: datos.nombre.trim(),
        password: datos.password,
        // Los tipos de auth.api solo conocen los roles por defecto ("user" | "admin"), aunque el
        // plugin está configurado con admin y operador; en ejecución Better Auth valida contra esa
        // configuración (lo cubre tests/auth.test.ts).
        role: datos.rol as "admin",
        data: { organizadorId: datos.organizadorId },
      },
    });
    return user;
  } catch (error) {
    const mensaje = error instanceof APIError ? MENSAJES[error.body?.code ?? ""] : undefined;
    if (mensaje) throw new ErrorDeNegocio(mensaje);
    throw error;
  }
}

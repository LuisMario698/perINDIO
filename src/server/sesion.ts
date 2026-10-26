import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Rol } from "@/db/schema";

import { auth } from "./auth";

export type UsuarioActual = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  organizadorId: string;
};

/** Sesión válida o null. Se consulta una sola vez por petición. */
export const leerSesion = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Usuario de la sesión actual; si no hay sesión válida, manda al login.
 * Cada página y acción protegida debe llamarla: el proxy solo revisa que exista la cookie.
 * Lee la petición, así que el componente que la usa debe estar dentro de un <Suspense>.
 */
export async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const { user } = sesion;
  return {
    id: user.id,
    nombre: user.name,
    email: user.email,
    rol: user.role === "admin" ? "admin" : "operador",
    organizadorId: user.organizadorId,
  };
}

import { randomBytes } from "node:crypto";

import { APIError } from "better-auth/api";
import { and, asc, eq } from "drizzle-orm";

import type { Db, Tx } from "@/db/client";
import { sesiones, usuarios, type Rol } from "@/db/schema";

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

// --- Administración de usuarios del organizador ---

export type Actor = { id: string; organizadorId: string };

export type UsuarioDelOrganizador = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
};

const ALFABETO_TEMPORAL = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Contraseña temporal fácil de dictar (sin 0/O ni 1/l/I), con 12 caracteres. */
export function generarContrasenaTemporal(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => ALFABETO_TEMPORAL[b % ALFABETO_TEMPORAL.length]).join("");
}

export async function listarUsuarios(db: Db, organizadorId: string): Promise<UsuarioDelOrganizador[]> {
  const filas = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.name,
      email: usuarios.email,
      rol: usuarios.role,
      banned: usuarios.banned,
      creadoEn: usuarios.createdAt,
    })
    .from(usuarios)
    .where(eq(usuarios.organizadorId, organizadorId))
    .orderBy(asc(usuarios.banned), asc(usuarios.name));
  return filas.map(({ banned, rol, ...u }) => ({
    ...u,
    rol: rol === "admin" ? "admin" : "operador",
    activo: !banned,
  }));
}

/** Crea un usuario del organizador con una contraseña temporal que se muestra una sola vez. */
export async function crearUsuarioDelOrganizador(
  auth: Auth,
  actor: Actor,
  datos: { nombre: string; email: string; rol: Rol },
) {
  const password = generarContrasenaTemporal();
  const usuario = await crearUsuario(auth, { ...datos, password, organizadorId: actor.organizadorId });
  return { id: usuario.id, password };
}

/**
 * Bloquea al usuario y a los admins activos del organizador para que dos cambios simultáneos
 * no dejen al organizador sin ningún administrador.
 */
async function bloquearUsuario(tx: Tx, actor: Actor, usuarioId: string) {
  const admins = await tx
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.organizadorId, actor.organizadorId),
        eq(usuarios.role, "admin"),
        eq(usuarios.banned, false),
      ),
    )
    .orderBy(asc(usuarios.id))
    .for("update");
  const [usuario] = await tx
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizadorId, actor.organizadorId)))
    .for("update");
  if (!usuario) throw new ErrorDeNegocio("El usuario no existe.");
  return { usuario, adminsActivos: admins.length };
}

function exigirOtroAdmin(usuario: { role: string; banned: boolean }, adminsActivos: number) {
  if (usuario.role === "admin" && !usuario.banned && adminsActivos <= 1) {
    throw new ErrorDeNegocio("Debe quedar al menos un administrador activo.");
  }
}

/** Cierra todas las sesiones del usuario (al desactivarlo o cambiarle la contraseña). */
async function cerrarSesiones(tx: Tx | Db, usuarioId: string) {
  await tx.delete(sesiones).where(eq(sesiones.userId, usuarioId));
}

export async function actualizarUsuario(
  db: Db,
  actor: Actor,
  usuarioId: string,
  datos: { nombre: string; rol: Rol },
) {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) throw new ErrorDeNegocio("Escribe el nombre del usuario.");

  await db.transaction(async (tx) => {
    const { usuario, adminsActivos } = await bloquearUsuario(tx, actor, usuarioId);
    if (usuario.role === "admin" && datos.rol !== "admin") {
      if (usuario.id === actor.id) {
        throw new ErrorDeNegocio("No puedes quitarte a ti mismo el rol de administrador.");
      }
      exigirOtroAdmin(usuario, adminsActivos);
    }
    await tx.update(usuarios).set({ name: nombre, role: datos.rol }).where(eq(usuarios.id, usuario.id));
    // Sus sesiones abiertas guardan el rol anterior: que vuelva a entrar con el nuevo.
    if (usuario.role !== datos.rol) await cerrarSesiones(tx, usuario.id);
  });
}

export async function cambiarActivo(db: Db, actor: Actor, usuarioId: string, activo: boolean) {
  await db.transaction(async (tx) => {
    const { usuario, adminsActivos } = await bloquearUsuario(tx, actor, usuarioId);
    if (!activo) {
      if (usuario.id === actor.id) throw new ErrorDeNegocio("No puedes desactivar tu propia cuenta.");
      exigirOtroAdmin(usuario, adminsActivos);
    }
    await tx
      .update(usuarios)
      .set({ banned: !activo, banReason: activo ? null : "Desactivado por un administrador" })
      .where(eq(usuarios.id, usuario.id));
    if (!activo) await cerrarSesiones(tx, usuario.id);
  });
}

/** Pone una contraseña temporal nueva (se muestra una vez) y cierra sus sesiones. */
export async function restablecerContrasena(db: Db, auth: Auth, actor: Actor, usuarioId: string) {
  const [usuario] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizadorId, actor.organizadorId)));
  if (!usuario) throw new ErrorDeNegocio("El usuario no existe.");
  if (usuario.id === actor.id) {
    throw new ErrorDeNegocio("Para cambiar tu propia contraseña usa Mi cuenta.");
  }

  const password = generarContrasenaTemporal();
  const contexto = await auth.$context;
  await contexto.internalAdapter.updatePassword(usuario.id, await contexto.password.hash(password));
  await cerrarSesiones(db, usuario.id);
  return password;
}

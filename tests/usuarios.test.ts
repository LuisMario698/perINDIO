import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { organizadores, sesiones, usuarios } from "@/db/schema";
import { crearAuth } from "@/server/auth-config";
import {
  actualizarUsuario,
  cambiarActivo,
  crearUsuarioDelOrganizador,
  generarContrasenaTemporal,
  listarUsuarios,
  restablecerContrasena,
} from "@/server/usuarios";

import { conectarBaseDePruebas, crearUsuarioDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();
const auth = crearAuth(db);

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function organizador(nombre = "Org") {
  const [o] = await db.insert(organizadores).values({ nombre }).returning();
  const admin = await crearUsuarioDePrueba(db, o.id, "admin");
  return { organizadorId: o.id, admin, actor: { id: admin.id, organizadorId: o.id } };
}

async function entrar(email: string, password: string) {
  const origen = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return auth.handler(
    new Request(`${origen}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: origen },
      body: JSON.stringify({ email, password }),
    }),
  );
}

describe("usuarios del organizador", () => {
  it("crea con contraseña temporal con la que se puede entrar", async () => {
    const { actor, organizadorId } = await organizador();

    const { id, password } = await crearUsuarioDelOrganizador(auth, actor, {
      nombre: "Vendedora Uno",
      email: "uno@perindio.test",
      rol: "operador",
    });

    expect(password).toMatch(/^[a-zA-Z2-9]{12}$/);
    expect(password).not.toMatch(/[0O1lI]/);
    expect((await entrar("uno@perindio.test", password)).status).toBe(200);
    const lista = await listarUsuarios(db, organizadorId);
    expect(lista.find((u) => u.id === id)).toMatchObject({ rol: "operador", activo: true });
    expect(new Set(Array.from({ length: 20 }, generarContrasenaTemporal)).size).toBe(20);
  });

  it("restablecer cambia la contraseña y cierra sus sesiones", async () => {
    const { actor } = await organizador();
    const { id, password } = await crearUsuarioDelOrganizador(auth, actor, {
      nombre: "Dos",
      email: "dos@perindio.test",
      rol: "operador",
    });
    await entrar("dos@perindio.test", password);
    expect(await db.select().from(sesiones).where(eq(sesiones.userId, id))).toHaveLength(1);

    const nueva = await restablecerContrasena(db, auth, actor, id);

    expect(await db.select().from(sesiones).where(eq(sesiones.userId, id))).toHaveLength(0);
    expect((await entrar("dos@perindio.test", password)).status).toBe(401);
    expect((await entrar("dos@perindio.test", nueva)).status).toBe(200);
    await expect(restablecerContrasena(db, auth, actor, actor.id)).rejects.toThrow("Mi cuenta");
  });

  it("desactivar impide entrar y reactivar lo devuelve", async () => {
    const { actor } = await organizador();
    const { id, password } = await crearUsuarioDelOrganizador(auth, actor, {
      nombre: "Tres",
      email: "tres@perindio.test",
      rol: "operador",
    });

    await cambiarActivo(db, actor, id, false);
    expect((await entrar("tres@perindio.test", password)).status).toBe(403);

    await cambiarActivo(db, actor, id, true);
    expect((await entrar("tres@perindio.test", password)).status).toBe(200);
  });

  it("siempre queda un admin activo y nadie se quita el rol ni se desactiva a sí mismo", async () => {
    const { actor, organizadorId } = await organizador();

    await expect(actualizarUsuario(db, actor, actor.id, { nombre: "Yo", rol: "operador" })).rejects.toThrow(
      "a ti mismo",
    );
    await expect(cambiarActivo(db, actor, actor.id, false)).rejects.toThrow("tu propia cuenta");

    // Con otro admin sí se puede degradar a uno de los dos, pero no al último.
    const otro = await crearUsuarioDePrueba(db, organizadorId, "admin");
    await actualizarUsuario(db, actor, otro.id, { nombre: "Otra", rol: "operador" });
    const [degradado] = await db.select().from(usuarios).where(eq(usuarios.id, otro.id));
    expect(degradado).toMatchObject({ name: "Otra", role: "operador" });

    const tercero = await crearUsuarioDePrueba(db, organizadorId, "admin");
    await cambiarActivo(db, actor, tercero.id, false);
    const segundoActor = { id: otro.id, organizadorId };
    await expect(cambiarActivo(db, segundoActor, actor.id, false)).rejects.toThrow(
      "al menos un administrador activo",
    );
  });

  it("no toca usuarios de otro organizador", async () => {
    const a = await organizador("A");
    const b = await organizador("B");
    const ajeno = await crearUsuarioDePrueba(db, b.organizadorId, "operador");

    await expect(actualizarUsuario(db, a.actor, ajeno.id, { nombre: "Xavier", rol: "admin" })).rejects.toThrow(
      "no existe",
    );
    await expect(cambiarActivo(db, a.actor, ajeno.id, false)).rejects.toThrow("no existe");
    await expect(restablecerContrasena(db, auth, a.actor, ajeno.id)).rejects.toThrow("no existe");
    expect((await listarUsuarios(db, a.organizadorId)).map((u) => u.id)).toEqual([a.admin.id]);
  });
});

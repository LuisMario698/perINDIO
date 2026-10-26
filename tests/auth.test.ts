import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, movimientos, organizadores, usuarios } from "@/db/schema";
import { apartarNumeros } from "@/server/asignaciones";
import { crearAuth } from "@/server/auth-config";
import { ErrorDeNegocio } from "@/server/errores";
import { crearUsuario } from "@/server/usuarios";

import {
  codigoDeError,
  conectarBaseDePruebas,
  crearRifaDePrueba,
  crearUsuarioDePrueba,
  vaciarTablas,
} from "./helpers";

const db = conectarBaseDePruebas();
const auth = crearAuth(db);
const CONTRASENA = "contrasena-de-prueba-123";

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

/** Petición HTTP al handler de Better Auth, igual que la que hace el navegador a /api/auth. */
function peticion(ruta: string, cuerpo: unknown, cookie?: string) {
  const origen = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return auth.handler(
    new Request(`${origen}/api/auth${ruta}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: origen,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(cuerpo),
    }),
  );
}

async function crearOrganizador() {
  const [organizador] = await db.insert(organizadores).values({ nombre: "Org" }).returning();
  return organizador.id;
}

describe("autenticación", () => {
  it("no permite el registro público", async () => {
    const respuesta = await peticion("/sign-up/email", {
      email: "intruso@perindio.test",
      password: CONTRASENA,
      name: "Intruso",
    });

    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
    expect(await db.select().from(usuarios)).toHaveLength(0);
  });

  it("un usuario creado por el administrador entra y su sesión trae rol y organizador", async () => {
    const organizadorId = await crearOrganizador();
    await crearUsuario(auth, {
      email: "Ana@perindio.test",
      nombre: "Ana",
      password: CONTRASENA,
      rol: "operador",
      organizadorId,
    });

    const malo = await peticion("/sign-in/email", { email: "ana@perindio.test", password: "otra-cosa-123" });
    expect(malo.status).toBe(401);

    const bueno = await peticion("/sign-in/email", { email: "ana@perindio.test", password: CONTRASENA });
    expect(bueno.status).toBe(200);
    const cookie = bueno.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toMatch(/session_token=/);

    const sesion = await auth.api.getSession({ headers: new Headers({ cookie: cookie! }) });
    expect(sesion?.user).toMatchObject({
      email: "ana@perindio.test",
      role: "operador",
      organizadorId,
    });
  });

  it("una cuenta desactivada no puede entrar", async () => {
    const organizadorId = await crearOrganizador();
    const usuario = await crearUsuario(auth, {
      email: "beto@perindio.test",
      nombre: "Beto",
      password: CONTRASENA,
      rol: "admin",
      organizadorId,
    });
    await db.update(usuarios).set({ banned: true }).where(eq(usuarios.id, usuario.id));

    const respuesta = await peticion("/sign-in/email", { email: "beto@perindio.test", password: CONTRASENA });

    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).code).toBe("BANNED_USER");
  });

  it("valida la contraseña, el correo repetido y el rol", async () => {
    const organizadorId = await crearOrganizador();
    const datos = { email: "eva@perindio.test", nombre: "Eva", rol: "operador" as const, organizadorId };

    await expect(crearUsuario(auth, { ...datos, password: "corta" })).rejects.toThrow(ErrorDeNegocio);
    await crearUsuario(auth, { ...datos, password: CONTRASENA });
    await expect(crearUsuario(auth, { ...datos, password: CONTRASENA })).rejects.toThrow(
      "Ya existe una cuenta con ese correo.",
    );

    // La base solo acepta los roles de la app.
    const otroRol = db.update(usuarios).set({ role: "user" }).where(eq(usuarios.email, datos.email));
    expect(await codigoDeError(otroRol)).toBe("23514");
  });
});

describe("usuario en las operaciones", () => {
  it("registra quién apartó y rechaza usuarios inexistentes", async () => {
    const rifa = await crearRifaDePrueba(db);
    const operador = await crearUsuarioDePrueba(db, rifa.organizadorId);

    const [asignacion] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1],
      comprador: { nombre: "Ana" },
      usuarioId: operador.id,
    });

    const [guardada] = await db.select().from(asignaciones).where(eq(asignaciones.id, asignacion.id));
    const [movimiento] = await db
      .select()
      .from(movimientos)
      .where(eq(movimientos.asignacionId, asignacion.id));
    expect(guardada.creadaPor).toBe(operador.id);
    expect(movimiento.usuarioId).toBe(operador.id);

    const fantasma = apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [2],
      comprador: { nombre: "Beto" },
      usuarioId: "no-existe",
    });
    expect(await codigoDeError(fantasma)).toBe("23503"); // foreign_key_violation
  });
});

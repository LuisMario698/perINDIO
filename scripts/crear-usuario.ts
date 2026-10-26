import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

import { createDb, type Db } from "@/db/client";
import { organizadores, ROLES, type Rol } from "@/db/schema";
import { crearAuth } from "@/server/auth-config";
import { crearUsuario } from "@/server/usuarios";

loadEnvConfig(process.cwd());

const AYUDA = `
Crea una cuenta para entrar a perINDIO (no hay registro público).

  pnpm usuario:crear --email ana@ejemplo.com --nombre "Ana López" [--rol admin]

Opciones:
  --rol           admin u operador (predeterminado: operador)
  --organizador   id del organizador, si hay más de uno
  --organizacion  nombre del organizador que se crea si todavía no hay ninguno

La contraseña se toma de la variable NUEVA_CONTRASENA; si no está, se genera una y se
muestra una sola vez. Usa la base de DATABASE_URL: para crear el primer admin en la nube,
ejecútalo con DATABASE_URL="<cadena de conexión>".
`;

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      nombre: { type: "string" },
      rol: { type: "string", default: "operador" },
      organizador: { type: "string" },
      organizacion: { type: "string" },
      ayuda: { type: "boolean", short: "h" },
    },
  });
  if (values.ayuda || !values.email || !values.nombre) {
    console.log(AYUDA);
    process.exit(values.ayuda ? 0 : 1);
  }
  const rol = values.rol as Rol;
  if (!ROLES.includes(rol)) {
    throw new Error(`Rol inválido "${values.rol}". Usa ${ROLES.join(" u ")}.`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL. Copia .env.example como .env.");

  const db = createDb(url);
  try {
    const organizadorId = await resolverOrganizador(db, values.organizador, values.organizacion);
    const generada = !process.env.NUEVA_CONTRASENA;
    const password = process.env.NUEVA_CONTRASENA ?? randomBytes(18).toString("base64url");

    const usuario = await crearUsuario(crearAuth(db), {
      email: values.email,
      nombre: values.nombre,
      password,
      rol,
      organizadorId,
    });

    console.log(`Usuario creado en ${new URL(url).hostname}: ${usuario.email} (${rol}).`);
    if (generada) {
      console.log(`Contraseña: ${password}\nGuárdala ahora; no se vuelve a mostrar.`);
    }
  } finally {
    await db.$client.end();
  }
}

async function resolverOrganizador(db: Db, id?: string, nombreNuevo?: string) {
  if (id) {
    const [existente] = await db
      .select({ id: organizadores.id })
      .from(organizadores)
      .where(eq(organizadores.id, id));
    if (!existente) throw new Error(`No existe el organizador ${id}.`);
    return existente.id;
  }

  const lista = await db
    .select({ id: organizadores.id, nombre: organizadores.nombre })
    .from(organizadores);
  if (lista.length === 1) return lista[0].id;
  if (lista.length === 0) {
    const [nuevo] = await db
      .insert(organizadores)
      .values({ nombre: nombreNuevo?.trim() || "Mi organización" })
      .returning();
    console.log(`Organizador creado: ${nuevo.nombre}.`);
    return nuevo.id;
  }
  throw new Error(
    `Hay ${lista.length} organizadores; indica cuál con --organizador:\n` +
      lista.map((o) => `  ${o.id}  ${o.nombre}`).join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

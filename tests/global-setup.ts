import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { urlBaseDePruebas } from "./helpers";

// Antes de todas las pruebas: crea la base de pruebas si no existe y le aplica las migraciones.
export default async function setup() {
  try {
    await prepararBaseDePruebas();
  } catch (error) {
    // Vitest 5 a veces truena al mostrar errores del globalSetup; dejamos el motivo a la vista.
    console.error(
      `\nNo se pudo preparar la base de pruebas: ${error instanceof Error ? error.message : error}\n`,
    );
    throw error;
  }
}

async function prepararBaseDePruebas() {
  const url = urlBaseDePruebas();
  const nombre = new URL(url).pathname.slice(1);

  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const admin = postgres(urlAdmin.toString(), { max: 1, onnotice: () => {} });
  try {
    const existe = await admin`select 1 from pg_database where datname = ${nombre}`;
    if (existe.length === 0) {
      // El nombre ya se validó (solo minúsculas, dígitos y _), así que es seguro interpolarlo.
      await admin.unsafe(`create database "${nombre}"`);
    }
  } finally {
    await admin.end();
  }

  const cliente = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(cliente), { migrationsFolder: "drizzle" });
  } finally {
    await cliente.end();
  }
}

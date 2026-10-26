import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

import { createDb, type Db } from "@/db/client";
import { esBaseLocal } from "@/db/local";
import { organizadores, usuarios, type Rol } from "@/db/schema";
import { crearRifa, type NuevaRifa } from "@/server/rifas";

loadEnvConfig(process.cwd());

/** URL de la base de pruebas. Solo acepta una base local cuyo nombre termine en _test. */
export function urlBaseDePruebas(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Falta TEST_DATABASE_URL. Revisa .env.example.");
  }
  // Las pruebas vacían las tablas: nunca deben apuntar a la base de desarrollo ni a la nube.
  const nombre = new URL(url).pathname.slice(1);
  if (!esBaseLocal(url) || !/^[a-z0-9_]+_test$/.test(nombre)) {
    throw new Error(
      `TEST_DATABASE_URL debe ser una base local cuyo nombre termine en _test (es "${nombre}").`,
    );
  }
  return url;
}

export function conectarBaseDePruebas(): Db {
  // Conexiones de sobra para que las pruebas de concurrencia corran de verdad en paralelo.
  return createDb(urlBaseDePruebas(), { maxConexiones: 30 });
}

export async function vaciarTablas(db: Db) {
  await db.execute(
    sql`truncate movimientos, asignaciones, numeros, compradores, rifas, sesiones, cuentas,
        verificaciones, limites_de_solicitudes, usuarios, organizadores restart identity cascade`,
  );
}

/** Crea un organizador y una rifa de 100 números (00–99) a $50, salvo que se indique otra cosa. */
export async function crearRifaDePrueba(db: Db, datos: Partial<NuevaRifa> = {}) {
  const [organizador] = await db
    .insert(organizadores)
    .values({ nombre: "Organizador de prueba" })
    .returning();
  return crearRifa(db, {
    organizadorId: organizador.id,
    nombre: "Rifa de prueba",
    cantidadNumeros: 100,
    precioNumero: "50.00",
    ...datos,
  });
}

/** Inserta un usuario directo en la tabla (sin contraseña), para pruebas que solo necesitan su id. */
export async function crearUsuarioDePrueba(db: Db, organizadorId: string, rol: Rol = "operador") {
  const id = crypto.randomUUID();
  const [usuario] = await db
    .insert(usuarios)
    .values({ id, name: `Usuario ${rol}`, email: `${id}@perindio.test`, role: rol, organizadorId })
    .returning();
  return usuario;
}

/** Mueve la fecha límite de un apartado al pasado para simular que venció. */
export async function vencer(db: Db, asignacionId: string) {
  await db.execute(
    sql`update asignaciones set fecha_limite = now() - interval '1 minute' where id = ${asignacionId}`,
  );
}

/** Código de error de Postgres (por ejemplo 23505) con el que falló la promesa, o undefined si no falló. */
export async function codigoDeError(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa;
  } catch (error) {
    // Drizzle envuelve el error del driver en `cause`.
    const e = error as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return undefined;
}

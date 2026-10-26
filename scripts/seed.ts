import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

import { createDb } from "@/db/client";

loadEnvConfig(process.cwd());

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copia .env.example como .env.");
  }

  // El seed borra y crea datos de prueba: nunca debe correr contra la base de la nube por accidente.
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host) && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error(
      `DATABASE_URL apunta a "${host}", que no es local. ` +
        "Si de verdad quieres sembrar esa base, ejecuta con ALLOW_REMOTE_SEED=true.",
    );
  }

  const db = createDb(url);
  try {
    await db.execute(sql`select 1`);
    console.log(`Conectado a ${host}.`);
    // Los datos de demostración (rifa de 2,000 números, compradores, apartados) llegan en la fase 2.
    console.log("Todavía no hay datos que sembrar.");
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

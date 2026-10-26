import "server-only";

import { createDb, type Db } from "./client";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Falta DATABASE_URL. Copia .env.example como .env.");
}

// En desarrollo, la recarga en caliente vuelve a evaluar este módulo;
// reutilizamos la conexión para no abrir un pool nuevo en cada cambio.
const globalForDb = globalThis as unknown as { db?: Db };

export const db = globalForDb.db ?? createDb(url);

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

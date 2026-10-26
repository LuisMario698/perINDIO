import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Sin "server-only" para que los scripts (seed, pruebas) también puedan crear una conexión.
export function createDb(url: string, { maxConexiones = 10 } = {}) {
  // prepare: false es necesario con los poolers en modo transacción (Supabase, Neon),
  // que son los que se usan en serverless; localmente no afecta.
  const client = postgres(url, { prepare: false, max: maxConexiones });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

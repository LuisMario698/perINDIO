import "server-only";

import { sql } from "drizzle-orm";

import { db } from ".";

export type DbHealth =
  | { ok: true; version: string; serverTime: string }
  | { ok: false; error: string };

export async function checkDatabase(): Promise<DbHealth> {
  try {
    const [row] = await db.execute<{ version: string; server_time: string }>(
      sql`select current_setting('server_version') as version, now()::text as server_time`,
    );
    return { ok: true, version: row.version, serverTime: row.server_time };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

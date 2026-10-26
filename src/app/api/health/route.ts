import { connection } from "next/server";

import { checkDatabase } from "@/db/health";

// Para monitoreo en la nube: 200 si la app llega a la base, 503 si no.
export async function GET() {
  await connection();
  const health = await checkDatabase();

  if (!health.ok) {
    console.error("Health check: sin conexión a la base de datos:", health.error);
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }

  return Response.json({ status: "ok", database: "up", postgres: health.version });
}

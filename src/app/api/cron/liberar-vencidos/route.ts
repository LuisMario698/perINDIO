import { connection } from "next/server";

import { db } from "@/db";
import { liberarApartadosVencidos } from "@/server/asignaciones";
import { autorizarCron } from "@/server/cron";

// Libera los apartados vencidos de las rifas con liberación automática.
// Pensado para un cron cada pocos minutos; es seguro llamarlo varias veces a la vez.
export async function GET(request: Request) {
  await connection();
  if (!autorizarCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const liberados = await liberarApartadosVencidos(db);
  return Response.json({ liberados });
}

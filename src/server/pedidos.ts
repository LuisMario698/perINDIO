import { randomBytes, randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Tx } from "@/db/client";
import { pedidos } from "@/db/schema";

// Sin 0/O, 1/I/L: el folio se dicta por teléfono o se copia de una captura de pantalla.
const ALFABETO_FOLIO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generarFolio(): string {
  return Array.from({ length: 6 }, () => ALFABETO_FOLIO[randomInt(ALFABETO_FOLIO.length)]).join("");
}

/** Enlace secreto del pedido: quien lo tiene puede verlo y cancelar sus apartados pendientes. */
export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export type EstadoPedido = "pendiente" | "vencido" | "parcial" | "pagado" | "cancelado";

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: "Pago pendiente",
  vencido: "Vencido",
  parcial: "Pagado en parte",
  pagado: "Pagado",
  cancelado: "Liberado o cancelado",
};

/**
 * Estado de un pedido a partir de sus asignaciones:
 * - cancelado: ya no tiene números vigentes (todos se liberaron o cancelaron);
 * - pagado: todos sus números vigentes están pagados;
 * - parcial: tiene números pagados y otros pendientes;
 * - vencido: tiene apartados pendientes con el plazo vencido;
 * - pendiente: el resto (apartados pendientes dentro del plazo).
 */
export function estadoPedido(
  asignaciones: { estado: string; estadoPago: string; fechaLimite: Date | null }[],
  ahora = new Date(),
): EstadoPedido {
  const vigentes = asignaciones.filter((a) => a.estado === "apartado" || a.estado === "vendido");
  if (vigentes.length === 0) return "cancelado";
  const pendientes = vigentes.filter((a) => a.estadoPago === "pendiente");
  if (pendientes.length === 0) return "pagado";
  if (pendientes.length < vigentes.length) return "parcial";
  const vencido = pendientes.some((a) => a.fechaLimite !== null && a.fechaLimite < ahora);
  return vencido ? "vencido" : "pendiente";
}

/** Crea el pedido con un folio que no se repite en la rifa (reintenta en el caso raro de choque). */
export async function crearPedido(
  tx: Tx,
  datos: {
    rifaId: string;
    compradorId: string;
    origen: "publico" | "interno";
    vendedorId: string | null;
  },
) {
  for (let intento = 0; intento < 5; intento++) {
    const [pedido] = await tx
      .insert(pedidos)
      .values({ ...datos, folio: generarFolio(), token: generarToken() })
      .onConflictDoNothing({ target: [pedidos.rifaId, pedidos.folio] })
      .returning();
    if (pedido) return pedido;
  }
  throw new Error("No se pudo generar un folio único para el pedido.");
}

/** El pedido de ese enlace secreto, bloqueado para modificarlo en la transacción. */
export async function bloquearPedidoPorToken(tx: Tx, token: string) {
  const [pedido] = await tx.select().from(pedidos).where(eq(pedidos.token, token)).for("update");
  return pedido ?? null;
}

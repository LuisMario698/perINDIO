import { formatearDinero, formatearFechaHora } from "./formato";

type Tipo =
  | "apartado"
  | "venta"
  | "pago_confirmado"
  | "cancelacion"
  | "liberacion_manual"
  | "liberacion_automatica"
  | "cancelacion_comprador";

export const NOMBRE_MOVIMIENTO: Record<Tipo, string> = {
  apartado: "Apartado",
  venta: "Venta",
  pago_confirmado: "Pago confirmado",
  cancelacion: "Cancelación",
  liberacion_manual: "Liberación manual",
  liberacion_automatica: "Liberación automática",
  cancelacion_comprador: "Cancelado por el comprador",
};

export const TIPOS_MOVIMIENTO = Object.keys(NOMBRE_MOVIMIENTO) as Tipo[];

/** Texto corto con lo relevante de cada movimiento (monto, vencimiento o motivo). */
export function describirMovimiento(tipo: Tipo, detalle: Record<string, unknown> | null): string {
  const d = detalle ?? {};
  // La liberación automática viene de SQL y usa snake_case.
  const fechaLimite = (d.fechaLimite ?? d.fecha_limite) as string | null | undefined;
  const monto = d.monto as string | undefined;
  switch (tipo) {
    case "apartado":
      return [monto && formatearDinero(monto), fechaLimite && `vence ${formatearFechaHora(fechaLimite)}`]
        .filter(Boolean)
        .join(" · ");
    case "venta":
    case "pago_confirmado":
      return monto ? formatearDinero(monto) : "";
    case "cancelacion":
      return [
        d.motivo ? `Motivo: ${d.motivo}` : null,
        d.estadoPago === "confirmado" ? "ya estaba pagado" : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "cancelacion_comprador":
      return d.folio ? `Folio ${d.folio}` : "";
    case "liberacion_manual":
    case "liberacion_automatica":
      return fechaLimite ? `venció ${formatearFechaHora(fechaLimite)}` : "";
  }
}

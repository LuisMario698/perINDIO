import { formatearDinero, formatearFechaHora } from "./formato";

/** Mensaje de WhatsApp del organizador al comprador con el enlace de su pedido. */
export function mensajeComprobante(datos: {
  comprador: string;
  rifa: string;
  folio: string;
  numeros: string[];
  url: string;
}) {
  return (
    `Hola ${datos.comprador}, gracias por tu compra en la ${datos.rifa}. ` +
    `Tu folio es ${datos.folio} (números ${datos.numeros.join(", ")}). ` +
    `Aquí puedes ver tu pedido y cómo pagar: ${datos.url}`
  );
}

/** Recordatorio de pago para un pedido pendiente o vencido. */
export function mensajeRecordatorio(datos: {
  comprador: string;
  rifa: string;
  folio: string;
  numeros: string[];
  porPagar: number;
  venceEn: Date | null;
  url: string;
}) {
  const vence = datos.venceEn ? ` El plazo vence el ${formatearFechaHora(datos.venceEn)}.` : "";
  return (
    `Hola ${datos.comprador}, te recordamos tu apartado en la ${datos.rifa}: ` +
    `folio ${datos.folio}, números ${datos.numeros.join(", ")}, ` +
    `por pagar ${formatearDinero(datos.porPagar)}.${vence} ` +
    `Aquí ves cómo pagar y puedes mandar tu comprobante: ${datos.url}`
  );
}

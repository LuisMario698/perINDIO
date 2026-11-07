"use client";

import { BotonCopiar } from "@/components/boton-copiar";
import { buttonVariants } from "@/components/ui/button";
import { mensajeComprobante } from "@/lib/mensajes";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/telefono";

/** Botones para mandarle al comprador el enlace de su pedido (WhatsApp o copiar). */
export function CompartirPedido({
  pedido,
  rifa,
  urlBase,
}: {
  pedido: { folio: string; token: string; comprador: string; telefono: string | null; numeros: string[] };
  rifa: string;
  urlBase: string;
}) {
  const url = `${urlBase}/p/${pedido.token}`;
  const telefono = pedido.telefono ? normalizarTelefono(pedido.telefono) : null;
  return (
    <div className="flex flex-wrap gap-2">
      {telefono && (
        <a
          href={enlaceWhatsApp(
            telefono,
            mensajeComprobante({ ...pedido, rifa, url }),
          )}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ size: "sm" })}
        >
          Mandar comprobante por WhatsApp
        </a>
      )}
      <BotonCopiar texto={url} etiqueta="Copiar enlace del pedido" />
    </div>
  );
}

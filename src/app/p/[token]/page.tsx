import { cn } from "cn";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BotonCopiar } from "@/components/boton-copiar";
import { EncabezadoPublico, PiePublico } from "@/components/encabezado-publico";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { formatearDinero, formatearFecha, formatearFechaHora, tiempoRelativo } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefono";
import { NOMBRE_ESTADO_PEDIDO, type EstadoPedido } from "@/server/pedidos";
import { obtenerPedidoPublico, type PedidoPublico } from "@/server/publico";

import { CancelarPedido } from "./cancelar-pedido";

// El enlace es privado: que no lo indexen los buscadores.
export const metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

const COLOR_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: "bg-amber-100 text-amber-950",
  parcial: "bg-amber-100 text-amber-950",
  vencido: "bg-red-100 text-red-950",
  pagado: "bg-emerald-100 text-emerald-950",
  cancelado: "bg-muted text-muted-foreground",
};

export default function PaginaPedido({ params }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Cargando tu pedido…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/p/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const pedido = await obtenerPedidoPublico(db, token);
  if (!pedido) notFound();
  const { rifa, organizador } = pedido;
  const etiquetas = pedido.numeros.map((n) => formatearNumero(n.numero, rifa.digitos));
  const pendiente = pedido.porPagar > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EncabezadoPublico organizador={organizador} />
      <section className="fondo-marca border-t border-white/10">
        <div className="mx-auto w-full max-w-xl space-y-3 px-4 pt-5 pb-6">
          <p className="text-sm text-white/70">{rifa.nombre} · tu pedido</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-wide text-white/70 uppercase">Folio</p>
              <p className="titulo-marca text-5xl tracking-wider text-marca-oro">{pedido.pedido.folio}</p>
            </div>
            <span
              className={cn("rounded-full px-3 py-1 text-sm font-semibold", COLOR_PEDIDO[pedido.estado])}
            >
              {NOMBRE_ESTADO_PEDIDO[pedido.estado]}
            </span>
          </div>
          <p className="text-white/90">
            A nombre de <strong className="text-white">{pedido.comprador.nombre}</strong>
          </p>
        </div>
      </section>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-6">
        <Seguimiento estado={pedido.estado} />
        <Vencimiento pedido={pedido} />

        <section className="space-y-2">
          <h2 className="titulo-marca text-xl">Tus números</h2>
          <ul className="flex flex-wrap gap-1.5">
            {pedido.numeros.map((n) => (
              <li
                key={n.numero}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-base",
                  n.estado === "vendido" && "border-emerald-300 bg-emerald-50",
                  (n.estado === "liberado" || n.estado === "cancelado") &&
                    "text-muted-foreground line-through",
                )}
                title={
                  n.estado === "vendido"
                    ? "Pagado"
                    : n.estado === "apartado"
                      ? "Pago pendiente"
                      : "Liberado o cancelado"
                }
              >
                {formatearNumero(n.numero, rifa.digitos)}
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatearDinero(pedido.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Por pagar</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatearDinero(pedido.porPagar)}
              </dd>
            </div>
          </dl>
          {rifa.fechaSorteo && (
            <p className="text-sm text-muted-foreground">Sorteo: {formatearFecha(rifa.fechaSorteo)}</p>
          )}
        </section>

        {pendiente && (
          <section className="space-y-3">
            <h2 className="titulo-marca text-xl">Cómo pagar</h2>
            <p className="whitespace-pre-line rounded-xl bg-muted/50 p-4 text-sm">
              {pedido.instruccionesPago ??
                "El organizador te dirá cómo pagar. Escríbele por WhatsApp con tu folio."}
            </p>
            {organizador.whatsapp && (
              <a
                href={enlaceWhatsApp(
                  organizador.whatsapp,
                  `Hola, soy ${pedido.comprador.nombre}. Aparté en la ${rifa.nombre}: ` +
                    `folio ${pedido.pedido.folio}, números ${etiquetas.join(", ")}. ` +
                    `Total: ${formatearDinero(pedido.porPagar)}. Te envío mi comprobante de pago.`,
                )}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}
              >
                Ya pagué: enviar comprobante por WhatsApp
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              Cuando el organizador confirme tu pago, esta página lo mostrará como pagado.
            </p>
          </section>
        )}

        <section className="space-y-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Guarda este enlace: con él consultas tu pedido cuando quieras.
          </p>
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={`/p/${token}`} etiqueta="Copiar enlace de mi pedido" />
            {rifa.publica && (
              <Link href={`/r/${rifa.slug}`} className={buttonVariants({ variant: "ghost" })}>
                Ver la rifa
              </Link>
            )}
          </div>
        </section>

        {pendiente && rifa.estado !== "sorteada" && <CancelarPedido token={token} />}
      </main>
      <PiePublico />
    </div>
  );
}

/** Los tres pasos del comprador, con el actual resaltado. */
function Seguimiento({ estado }: { estado: EstadoPedido }) {
  if (estado === "cancelado") return null;
  const paso = estado === "pagado" ? 3 : 2;
  const pasos = ["Apartado", estado === "vencido" ? "Pago vencido" : "Paga y manda tu comprobante", "Pago confirmado"];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Avance de tu pedido">
      {pasos.map((nombre, i) => {
        const numero = i + 1;
        const hecho = numero < paso || (numero === 3 && paso === 3);
        const actual = numero === paso && !hecho;
        return (
          <li key={nombre} aria-current={actual ? "step" : undefined} className="space-y-1.5 text-center">
            <span
              className={cn(
                "titulo-marca mx-auto flex size-9 items-center justify-center rounded-full text-lg",
                hecho && "bg-primary text-primary-foreground",
                actual && (estado === "vencido" ? "bg-marca-rojo text-white" : "bg-marca-oro text-marca-noche"),
                !hecho && !actual && "bg-muted text-muted-foreground",
              )}
            >
              {hecho ? "✓" : numero}
            </span>
            <span className={cn("block text-xs leading-tight", actual ? "font-semibold" : "text-muted-foreground")}>
              {nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Vencimiento({ pedido }: { pedido: PedidoPublico }) {
  if (pedido.estado === "pagado") {
    return <p className="text-sm">Tu pago está confirmado. ¡Mucha suerte en el sorteo!</p>;
  }
  if (pedido.estado === "cancelado") {
    return (
      <p className="text-sm text-muted-foreground">
        Estos números se liberaron o se cancelaron y ya no están a tu nombre.
      </p>
    );
  }
  if (!pedido.venceEn) return null;
  if (pedido.estado === "vencido") {
    return (
      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-950">
        El plazo para pagar venció el {formatearFechaHora(pedido.venceEn)}. Tus números pueden
        liberarse en cualquier momento: si ya pagaste, manda tu comprobante cuanto antes.
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      Paga antes del <strong>{formatearFechaHora(pedido.venceEn)}</strong> (
      {tiempoRelativo(pedido.venceEn)}); si no, tus números se liberan para otras personas.
    </p>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import {
  formatearDinero,
  formatearEntero,
  formatearFecha,
  formatearPorcentaje,
} from "@/lib/formato";
import { esUuid } from "@/lib/validacion/rifa";
import { NOMBRE_PDF, TIPOS_PDF } from "@/lib/pdfs";
import { liberarApartadosVencidos } from "@/server/asignaciones";
import { listarOcupados, obtenerRifa } from "@/server/consultas";
import { obtenerUsuarioActual } from "@/server/sesion";

import { apartarAccion, operarAsignacionesAccion } from "./acciones";
import { Tablero } from "./tablero";

export const metadata = { title: "Números · perINDIO" };

export default function PaginaTablero({ params }: PageProps<"/rifas/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando números…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/rifas/[id]">, "params">) {
  const usuario = await obtenerUsuarioActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();

  // Al abrir el tablero se liberan los vencidos de las rifas con liberación automática,
  // así lo que se ve ya está al día aunque el cron todavía no haya corrido.
  await liberarApartadosVencidos(db);
  const ocupados = await listarOcupados(db, rifa.id);

  const sumar = (pago: "confirmado" | "pendiente") =>
    ocupados
      .filter((o) => o.estadoPago === pago)
      .reduce((total, o) => total + Number(o.monto ?? 0), 0);
  const vendidos = ocupados.filter((o) => o.estado === "vendido").length;

  const detalles = [
    `${formatearEntero(rifa.cantidadNumeros)} números`,
    `${formatearDinero(rifa.precioNumero)} cada uno`,
    `plazo de ${rifa.plazoApartadoHoras} h`,
    rifa.liberacionAutomatica ? "liberación automática" : "liberación manual",
    rifa.fechaSorteo && `sorteo: ${formatearFecha(rifa.fechaSorteo)}`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Rifas
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{rifa.nombre}</h1>
          <p className="text-sm text-muted-foreground">{detalles.join(" · ")}</p>
          <p className="text-sm">
            Cobrado <strong className="tabular-nums">{formatearDinero(sumar("confirmado"))}</strong>{" "}
            · por cobrar{" "}
            <strong className="tabular-nums">{formatearDinero(sumar("pendiente"))}</strong> ·{" "}
            {formatearPorcentaje(vendidos / rifa.cantidadNumeros)} vendido
          </p>
        </div>
        <div className="flex gap-2">
          <MenuPdf rifaId={rifa.id} />
          <Link
            href={`/rifas/${rifa.id}/historial`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Historial
          </Link>
          {usuario.rol === "admin" && (
            <Link
              href={`/rifas/${rifa.id}/configuracion`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Configurar
            </Link>
          )}
        </div>
      </div>
      <Tablero
        rifa={{
          id: rifa.id,
          numeroInicial: rifa.numeroInicial,
          cantidadNumeros: rifa.cantidadNumeros,
          digitos: rifa.digitos,
          precioNumero: rifa.precioNumero,
          plazoApartadoHoras: rifa.plazoApartadoHoras,
          estado: rifa.estado,
        }}
        ocupados={ocupados}
        acciones={{
          apartar: apartarAccion.bind(null, rifa.id),
          pagar: operarAsignacionesAccion.bind(null, rifa.id, "pagar"),
          liberar: operarAsignacionesAccion.bind(null, rifa.id, "liberar"),
          cancelar: operarAsignacionesAccion.bind(null, rifa.id, "cancelar"),
        }}
      />
    </div>
  );
}

/** Menú desplegable sin JavaScript (details/summary); cada PDF se abre en otra pestaña. */
function MenuPdf({ rifaId }: { rifaId: string }) {
  return (
    <details className="group relative">
      <summary
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        })}
      >
        Imprimir PDF
      </summary>
      <ul className="absolute right-0 z-30 mt-1 w-60 rounded-lg border bg-background p-1 shadow-lg">
        {TIPOS_PDF.map((tipo) => (
          <li key={tipo}>
            <a
              href={`/rifas/${rifaId}/pdf/${tipo}`}
              target="_blank"
              rel="noopener"
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {NOMBRE_PDF[tipo]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

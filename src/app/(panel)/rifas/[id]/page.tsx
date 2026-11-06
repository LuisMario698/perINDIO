import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { formatearDinero, formatearEntero, formatearFecha } from "@/lib/formato";
import { esUuid } from "@/lib/validacion/rifa";
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
        </div>
        <div className="flex gap-2">
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

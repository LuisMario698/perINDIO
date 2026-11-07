import { notFound } from "next/navigation";
import { Suspense } from "react";

import { db } from "@/db";
import { esUuid } from "@/lib/validacion/rifa";
import { liberarApartadosVencidos } from "@/server/asignaciones";
import { listarPedidos, obtenerRifa } from "@/server/consultas";
import { obtenerUsuarioActual } from "@/server/sesion";
import { urlBase } from "@/server/url";

import { operarAsignacionesAccion } from "../acciones";
import { ListaPedidos } from "./lista-pedidos";

export const metadata = { title: "Pedidos · perINDIO" };

export default function PaginaPedidos({ params }: PageProps<"/rifas/[id]/pedidos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando pedidos…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/rifas/[id]/pedidos">, "params">) {
  const usuario = await obtenerUsuarioActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();

  await liberarApartadosVencidos(db);
  const pedidos = await listarPedidos(db, rifa.id);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Pedidos · {rifa.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Cada apartado es un pedido con folio. Cuando un comprador te mande su comprobante,
          búscalo por folio, nombre o teléfono y confirma su pago.
        </p>
      </div>
      <ListaPedidos
        pedidos={pedidos}
        rifa={{ nombre: rifa.nombre, digitos: rifa.digitos, sorteada: rifa.estado === "sorteada" }}
        urlBase={await urlBase()}
        acciones={{
          pagar: operarAsignacionesAccion.bind(null, rifa.id, "pagar"),
          liberar: operarAsignacionesAccion.bind(null, rifa.id, "liberar"),
        }}
      />
    </div>
  );
}

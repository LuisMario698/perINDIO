import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TablasVendedores } from "@/components/reporte-vendedores";
import { db } from "@/db";
import { esUuid } from "@/lib/validacion/rifa";
import { obtenerRifa } from "@/server/consultas";
import { reporteVendedores } from "@/server/reportes";
import { obtenerUsuarioActual } from "@/server/sesion";

export const metadata = { title: "Vendedores · perINDIO" };

export default function PaginaVendedoresRifa({ params }: PageProps<"/rifas/[id]/vendedores">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/rifas/[id]/vendedores">, "params">) {
  const usuario = await obtenerUsuarioActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();

  return (
    <div className="space-y-4">
      <h1 className="titulo-marca text-3xl">Vendedores · {rifa.nombre}</h1>
      <TablasVendedores reporte={await reporteVendedores(db, usuario.organizadorId, rifa.id)} />
    </div>
  );
}

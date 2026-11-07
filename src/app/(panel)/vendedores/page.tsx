import { Suspense } from "react";

import { TablasVendedores } from "@/components/reporte-vendedores";
import { db } from "@/db";
import { reporteVendedores } from "@/server/reportes";
import { obtenerUsuarioActual } from "@/server/sesion";

export const metadata = { title: "Vendedores · perINDIO" };

export default function PaginaVendedores() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Vendedores</h1>
        <p className="text-sm text-muted-foreground">
          Todas las rifas juntas. Para una sola, abre la rifa y su pestaña Vendedores.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const usuario = await obtenerUsuarioActual();
  return <TablasVendedores reporte={await reporteVendedores(db, usuario.organizadorId)} />;
}

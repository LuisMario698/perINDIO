import { Suspense } from "react";

import { esUuid } from "@/lib/validacion/rifa";
import { obtenerUsuarioActual } from "@/server/sesion";

import { PestanasRifa } from "./pestanas-rifa";

export default function LayoutRifa({ children, params }: LayoutProps<"/rifas/[id]">) {
  return (
    <div className="space-y-6">
      {/* El rol se lee de la sesión: va en su propio Suspense para no detener la página. */}
      <Suspense fallback={<div className="h-9 border-b" />}>
        <Pestanas params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function Pestanas({ params }: Pick<LayoutProps<"/rifas/[id]">, "params">) {
  const usuario = await obtenerUsuarioActual();
  const { id } = await params;
  if (!esUuid(id)) return null;
  return <PestanasRifa rifaId={id} esAdmin={usuario.rol === "admin"} />;
}

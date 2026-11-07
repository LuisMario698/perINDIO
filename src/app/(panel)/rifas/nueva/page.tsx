import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { obtenerAdminActual } from "@/server/sesion";

import { crearRifaAccion } from "../acciones";
import { FormularioRifa } from "../formulario-rifa";

export const metadata = { title: "Nueva rifa · perINDIO" };

export default function PaginaNuevaRifa() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Nueva rifa</h1>
        <p className="text-sm text-muted-foreground">
          Al crearla se generan todos sus números, listos para apartar.
        </p>
      </div>
      <Card>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
            <Formulario />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function Formulario() {
  await obtenerAdminActual();
  return <FormularioRifa modo="crear" accion={crearRifaAccion} />;
}

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { esUuid } from "@/lib/validacion/rifa";
import { obtenerRifa } from "@/server/consultas";
import { tieneAsignaciones } from "@/server/rifas";
import { obtenerAdminActual } from "@/server/sesion";

import { actualizarRifaAccion, eliminarRifaAccion } from "../../acciones";
import { EliminarRifa } from "../../eliminar-rifa";
import { FormularioRifa } from "../../formulario-rifa";

export const metadata = { title: "Configurar rifa · perINDIO" };

export default function PaginaConfiguracion({ params }: PageProps<"/rifas/[id]/configuracion">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Configuracion params={params} />
      </Suspense>
    </div>
  );
}

async function Configuracion({ params }: Pick<PageProps<"/rifas/[id]/configuracion">, "params">) {
  const usuario = await obtenerAdminActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();
  if (rifa.estado === "sorteada") {
    return (
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Configurar rifa</h1>
        <p className="text-sm text-muted-foreground">
          {rifa.nombre} ya fue sorteada; su configuración queda fija.
        </p>
      </div>
    );
  }
  const conAsignaciones = await tieneAsignaciones(db, rifa.id);

  return (
    <>
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Configurar rifa</h1>
        <p className="text-sm text-muted-foreground">{rifa.nombre}</p>
      </div>
      <Card>
        <CardContent>
          <FormularioRifa
            modo="editar"
            accion={actualizarRifaAccion.bind(null, rifa.id)}
            rangoBloqueado={conAsignaciones}
            inicial={{
              nombre: rifa.nombre,
              descripcion: rifa.descripcion ?? "",
              numeroInicial: String(rifa.numeroInicial),
              cantidadNumeros: String(rifa.cantidadNumeros),
              digitos: String(rifa.digitos),
              precioNumero: rifa.precioNumero,
              plazoApartadoHoras: String(rifa.plazoApartadoHoras),
              liberacionAutomatica: rifa.liberacionAutomatica,
              fechaSorteo: rifa.fechaSorteo ?? "",
              estado: rifa.estado,
              publica: rifa.publica,
              slug: rifa.slug,
              plazoPublicoHoras: String(rifa.plazoPublicoHoras),
              maxNumerosPublico: String(rifa.maxNumerosPublico),
              instruccionesPago: rifa.instruccionesPago ?? "",
            }}
          />
        </CardContent>
      </Card>
      {!conAsignaciones && (
        <EliminarRifa
          accion={eliminarRifaAccion.bind(null, rifa.id)}
          cantidadNumeros={rifa.cantidadNumeros}
        />
      )}
    </>
  );
}

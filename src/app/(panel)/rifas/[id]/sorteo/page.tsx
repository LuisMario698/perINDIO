import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { asignaciones } from "@/db/schema";
import { formatearFechaHora } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import { esUuid } from "@/lib/validacion/rifa";
import { obtenerRifa } from "@/server/consultas";
import { obtenerAdminActual } from "@/server/sesion";
import { listarPremios } from "@/server/sorteo";
import { urlBase } from "@/server/url";

import {
  cerrarVentasAccion,
  guardarPremiosAccion,
  reabrirVentasAccion,
  registrarResultadoAccion,
} from "./acciones";
import { CerrarVentas, EditorPremios, FormularioResultado, ReabrirVentas, Resultados } from "./sorteo-cliente";

export const metadata = { title: "Sorteo · perINDIO" };

export default function PaginaSorteo({ params }: PageProps<"/rifas/[id]/sorteo">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}

const PASOS = ["Premios", "Cerrar ventas", "Registrar resultado"] as const;

async function Contenido({ params }: Pick<PageProps<"/rifas/[id]/sorteo">, "params">) {
  const usuario = await obtenerAdminActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();

  const premios = await listarPremios(db, rifa.id);
  const [{ pendientes }] = await db
    .select({ pendientes: count() })
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.rifaId, rifa.id),
        eq(asignaciones.estado, "apartado"),
        eq(asignaciones.estadoPago, "pendiente"),
      ),
    );
  const paso = rifa.estado === "activa" ? 0 : rifa.estado === "cerrada" ? 2 : 3;
  const enlacePublico = rifa.publica ? `/r/${rifa.slug}` : null;

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Sorteo · {rifa.nombre}</h1>
        {rifa.estado === "sorteada" ? (
          <p className="text-sm text-muted-foreground">
            Sorteada el {rifa.sorteadaEn ? formatearFechaHora(rifa.sorteadaEn) : "—"}. La rifa queda
            en solo lectura.
          </p>
        ) : (
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {PASOS.map((nombre, i) => (
              <li key={nombre} className={i === paso || (paso === 0 && i === 1) ? "font-medium text-foreground" : ""}>
                {i + 1}. {nombre}
              </li>
            ))}
          </ol>
        )}
      </div>

      {rifa.estado === "sorteada" ? (
        <>
          <Resultados
            premios={premios.map((p) => ({
              ...p,
              etiqueta: p.numeroGanador === null ? null : formatearNumero(p.numeroGanador, rifa.digitos),
            }))}
            rifa={rifa.nombre}
            urlBase={await urlBase()}
          />
          {enlacePublico && (
            <Link href={enlacePublico} target="_blank" className={buttonVariants({ variant: "outline" })}>
              Ver resultados en la página pública
            </Link>
          )}
        </>
      ) : (
        <>
          <Card>
            <CardContent>
              <EditorPremios
                inicial={premios.map((p) => p.descripcion)}
                accion={guardarPremiosAccion.bind(null, rifa.id)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              {rifa.estado === "activa" ? (
                <CerrarVentas pendientes={pendientes} accion={cerrarVentasAccion.bind(null, rifa.id)} />
              ) : (
                <>
                  <h2 className="font-semibold">Registrar resultado</h2>
                  {premios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Agrega al menos un premio arriba.</p>
                  ) : (
                    <FormularioResultado
                      premios={premios.map((p) => ({ id: p.id, lugar: p.lugar, descripcion: p.descripcion }))}
                      rango={{
                        inicial: rifa.numeroInicial,
                        final: rifa.numeroInicial + rifa.cantidadNumeros - 1,
                        digitos: rifa.digitos,
                      }}
                      accion={registrarResultadoAccion.bind(null, rifa.id)}
                    />
                  )}
                  <ReabrirVentas accion={reabrirVentasAccion.bind(null, rifa.id)} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { formatearDinero, formatearEntero, formatearFecha } from "@/lib/formato";
import { listarRifasConResumen, type RifaConResumen } from "@/server/consultas";
import { obtenerUsuarioActual } from "@/server/sesion";

export default function PaginaRifas() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Rifas</h1>
        <p className="text-sm text-muted-foreground">Estado de los números de cada rifa.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando rifas…</p>}>
        <ListaRifas />
      </Suspense>
    </div>
  );
}

async function ListaRifas() {
  const usuario = await obtenerUsuarioActual();
  const lista = await listarRifasConResumen(db, usuario.organizadorId);
  const esAdmin = usuario.rol === "admin";

  return (
    <div className="space-y-4">
      {esAdmin && lista.length > 0 && (
        <div className="flex justify-end">
          <Link href="/rifas/nueva" className={buttonVariants()}>
            Nueva rifa
          </Link>
        </div>
      )}
      {lista.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hay rifas.</p>
          {esAdmin && (
            <Link href="/rifas/nueva" className={buttonVariants()}>
              Crear la primera rifa
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((rifa) => (
            <TarjetaRifa key={rifa.id} rifa={rifa} esAdmin={esAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaRifa({ rifa, esAdmin }: { rifa: RifaConResumen; esAdmin: boolean }) {
  const datos = [
    { etiqueta: "Disponibles", valor: rifa.disponibles },
    { etiqueta: "Apartados", valor: rifa.apartados },
    { etiqueta: "Vencidos", valor: rifa.vencidos },
    { etiqueta: "Vendidos", valor: rifa.vendidos },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href={`/rifas/${rifa.id}`} className="hover:underline">
            {rifa.nombre}
          </Link>
        </CardTitle>
        <CardDescription>
          {formatearEntero(rifa.cantidadNumeros)} números · {formatearDinero(rifa.precioNumero)}{" "}
          cada uno
        </CardDescription>
        <CardAction>
          <Badge variant={rifa.estado === "activa" ? "default" : "outline"}>
            {rifa.estado === "activa" ? "Activa" : "Cerrada"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {datos.map((dato) => (
            <div key={dato.etiqueta} className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">{dato.etiqueta}</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatearEntero(dato.valor)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {rifa.liberacionAutomatica
            ? "Los apartados vencidos se liberan solos."
            : "Los apartados vencidos se liberan a mano."}
          {rifa.fechaSorteo && ` Sorteo: ${formatearFecha(rifa.fechaSorteo)}.`}
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {esAdmin && (
          <Link
            href={`/rifas/${rifa.id}/configuracion`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Configurar
          </Link>
        )}
        <Link href={`/rifas/${rifa.id}`} className={buttonVariants({ size: "sm" })}>
          Ver números
        </Link>
      </CardFooter>
    </Card>
  );
}

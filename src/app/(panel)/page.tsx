import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { formatearDinero, formatearEntero } from "@/lib/formato";
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

  if (lista.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay rifas.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {lista.map((rifa) => (
        <TarjetaRifa key={rifa.id} rifa={rifa} />
      ))}
    </div>
  );
}

function TarjetaRifa({ rifa }: { rifa: RifaConResumen }) {
  const datos = [
    { etiqueta: "Disponibles", valor: rifa.disponibles },
    { etiqueta: "Apartados", valor: rifa.apartados },
    { etiqueta: "Vencidos", valor: rifa.vencidos },
    { etiqueta: "Vendidos", valor: rifa.vendidos },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{rifa.nombre}</CardTitle>
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
        </p>
      </CardContent>
    </Card>
  );
}

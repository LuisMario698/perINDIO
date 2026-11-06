import { cn } from "cn";
import Link from "next/link";
import { Suspense } from "react";

import { BarraEstados } from "@/components/barra-estados";
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
import { COLOR_ESTADO, type EstadoVisible } from "@/lib/colores-estado";
import {
  formatearDinero,
  formatearDineroRedondo,
  formatearEntero,
  formatearFecha,
  formatearPorcentaje,
} from "@/lib/formato";
import { listarRifasConResumen, type RifaConResumen } from "@/server/consultas";
import { obtenerUsuarioActual } from "@/server/sesion";

export default function PaginaResumen() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          Lo cobrado, lo pendiente y el estado de los números de cada rifa.
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
  const lista = await listarRifasConResumen(db, usuario.organizadorId);
  const esAdmin = usuario.rol === "admin";

  if (lista.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Todavía no hay rifas.</p>
        {esAdmin && (
          <Link href="/rifas/nueva" className={buttonVariants()}>
            Crear la primera rifa
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Indicadores lista={lista} />
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Rifas</h2>
          {esAdmin && (
            <Link href="/rifas/nueva" className={buttonVariants()}>
              Nueva rifa
            </Link>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((rifa) => (
            <TarjetaRifa key={rifa.id} rifa={rifa} esAdmin={esAdmin} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Cifras de todas las rifas juntas. */
function Indicadores({ lista }: { lista: RifaConResumen[] }) {
  const suma = (valor: (r: RifaConResumen) => number) => lista.reduce((t, r) => t + valor(r), 0);
  const total = suma((r) => r.cantidadNumeros);
  const vendidos = suma((r) => r.vendidos);
  const sinPagar = suma((r) => r.apartados + r.vencidos);
  const vencidos = suma((r) => r.vencidos);
  const cobrado = suma((r) => Number(r.cobrado));
  const porCobrar = suma((r) => Number(r.porCobrar));
  const porCobrarVencido = suma((r) => Number(r.porCobrarVencido));
  const rifas = lista.length === 1 ? "1 rifa" : `${lista.length} rifas`;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicador
        nombre="Cobrado"
        valor={formatearDineroRedondo(cobrado)}
        nota={`Pagos confirmados en ${rifas}`}
      />
      <Indicador
        nombre="Por cobrar"
        valor={formatearDineroRedondo(porCobrar)}
        nota={`${formatearEntero(sinPagar)} apartados sin pagar`}
      />
      <Indicador
        nombre="Vendidos"
        valor={formatearEntero(vendidos)}
        nota={`${formatearPorcentaje(total ? vendidos / total : 0)} de ${formatearEntero(total)} números`}
      />
      <Indicador
        nombre="Vencidos"
        valor={formatearEntero(vencidos)}
        nota={
          vencidos
            ? `${formatearDineroRedondo(porCobrarVencido)} por cobrar o liberar`
            : "Ninguno pendiente"
        }
        resaltar={vencidos > 0}
      />
    </dl>
  );
}

function Indicador({
  nombre,
  valor,
  nota,
  resaltar = false,
}: {
  nombre: string;
  valor: string;
  nota: string;
  resaltar?: boolean;
}) {
  return (
    <div className={cn("space-y-1 rounded-xl border p-4", resaltar && "border-red-300 bg-red-50")}>
      <dt className="text-sm text-muted-foreground">{nombre}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted-foreground">{nota}</dd>
    </div>
  );
}

function TarjetaRifa({ rifa, esAdmin }: { rifa: RifaConResumen; esAdmin: boolean }) {
  const conteos: Record<EstadoVisible, number> = {
    vendido: rifa.vendidos,
    apartado: rifa.apartados,
    vencido: rifa.vencidos,
    disponible: rifa.disponibles,
  };
  const datos: { estado: EstadoVisible; etiqueta: string }[] = [
    { estado: "vendido", etiqueta: "Vendidos" },
    { estado: "apartado", etiqueta: "Apartados" },
    { estado: "vencido", etiqueta: "Vencidos" },
    { estado: "disponible", etiqueta: "Disponibles" },
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
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Cobrado</p>
            <p className="text-lg font-semibold tabular-nums">{formatearDinero(rifa.cobrado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Por cobrar</p>
            <p className="text-lg font-semibold tabular-nums">{formatearDinero(rifa.porCobrar)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Avance de ventas</span>
            <span className="tabular-nums">
              {formatearPorcentaje(rifa.vendidos / rifa.cantidadNumeros)} vendido
            </span>
          </div>
          <BarraEstados conteos={conteos} />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {datos.map(({ estado, etiqueta }) => (
            <div key={estado} className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 shrink-0 rounded-full", COLOR_ESTADO[estado])} />
                {etiqueta}
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatearEntero(conteos[estado])}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
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
        <Link
          href={`/rifas/${rifa.id}/historial`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Historial
        </Link>
        <Link href={`/rifas/${rifa.id}`} className={buttonVariants({ size: "sm" })}>
          Ver números
        </Link>
      </CardFooter>
    </Card>
  );
}

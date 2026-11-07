"use client";

import { cn } from "cn";
import { useMemo, useState } from "react";

import { BotonCopiar } from "@/components/boton-copiar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearDinero, formatearEntero, formatearFechaHora } from "@/lib/formato";
import { mensajeRecordatorio } from "@/lib/mensajes";
import { formatearNumero } from "@/lib/numeros";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/telefono";
import type { PedidoDelPanel } from "@/server/consultas";
import type { EstadoPedido } from "@/server/pedidos";

import { BotonOperacion } from "../boton-operacion";
import type { AccionesTablero } from "../estados";
import { normalizar } from "../estados";

type Filtro = "todos" | "por-cobrar" | EstadoPedido | "publico";

const FILTROS: { valor: Filtro; nombre: string }[] = [
  { valor: "todos", nombre: "Todos" },
  { valor: "por-cobrar", nombre: "Por cobrar" },
  { valor: "vencido", nombre: "Vencidos" },
  { valor: "parcial", nombre: "Pagados en parte" },
  { valor: "pagado", nombre: "Pagados" },
  { valor: "cancelado", nombre: "Liberados o cancelados" },
  { valor: "publico", nombre: "De la página pública" },
];

const ESTADO: Record<EstadoPedido, { nombre: string; clase: string }> = {
  pendiente: { nombre: "Pago pendiente", clase: "bg-amber-100 text-amber-950" },
  parcial: { nombre: "Pagado en parte", clase: "bg-amber-100 text-amber-950" },
  vencido: { nombre: "Vencido", clase: "bg-red-100 text-red-950" },
  pagado: { nombre: "Pagado", clase: "bg-emerald-100 text-emerald-950" },
  cancelado: { nombre: "Liberado o cancelado", clase: "bg-muted text-muted-foreground" },
};

const POR_PAGINA = 50;

function cumple(filtro: Filtro, p: PedidoDelPanel) {
  if (filtro === "todos") return true;
  if (filtro === "publico") return p.origen === "publico";
  if (filtro === "por-cobrar") return p.porPagar > 0;
  return p.estado === filtro;
}

/** Lista de pedidos con búsqueda por folio, nombre o teléfono y las acciones de cobro. */
export function ListaPedidos({
  pedidos,
  rifa,
  urlBase,
  acciones,
}: {
  pedidos: PedidoDelPanel[];
  rifa: { nombre: string; digitos: number; sorteada: boolean };
  urlBase: string;
  acciones: Pick<AccionesTablero, "pagar" | "liberar">;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("por-cobrar");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const conteos = useMemo(
    () =>
      Object.fromEntries(
        FILTROS.map((f) => [f.valor, pedidos.filter((p) => cumple(f.valor, p)).length]),
      ) as Record<Filtro, number>,
    [pedidos],
  );

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    const digitos = busqueda.replace(/\D/g, "");
    return pedidos.filter((p) => {
      if (!cumple(filtro, p)) return false;
      if (!texto) return true;
      return (
        p.folio.toLowerCase().includes(texto) ||
        normalizar(p.comprador).includes(texto) ||
        (digitos.length >= 3 && (p.telefono ?? "").replace(/\D/g, "").includes(digitos))
      );
    });
  }, [pedidos, filtro, busqueda]);

  return (
    <div className="space-y-4">
      {aviso && (
        <p
          role={aviso.tipo === "exito" ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            aviso.tipo === "exito"
              ? "bg-emerald-50 text-emerald-900"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {aviso.texto}
        </p>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filtrar pedidos" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => {
                setFiltro(f.valor);
                setLimite(POR_PAGINA);
              }}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                filtro === f.valor
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted",
              )}
            >
              {f.nombre}
              <span className="tabular-nums opacity-70">{formatearEntero(conteos[f.valor])}</span>
            </button>
          ))}
        </div>
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Folio, nombre o teléfono"
          aria-label="Buscar pedido por folio, nombre o teléfono"
          className="md:max-w-64"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ningún pedido coincide con el filtro o la búsqueda.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.slice(0, limite).map((pedido) => (
            <TarjetaPedido
              key={pedido.id}
              pedido={pedido}
              rifa={rifa}
              urlBase={urlBase}
              acciones={acciones}
              onTerminar={(texto) => setAviso({ tipo: "exito", texto: `${pedido.folio}: ${texto}` })}
              onError={(texto) => setAviso({ tipo: "error", texto })}
            />
          ))}
        </ul>
      )}
      {visibles.length > limite && (
        <Button variant="outline" onClick={() => setLimite((l) => l + POR_PAGINA)}>
          Mostrar más ({formatearEntero(visibles.length - limite)} restantes)
        </Button>
      )}
    </div>
  );
}

function TarjetaPedido({
  pedido,
  rifa,
  urlBase,
  acciones,
  onTerminar,
  onError,
}: {
  pedido: PedidoDelPanel;
  rifa: { nombre: string; digitos: number; sorteada: boolean };
  urlBase: string;
  acciones: Pick<AccionesTablero, "pagar" | "liberar">;
  onTerminar: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}) {
  const url = `${urlBase}/p/${pedido.token}`;
  const telefono = pedido.telefono ? normalizarTelefono(pedido.telefono) : null;
  const etiquetas = pedido.asignaciones
    .filter((a) => a.estado === "apartado" || a.estado === "vendido")
    .map((a) => formatearNumero(a.numero, rifa.digitos));
  const operable = !rifa.sorteada;

  return (
    <li className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-wider">{pedido.folio}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs", ESTADO[pedido.estado].clase)}>
              {ESTADO[pedido.estado].nombre}
            </span>
          </p>
          <p className="text-sm">
            {pedido.comprador}
            {pedido.telefono && <span className="text-muted-foreground"> · {pedido.telefono}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {pedido.origen === "publico" ? "Página pública" : `Vendió ${pedido.vendedor ?? "—"}`} ·{" "}
            {formatearFechaHora(pedido.creadoEn)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 text-right text-sm">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dt className="text-xs text-muted-foreground">Por pagar</dt>
          <dd className="font-semibold tabular-nums">{formatearDinero(pedido.total)}</dd>
          <dd className="font-semibold tabular-nums">{formatearDinero(pedido.porPagar)}</dd>
        </dl>
      </div>

      <ul className="flex flex-wrap gap-1" aria-label="Números del pedido">
        {pedido.asignaciones.map((a) => (
          <li
            key={a.id}
            title={
              a.estado === "vendido"
                ? "Pagado"
                : a.estado === "apartado"
                  ? "Pago pendiente"
                  : "Liberado o cancelado"
            }
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              a.estado === "vendido" && "border-emerald-300 bg-emerald-50",
              a.estado === "apartado" && "border-amber-300 bg-amber-50",
              (a.estado === "liberado" || a.estado === "cancelado") &&
                "text-muted-foreground line-through",
            )}
          >
            {formatearNumero(a.numero, rifa.digitos)}
          </li>
        ))}
      </ul>

      {pedido.venceEn && (
        <p className={cn("text-xs", pedido.estado === "vencido" ? "text-destructive" : "text-muted-foreground")}>
          {pedido.estado === "vencido" ? "Venció" : "Vence"} el {formatearFechaHora(pedido.venceEn)}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-2">
        {operable && pedido.pendientesIds.length > 0 && (
          <div className="min-w-48">
            <BotonOperacion
              accion={acciones.pagar}
              ids={pedido.pendientesIds}
              onTerminar={onTerminar}
              onError={onError}
            >
              Confirmar pago · {formatearDinero(pedido.porPagar)}
            </BotonOperacion>
          </div>
        )}
        {operable && pedido.liberablesIds.length > 0 && (
          <div className="min-w-48">
            <BotonOperacion
              accion={acciones.liberar}
              ids={pedido.liberablesIds}
              onTerminar={onTerminar}
              onError={onError}
              variante="outline"
              confirmacion={`Los ${pedido.liberablesIds.length} números sin pagar de ${pedido.folio} vuelven a estar disponibles.`}
            >
              Liberar sin pagar
            </BotonOperacion>
          </div>
        )}
        {telefono && pedido.porPagar > 0 && (
          <a
            href={enlaceWhatsApp(
              telefono,
              mensajeRecordatorio({
                comprador: pedido.comprador,
                rifa: rifa.nombre,
                folio: pedido.folio,
                numeros: etiquetas,
                porPagar: pedido.porPagar,
                venceEn: pedido.venceEn,
                url,
              }),
            )}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: "outline" })}
          >
            Recordar por WhatsApp
          </a>
        )}
        <BotonCopiar texto={url} etiqueta="Copiar enlace" variante="ghost" />
      </div>
    </li>
  );
}

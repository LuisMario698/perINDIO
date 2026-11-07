"use client";

import { cn } from "cn";
import { memo, useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearDinero, formatearEntero } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import type { NumeroOcupado } from "@/server/consultas";

import {
  categoriaDe,
  cumpleFiltro,
  ESTILO_CATEGORIA,
  FILTROS,
  NOMBRE_CATEGORIA,
  normalizar,
  PUNTO_CATEGORIA,
  type AccionesTablero,
  type Categoria,
  type Filtro,
  type RifaTablero,
} from "./estados";
import type { PedidoCreado } from "./acciones";
import { CompartirPedido } from "./compartir-pedido";
import { PanelApartar } from "./panel-apartar";
import { PanelDetalle } from "./panel-detalle";

type Props = {
  rifa: RifaTablero;
  ocupados: NumeroOcupado[];
  acciones: AccionesTablero;
  /** Origen público de la app, para los enlaces que se mandan al comprador. */
  urlBase: string;
};

/**
 * Cuadrícula de números con filtros, búsqueda y el panel de acciones.
 * Los disponibles se tocan para seleccionarlos y apartarlos juntos; un número ocupado
 * se toca para ver su detalle (comprador, pago, vencimiento) y operar sobre él.
 */
export function Tablero({ rifa, ocupados, acciones, urlBase }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  // En celular, mientras se eligen números se muestra una barra compacta; el formulario
  // se abre como hoja inferior al tocar "Apartar".
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [aviso, setAviso] = useState<{
    tipo: "exito" | "error";
    texto: string;
    pedido?: PedidoCreado;
  } | null>(null);

  const porNumero = useMemo(() => new Map(ocupados.map((o) => [o.numero, o])), [ocupados]);
  const numeros = useMemo(
    () => Array.from({ length: rifa.cantidadNumeros }, (_, i) => rifa.numeroInicial + i),
    [rifa.cantidadNumeros, rifa.numeroInicial],
  );

  const conteos = useMemo(() => {
    const c: Record<Filtro, number> = {
      todos: rifa.cantidadNumeros,
      disponible: rifa.cantidadNumeros - ocupados.length,
      apartado: 0,
      vencido: 0,
      vendido: 0,
      pendientes: 0,
    };
    for (const o of ocupados) {
      const categoria = categoriaDe(o);
      c[categoria]++;
      if (categoria !== "vendido") c.pendientes++;
    }
    return c;
  }, [ocupados, rifa.cantidadNumeros]);

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda);
    const porNumeroBuscado = /^\d+$/.test(termino);
    return numeros.filter((n) => {
      const ocupado = porNumero.get(n);
      if (!cumpleFiltro(filtro, categoriaDe(ocupado))) return false;
      if (!termino) return true;
      if (porNumeroBuscado) return formatearNumero(n, rifa.digitos).includes(termino);
      return Boolean(ocupado?.compradorNombre && normalizar(ocupado.compradorNombre).includes(termino));
    });
  }, [numeros, porNumero, filtro, busqueda, rifa.digitos]);

  // Si otra persona apartó un número seleccionado, sale de la selección al actualizarse los datos.
  const seleccionVigente = seleccion.filter((n) => !porNumero.has(n));
  const seleccionados = new Set(seleccionVigente);
  const ocupadoAbierto = abierto === null ? undefined : porNumero.get(abierto);
  const activa = rifa.estado === "activa";

  const tocar = useCallback(
    (numero: number) => {
      setAviso(null);
      setHojaAbierta(false);
      if (porNumero.has(numero)) {
        setAbierto(numero);
        setSeleccion([]);
        return;
      }
      setAbierto(null);
      if (!activa) return;
      setSeleccion((previa) =>
        previa.includes(numero)
          ? previa.filter((n) => n !== numero)
          : [...previa, numero].sort((a, b) => a - b),
      );
    },
    [porNumero, activa],
  );

  function terminar(mensaje: string, pedido?: PedidoCreado) {
    setAviso({ tipo: "exito", texto: mensaje, pedido });
    setSeleccion([]);
    setAbierto(null);
    setHojaAbierta(false);
  }

  // Un error se muestra en su panel; si el panel se cierra porque los datos cambiaron
  // (otra persona apartó o liberó el número), se muestra arriba para no perderlo.
  function avisarError(mensaje: string) {
    setAviso({ tipo: "error", texto: mensaje });
  }

  const delComprador = ocupadoAbierto
    ? ocupados.filter((o) => o.compradorId === ocupadoAbierto.compradorId)
    : [];
  const panelActivo = Boolean(ocupadoAbierto) || seleccionVigente.length > 0;
  const hojaVisible = Boolean(ocupadoAbierto) || (seleccionVigente.length > 0 && hojaAbierta);

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {rifa.estado === "cerrada" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Las ventas de esta rifa están cerradas: puedes consultar los números y registrar pagos,
          pero ya no apartar ni vender.
        </p>
      )}
      {rifa.estado === "sorteada" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Esta rifa ya fue sorteada: los números quedan como estaban y solo se pueden consultar.
        </p>
      )}
      {aviso?.tipo === "exito" && (
        <div role="status" className="space-y-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>{aviso.texto}</p>
          {aviso.pedido && (
            <CompartirPedido pedido={aviso.pedido} rifa={rifa.nombre} urlBase={urlBase} />
          )}
        </div>
      )}
      {aviso?.tipo === "error" && !panelActivo && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {aviso.texto}
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filtrar números" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                filtro === f.valor
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted",
              )}
            >
              {f.categoria && (
                <span className={cn("size-2 rounded-full", PUNTO_CATEGORIA[f.categoria])} />
              )}
              {f.nombre}
              <span className="tabular-nums opacity-70">{formatearEntero(conteos[f.valor])}</span>
            </button>
          ))}
        </div>
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar número o comprador"
          aria-label="Buscar número o comprador"
          className="md:max-w-64"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {visibles.length === numeros.length
              ? `${formatearEntero(numeros.length)} números`
              : `${formatearEntero(visibles.length)} de ${formatearEntero(numeros.length)} números`}
            {activa && " · Toca los disponibles para apartarlos."}
          </p>
          {visibles.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Ningún número coincide con el filtro o la búsqueda.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1">
              {visibles.map((n) => {
                const ocupado = porNumero.get(n);
                return (
                  <Celda
                    key={n}
                    numero={n}
                    etiqueta={formatearNumero(n, rifa.digitos)}
                    categoria={categoriaDe(ocupado)}
                    comprador={ocupado?.compradorNombre ?? null}
                    seleccionado={seleccionados.has(n)}
                    abierto={abierto === n}
                    onTocar={tocar}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* En pantallas chicas el panel aparece como hoja inferior solo cuando hay algo que hacer. */}
        <aside
          aria-label="Acciones"
          className={cn(
            "lg:sticky lg:top-4 lg:block",
            hojaVisible
              ? "fixed inset-x-0 bottom-0 z-20 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t bg-background p-4 shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none"
              : "hidden",
          )}
        >
          {ocupadoAbierto ? (
            <PanelDetalle
              key={ocupadoAbierto.asignacionId}
              rifa={rifa}
              ocupado={ocupadoAbierto}
              delComprador={delComprador}
              acciones={acciones}
              urlBase={urlBase}
              onTerminar={terminar}
              onError={avisarError}
              onCerrar={() => setAbierto(null)}
            />
          ) : seleccionVigente.length > 0 ? (
            <PanelApartar
              rifa={rifa}
              numeros={seleccionVigente}
              ocupados={ocupados}
              accion={acciones.apartar}
              onTerminar={terminar}
              onError={avisarError}
              onQuitar={tocar}
              onLimpiar={() => setSeleccion([])}
              onMinimizar={() => setHojaAbierta(false)}
            />
          ) : (
            <div className="space-y-3 rounded-xl border p-4 text-sm text-muted-foreground">
              {activa && <p>Toca uno o varios números disponibles para apartarlos o venderlos.</p>}
              <p>Toca un número de color para ver al comprador, confirmar su pago o liberarlo.</p>
              <ul className="space-y-1.5">
                {(Object.keys(NOMBRE_CATEGORIA) as Categoria[]).map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <span className={cn("size-3 rounded", PUNTO_CATEGORIA[c])} />
                    {NOMBRE_CATEGORIA[c]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {seleccionVigente.length > 0 && !hojaAbierta && !ocupadoAbierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background p-3 shadow-2xl lg:hidden">
          <p className="text-sm">
            <strong>
              {seleccionVigente.length === 1
                ? "1 seleccionado"
                : `${seleccionVigente.length} seleccionados`}
            </strong>{" "}
            · {formatearDinero(Number(rifa.precioNumero) * seleccionVigente.length)}
          </p>
          <Button size="lg" onClick={() => setHojaAbierta(true)}>
            Apartar
          </Button>
        </div>
      )}
    </div>
  );
}

// memo: al seleccionar un número solo se vuelve a dibujar esa celda, no las 2,000.
const Celda = memo(function Celda({
  numero,
  etiqueta,
  categoria,
  comprador,
  seleccionado,
  abierto,
  onTocar,
}: {
  numero: number;
  etiqueta: string;
  categoria: Categoria;
  comprador: string | null;
  seleccionado: boolean;
  abierto: boolean;
  onTocar: (numero: number) => void;
}) {
  const descripcion = comprador
    ? `${etiqueta}, ${NOMBRE_CATEGORIA[categoria].toLowerCase()}, ${comprador}`
    : `${etiqueta}, ${NOMBRE_CATEGORIA[categoria].toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={() => onTocar(numero)}
      aria-label={descripcion}
      aria-pressed={categoria === "disponible" ? seleccionado : undefined}
      title={descripcion}
      className={cn(
        "h-9 rounded-md border font-mono text-xs tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        seleccionado
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
          : ESTILO_CATEGORIA[categoria],
        abierto && "ring-2 ring-foreground ring-offset-1",
      )}
    >
      {etiqueta}
    </button>
  );
});

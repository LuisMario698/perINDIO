"use client";

import { cn } from "cn";
import { memo, useActionState, useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_ESTADO } from "@/lib/colores-estado";
import { formatearDinero, formatearEntero } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";

import type { EstadoApartadoPublico } from "./acciones";

type Props = {
  rifa: {
    numeroInicial: number;
    cantidadNumeros: number;
    digitos: number;
    precioNumero: string;
    maxNumeros: number;
    plazoHoras: number;
  };
  ocupados: number[];
  accion: (estado: EstadoApartadoPublico, formData: FormData) => Promise<EstadoApartadoPublico>;
};

/**
 * Cuadrícula pública: solo distingue disponibles de ocupados (nunca muestra compradores).
 * El comprador elige números y los aparta con su nombre y WhatsApp.
 */
export function SeleccionPublica({ rifa, ocupados, accion }: Props) {
  const prefijo = useId();
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // Controlados: si un número ya estaba ocupado, no se pierde lo que escribió.
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const ocupado = useMemo(() => new Set(ocupados), [ocupados]);
  const numeros = useMemo(
    () => Array.from({ length: rifa.cantidadNumeros }, (_, i) => rifa.numeroInicial + i),
    [rifa.cantidadNumeros, rifa.numeroInicial],
  );
  const visibles = useMemo(() => {
    const termino = busqueda.replace(/\D/g, "");
    return numeros.filter(
      (n) =>
        (!soloDisponibles || !ocupado.has(n)) &&
        (!termino || formatearNumero(n, rifa.digitos).includes(termino)),
    );
  }, [numeros, ocupado, soloDisponibles, busqueda, rifa.digitos]);

  // Si alguien más apartó un número elegido, sale de la selección al actualizarse la página.
  const elegidos = seleccion.filter((n) => !ocupado.has(n));
  const elegidosSet = new Set(elegidos);
  const lleno = elegidos.length >= rifa.maxNumeros;
  const total = Number(rifa.precioNumero) * elegidos.length;

  const tocar = useCallback(
    (numero: number) => {
      setSeleccion((previa) => {
        if (previa.includes(numero)) return previa.filter((n) => n !== numero);
        if (previa.filter((n) => !ocupado.has(n)).length >= rifa.maxNumeros) return previa;
        return [...previa, numero].sort((a, b) => a - b);
      });
    },
    [ocupado, rifa.maxNumeros],
  );

  const errores = estado.errores ?? {};
  const cantidad = elegidos.length === 1 ? "1 número" : `${elegidos.length} números`;

  return (
    <div className="grid items-start gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            inputMode="numeric"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un número"
            aria-label="Buscar un número"
            className="max-w-48"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soloDisponibles}
              onChange={(e) => setSoloDisponibles(e.target.checked)}
              className="size-4 accent-primary"
            />
            Solo disponibles
          </label>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-4 rounded", COLOR_ESTADO.disponible)} /> Libre
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-4 rounded bg-muted" /> Ocupado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-4 rounded bg-primary" /> Tu elección
            </span>
          </span>
        </div>
        {visibles.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Ningún número coincide con la búsqueda.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5">
            {visibles.map((n) => (
              <Celda
                key={n}
                numero={n}
                etiqueta={formatearNumero(n, rifa.digitos)}
                ocupado={ocupado.has(n)}
                elegido={elegidosSet.has(n)}
                bloqueado={lleno && !elegidosSet.has(n)}
                onTocar={tocar}
              />
            ))}
          </div>
        )}
        {lleno && (
          <p className="text-sm text-muted-foreground">
            Puedes apartar hasta {rifa.maxNumeros} números por pedido.
          </p>
        )}
      </div>

      <aside
        aria-label="Apartar"
        className={cn(
          "lg:sticky lg:top-4 lg:block",
          elegidos.length > 0 && hojaAbierta
            ? "fixed inset-x-0 bottom-0 z-20 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-background p-4 shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none"
            : "hidden",
        )}
      >
        <form action={enviar} className="space-y-4 lg:rounded-xl lg:border lg:p-4">
          {elegidos.map((n) => (
            <input key={n} type="hidden" name="numeros" value={n} />
          ))}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="titulo-marca text-xl">
                {elegidos.length ? `Apartar ${cantidad}` : "Elige tus números"}
              </h3>
              <p className="text-sm">
                Total: <strong className="text-base">{formatearDinero(total)}</strong>
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setHojaAbierta(false)}
            >
              Elegir más
            </Button>
          </div>
          {elegidos.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Números elegidos">
              {elegidos.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => tocar(n)}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 font-mono text-sm text-primary-foreground"
                    aria-label={`Quitar ${formatearNumero(n, rifa.digitos)}`}
                  >
                    {formatearNumero(n, rifa.digitos)} <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${prefijo}-nombre`}>Tu nombre completo</Label>
            <Input
              id={`${prefijo}-nombre`}
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
              required
              maxLength={80}
              aria-invalid={Boolean(errores.nombre) || undefined}
            />
            {errores.nombre && <p className="text-xs text-destructive">{errores.nombre}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefijo}-telefono`}>Tu WhatsApp</Label>
            <Input
              id={`${prefijo}-telefono`}
              name="telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
              placeholder="10 dígitos"
              required
              aria-invalid={Boolean(errores.telefono) || undefined}
            />
            {errores.telefono ? (
              <p className="text-xs text-destructive">{errores.telefono}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                El organizador te contactará por aquí para confirmar tu pago.
              </p>
            )}
          </div>
          {/* Campo trampa para bots: oculto para las personas y para los lectores de pantalla. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Sitio web
              <input name="sitio" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          {estado.error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {estado.error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={enviando || elegidos.length === 0}>
            {enviando ? "Apartando…" : elegidos.length ? `Apartar ${cantidad}` : "Elige al menos un número"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tendrás {rifa.plazoHoras} horas para pagar. Después verás cómo pagar y el folio de tu
            pedido.
          </p>
        </form>
      </aside>

      {elegidos.length > 0 && !hojaAbierta && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-marca-noche p-3 text-white shadow-2xl lg:hidden">
          <p className="text-sm">
            <strong className="text-marca-oro">{cantidad}</strong> · {formatearDinero(total)}
          </p>
          <Button size="lg" className="h-11 px-5 text-base" onClick={() => setHojaAbierta(true)}>
            Apartar →
          </Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {elegidos.length
          ? `${formatearEntero(elegidos.length)} elegidos, total ${formatearDinero(total)}`
          : ""}
      </p>
    </div>
  );
}

const Celda = memo(function Celda({
  numero,
  etiqueta,
  ocupado,
  elegido,
  bloqueado,
  onTocar,
}: {
  numero: number;
  etiqueta: string;
  ocupado: boolean;
  elegido: boolean;
  bloqueado: boolean;
  onTocar: (numero: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={ocupado || bloqueado}
      onClick={() => onTocar(numero)}
      aria-pressed={ocupado ? undefined : elegido}
      aria-label={`${etiqueta}, ${ocupado ? "ocupado" : "disponible"}`}
      className={cn(
        "h-10 rounded-md border font-mono text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        ocupado
          ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60 line-through"
          : elegido
            ? "border-primary bg-primary font-semibold text-primary-foreground"
            : "border-border bg-background hover:border-primary hover:bg-green-50 disabled:opacity-50",
      )}
    >
      {etiqueta}
    </button>
  );
});

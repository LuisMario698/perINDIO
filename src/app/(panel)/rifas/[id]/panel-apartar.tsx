"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearDinero } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import type { NumeroOcupado } from "@/server/consultas";

import type { EstadoTablero } from "./acciones";
import type { AccionesTablero, RifaTablero } from "./estados";

const MAXIMO_VISIBLES = 40;

const CLASES_SELECT =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/** Formulario para apartar o vender los números seleccionados a un comprador. */
export function PanelApartar({
  rifa,
  numeros,
  ocupados,
  accion,
  onTerminar,
  onError,
  onQuitar,
  onLimpiar,
  onMinimizar,
}: {
  rifa: RifaTablero;
  numeros: number[];
  ocupados: NumeroOcupado[];
  accion: AccionesTablero["apartar"];
  onTerminar: (mensaje: string) => void;
  onError: (mensaje: string) => void;
  onQuitar: (numero: number) => void;
  onLimpiar: () => void;
  /** En celular: esconde la hoja para seguir eligiendo números. */
  onMinimizar: () => void;
}) {
  const prefijo = useId();
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoTablero, formData: FormData) => {
      const resultado = await accion(previo, formData);
      if (resultado.mensaje) onTerminar(resultado.mensaje);
      if (resultado.error) onError(resultado.error);
      return resultado;
    },
    {},
  );
  // Campos controlados: React limpia los no controlados al enviar, y si un número ya estaba
  // ocupado no queremos que se pierda lo capturado.
  const [compradorId, setCompradorId] = useState("");
  const [pagado, setPagado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [plazo, setPlazo] = useState(String(rifa.plazoApartadoHoras));
  const [observaciones, setObservaciones] = useState("");

  // Compradores que ya tienen números en esta rifa, para sumarles más sin volver a capturarlos.
  const compradores = useMemo(() => {
    const unicos = new Map<string, { id: string; nombre: string; telefono: string | null }>();
    for (const o of ocupados) {
      if (o.compradorId && o.compradorNombre && !unicos.has(o.compradorId)) {
        unicos.set(o.compradorId, {
          id: o.compradorId,
          nombre: o.compradorNombre,
          telefono: o.compradorTelefono,
        });
      }
    }
    return [...unicos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ocupados]);

  const errores = estado.errores ?? {};
  const total = Number(rifa.precioNumero) * numeros.length;
  const cantidad = numeros.length === 1 ? "1 número" : `${numeros.length} números`;

  return (
    <form action={enviar} className="space-y-4 lg:rounded-xl lg:border lg:p-4">
      {numeros.map((n) => (
        <input key={n} type="hidden" name="numeros" value={n} />
      ))}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            {pagado ? "Vender" : "Apartar"} {cantidad}
          </h2>
          <p className="text-sm text-muted-foreground">Total: {formatearDinero(total)}</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onMinimizar} className="lg:hidden">
            Elegir más
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onLimpiar}>
            Quitar todos
          </Button>
        </div>
      </div>

      <ul className="flex max-h-32 flex-wrap gap-1 overflow-y-auto" aria-label="Números seleccionados">
        {numeros.slice(0, MAXIMO_VISIBLES).map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => onQuitar(n)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2 font-mono text-xs text-background hover:bg-foreground/80"
              aria-label={`Quitar ${formatearNumero(n, rifa.digitos)}`}
            >
              {formatearNumero(n, rifa.digitos)} <span aria-hidden>×</span>
            </button>
          </li>
        ))}
        {numeros.length > MAXIMO_VISIBLES && (
          <li className="self-center text-xs text-muted-foreground">
            y {numeros.length - MAXIMO_VISIBLES} más
          </li>
        )}
      </ul>

      {compradores.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-compradorId`}>Comprador</Label>
          <select
            id={`${prefijo}-compradorId`}
            name="compradorId"
            value={compradorId}
            onChange={(e) => setCompradorId(e.target.value)}
            className={CLASES_SELECT}
          >
            <option value="">Comprador nuevo</option>
            {compradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.telefono ? ` · ${c.telefono}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {!compradorId && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefijo}-nombre`}>Nombre del comprador</Label>
            <Input
              id={`${prefijo}-nombre`}
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={120}
              autoComplete="off"
              aria-invalid={Boolean(errores.nombre) || undefined}
              aria-describedby={errores.nombre ? `${prefijo}-nombre-error` : undefined}
            />
            {errores.nombre && (
              <p id={`${prefijo}-nombre-error`} className="text-xs text-destructive">
                {errores.nombre}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefijo}-telefono`}>Teléfono (opcional)</Label>
            <Input
              id={`${prefijo}-telefono`}
              name="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              inputMode="tel"
              maxLength={30}
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
        <input
          type="checkbox"
          name="pagoConfirmado"
          checked={pagado}
          onChange={(e) => setPagado(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Ya pagó</span>
          <span className="block text-xs text-muted-foreground">
            Se registra como venta con el pago confirmado, sin plazo.
          </span>
        </span>
      </label>

      {pagado ? (
        <input type="hidden" name="plazoHoras" value={rifa.plazoApartadoHoras} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-plazo`}>Plazo para pagar (horas)</Label>
          <Input
            id={`${prefijo}-plazo`}
            name="plazoHoras"
            type="number"
            inputMode="numeric"
            min={1}
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
            required
            aria-invalid={Boolean(errores.plazoHoras) || undefined}
          />
          {errores.plazoHoras && <p className="text-xs text-destructive">{errores.plazoHoras}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${prefijo}-observaciones`}>Observaciones (opcional)</Label>
        <Textarea
          id={`${prefijo}-observaciones`}
          name="observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </div>

      {estado.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {estado.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? "Guardando…" : `${pagado ? "Vender" : "Apartar"} ${cantidad}`}
      </Button>
    </form>
  );
}

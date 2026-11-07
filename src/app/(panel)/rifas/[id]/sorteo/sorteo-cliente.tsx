"use client";

import { cn } from "cn";
import { useActionState, useId, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearNumero } from "@/lib/numeros";
import { enlaceWhatsApp, normalizarTelefono } from "@/lib/telefono";

import type { EstadoSorteo } from "./acciones";

type Accion = (estado: EstadoSorteo, formData: FormData) => Promise<EstadoSorteo>;

function Aviso({ estado }: { estado: EstadoSorteo }) {
  if (!estado.error && !estado.mensaje) return null;
  return (
    <p
      role={estado.error ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        estado.error ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-900",
      )}
    >
      {estado.error ?? estado.mensaje}
    </p>
  );
}

export function EditorPremios({ inicial, accion }: { inicial: string[]; accion: Accion }) {
  const id = useId();
  const [premios, setPremios] = useState(inicial.length ? inicial : [""]);
  const [estado, enviar, enviando] = useActionState(accion, {});

  return (
    <form action={enviar} className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">Premios</h2>
        <p className="text-sm text-muted-foreground">
          En orden: el primero es el 1.er lugar. Se muestran en la página pública.
        </p>
      </div>
      <ol className="space-y-2">
        {premios.map((premio, i) => (
          <li key={i} className="flex items-center gap-2">
            <Label htmlFor={`${id}-${i}`} className="w-8 shrink-0 text-muted-foreground">
              {i + 1}.º
            </Label>
            <Input
              id={`${id}-${i}`}
              name="premio"
              value={premio}
              maxLength={200}
              placeholder={i === 0 ? "Por ejemplo: Pantalla de 55 pulgadas" : "Otro premio"}
              onChange={(e) => setPremios((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Quitar el premio ${i + 1}`}
              onClick={() => setPremios((p) => (p.length === 1 ? [""] : p.filter((_, j) => j !== i)))}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ol>
      <Aviso estado={estado} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPremios((p) => [...p, ""])} disabled={premios.length >= 20}>
          Agregar premio
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar premios"}
        </Button>
      </div>
    </form>
  );
}

export function CerrarVentas({ pendientes, accion }: { pendientes: number; accion: Accion }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [confirmando, setConfirmando] = useState(false);

  return (
    <form action={enviar} className="space-y-3">
      <h2 className="font-semibold">Cerrar ventas</h2>
      <p className="text-sm text-muted-foreground">
        Antes de sortear, cierra las ventas: nadie podrá apartar ni en el panel ni en la página
        pública. Se pueden reabrir mientras no registres el resultado.
      </p>
      {pendientes > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" name="liberar" defaultChecked className="mt-0.5 size-4 accent-primary" />
          <span>
            Liberar también{" "}
            {pendientes === 1 ? "el apartado que sigue sin pagar" : `los ${pendientes} apartados que siguen sin pagar`}{" "}
            (no participan en el sorteo).
          </span>
        </label>
      )}
      <Aviso estado={estado} />
      {confirmando ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={enviando}>
            {enviando ? "Cerrando…" : "Sí, cerrar ventas"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setConfirmando(true)}>
          Cerrar ventas
        </Button>
      )}
    </form>
  );
}

export function ReabrirVentas({ accion }: { accion: () => Promise<EstadoSorteo> }) {
  const [estado, setEstado] = useState<EstadoSorteo>({});
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">
        Las ventas están cerradas. ¿Falta vender? Puedes reabrirlas antes de registrar el resultado.
      </p>
      <Aviso estado={estado} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={ocupado}
        onClick={() => iniciar(async () => setEstado(await accion()))}
      >
        Reabrir ventas
      </Button>
    </div>
  );
}

export function FormularioResultado({
  premios,
  rango,
  accion,
}: {
  premios: { id: string; lugar: number; descripcion: string }[];
  rango: { inicial: number; final: number; digitos: number };
  accion: Accion;
}) {
  const id = useId();
  // Controlados: si hay advertencias, los números escritos se conservan para confirmar.
  const [valores, setValores] = useState<Record<string, string>>({});
  const [estado, enviar, enviando] = useActionState(accion, {});
  const advertencias = estado.advertencias ?? [];

  return (
    <form action={enviar} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escribe el número ganador de cada premio (del {formatearNumero(rango.inicial, rango.digitos)} al{" "}
        {formatearNumero(rango.final, rango.digitos)}). Al registrarlo, la rifa queda como sorteada
        y ya no se puede modificar.
      </p>
      <div className="space-y-3">
        {premios.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
            <Label htmlFor={`${id}-${p.id}`}>
              {p.lugar}.º · {p.descripcion}
            </Label>
            <Input
              id={`${id}-${p.id}`}
              name={`ganador-${p.id}`}
              inputMode="numeric"
              pattern="\d*"
              required
              value={valores[p.id] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
              className="text-center font-mono"
              placeholder={formatearNumero(rango.inicial, rango.digitos)}
            />
          </div>
        ))}
      </div>
      {advertencias.length > 0 && (
        <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Revisa antes de registrar:</p>
          <ul className="list-disc space-y-1 pl-5">
            {advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p>Si así salió el sorteo, puedes registrarlo de todos modos.</p>
        </div>
      )}
      <Aviso estado={estado} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar resultado"}
        </Button>
        {advertencias.length > 0 && (
          <Button type="submit" name="confirmar" value="1" variant="outline" disabled={enviando}>
            Registrar de todos modos
          </Button>
        )}
      </div>
    </form>
  );
}

export function Resultados({
  premios,
  rifa,
  urlBase,
}: {
  premios: {
    id: string;
    lugar: number;
    descripcion: string;
    etiqueta: string | null;
    ganador: string | null;
    telefono: string | null;
    estadoPago: "pendiente" | "confirmado" | null;
    folio: string | null;
    token: string | null;
  }[];
  rifa: string;
  urlBase: string;
}) {
  return (
    <ol className="divide-y rounded-xl border">
      {premios.map((p) => {
        const telefono = p.telefono ? normalizarTelefono(p.telefono) : null;
        return (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {p.lugar}.º lugar · {p.descripcion}
              </p>
              <p className="flex items-center gap-2">
                <span className="font-mono text-2xl font-semibold">{p.etiqueta ?? "—"}</span>
                {p.ganador ? (
                  <span>{p.ganador}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin comprador</span>
                )}
              </p>
              {p.ganador && (
                <p className="text-xs text-muted-foreground">
                  {p.telefono ?? "Sin teléfono"}
                  {p.folio && ` · folio ${p.folio}`}
                  {p.estadoPago === "pendiente" && " · no había pagado"}
                </p>
              )}
            </div>
            {telefono && p.ganador && (
              <a
                href={enlaceWhatsApp(
                  telefono,
                  `¡Hola ${p.ganador}! Tu número ${p.etiqueta} ganó el ${p.lugar}.º lugar (${p.descripcion}) ` +
                    `en la ${rifa}. ¡Felicidades!` +
                    (p.token ? ` Tu pedido: ${urlBase}/p/${p.token}` : ""),
                )}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Avisar por WhatsApp
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

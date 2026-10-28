"use client";

import { startTransition, useActionState, useLayoutEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatearEntero } from "@/lib/formato";

import type { EstadoFormularioRifa } from "./acciones";

/** Eliminar con confirmación. Solo se muestra cuando la rifa nunca tuvo apartados ni ventas. */
export function EliminarRifa({
  accion,
  cantidadNumeros,
}: {
  accion: (estado: EstadoFormularioRifa) => Promise<EstadoFormularioRifa>;
  cantidadNumeros: number;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, enviar, enviando] = useActionState(
    (previo: EstadoFormularioRifa, entrada: FormData | null): Promise<EstadoFormularioRifa> =>
      entrada === null ? Promise.resolve({}) : accion(previo),
    {},
  );

  // Next.js oculta la página al navegar en vez de desmontarla: al volver, sin confirmación pendiente ni error viejo.
  useLayoutEffect(() => {
    return () => {
      setConfirmando(false);
      startTransition(() => enviar(null));
    };
  }, [enviar]);

  return (
    <section className="space-y-3 rounded-xl border border-destructive/30 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Eliminar rifa</h2>
        <p className="text-xs text-muted-foreground">
          Como todavía no tiene apartados ni ventas, se puede borrar junto con sus{" "}
          {formatearEntero(cantidadNumeros)} números. No se puede deshacer.
        </p>
      </div>
      {confirmando ? (
        <form action={enviar} className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={enviando}>
            {enviando ? "Eliminando…" : "Sí, eliminar la rifa"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <Button type="button" variant="destructive" onClick={() => setConfirmando(true)}>
          Eliminar rifa
        </Button>
      )}
      {estado.error && (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      )}
    </section>
  );
}

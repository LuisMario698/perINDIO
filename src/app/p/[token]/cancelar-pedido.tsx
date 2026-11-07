"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { cancelarPedidoAccion, type EstadoCancelacion } from "./acciones";

/** Cancelar los apartados sin pagar, con confirmación. */
export function CancelarPedido({ token }: { token: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, enviar, enviando] = useActionState(
    (): Promise<EstadoCancelacion> => cancelarPedidoAccion(token),
    {},
  );

  if (estado.mensaje) {
    return <p role="status" className="text-sm">{estado.mensaje}</p>;
  }
  return (
    <section className="space-y-2 border-t pt-4">
      {confirmando ? (
        <form action={enviar} className="space-y-2">
          <p className="text-sm">
            Tus números sin pagar quedarán libres para otras personas. Los que ya pagaste no cambian.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={enviando}>
              {enviando ? "Cancelando…" : "Sí, cancelar mi apartado"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              No
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setConfirmando(true)}>
          Ya no los quiero: cancelar mi apartado
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

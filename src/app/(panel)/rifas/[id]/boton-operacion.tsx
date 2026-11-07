"use client";

import { cn } from "cn";
import { useActionState, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { EstadoTablero } from "./acciones";
import type { AccionesTablero } from "./estados";

/** Botón que ejecuta una operación sobre asignaciones; con `confirmacion`, pide confirmarla antes. */
export function BotonOperacion({
  accion,
  ids,
  onTerminar,
  onError,
  variante = "default",
  confirmacion,
  conMotivo = false,
  children,
}: {
  accion: AccionesTablero["pagar"];
  ids: string[];
  onTerminar: (mensaje: string) => void;
  onError: (mensaje: string) => void;
  variante?: "default" | "outline" | "ghost";
  confirmacion?: string;
  conMotivo?: boolean;
  children: ReactNode;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoTablero, formData: FormData) => {
      const resultado = await accion(previo, formData);
      if (resultado.mensaje) onTerminar(resultado.mensaje);
      if (resultado.error) onError(resultado.error);
      return resultado;
    },
    {},
  );

  if (confirmacion && !confirmando) {
    return (
      <Button type="button" variant={variante} className="w-full" onClick={() => setConfirmando(true)}>
        {children}
      </Button>
    );
  }

  return (
    <form
      action={enviar}
      className={cn("space-y-2", confirmacion && "rounded-lg border p-3")}
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="asignacionId" value={id} />
      ))}
      {confirmacion && <p className="text-sm">{confirmacion}</p>}
      {conMotivo && (
        <Input name="motivo" placeholder="Motivo (opcional)" maxLength={200} aria-label="Motivo" />
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={confirmacion ? (variante === "default" ? "default" : "destructive") : variante}
          className="flex-1"
          disabled={enviando}
        >
          {enviando ? "Guardando…" : confirmacion ? "Sí, continuar" : children}
        </Button>
        {confirmacion && (
          <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
            No
          </Button>
        )}
      </div>
      {estado.error && (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      )}
    </form>
  );
}

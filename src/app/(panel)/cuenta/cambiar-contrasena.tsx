"use client";

import { cn } from "cn";
import { useActionState, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cambiarContrasenaAccion, type EstadoCuenta } from "./acciones";

const CAMPOS = [
  { nombre: "actual", etiqueta: "Contraseña actual", autocompletar: "current-password" },
  { nombre: "nueva", etiqueta: "Contraseña nueva", autocompletar: "new-password", ayuda: "Al menos 10 caracteres." },
  { nombre: "confirmacion", etiqueta: "Repite la contraseña nueva", autocompletar: "new-password" },
] as const;

export function CambiarContrasena() {
  const id = useId();
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoCuenta, formData: FormData) => {
      const resultado = await cambiarContrasenaAccion(previo, formData);
      if (resultado.mensaje) formulario.current?.reset();
      return resultado;
    },
    {},
  );
  const errores = estado.errores ?? {};

  return (
    <form ref={formulario} action={enviar} className="space-y-4">
      <h2 className="font-semibold">Cambiar contraseña</h2>
      {CAMPOS.map((c) => (
        <div key={c.nombre} className="space-y-1.5">
          <Label htmlFor={`${id}-${c.nombre}`}>{c.etiqueta}</Label>
          <Input
            id={`${id}-${c.nombre}`}
            name={c.nombre}
            type="password"
            autoComplete={c.autocompletar}
            required
            aria-invalid={Boolean(errores[c.nombre]) || undefined}
          />
          {(errores[c.nombre] || "ayuda" in c) && (
            <p className={cn("text-xs", errores[c.nombre] ? "text-destructive" : "text-muted-foreground")}>
              {errores[c.nombre] ?? ("ayuda" in c ? c.ayuda : null)}
            </p>
          )}
        </div>
      ))}
      {(estado.error || estado.mensaje) && (
        <p
          role={estado.error ? "alert" : "status"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            estado.error ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-900",
          )}
        >
          {estado.error ?? estado.mensaje}
        </p>
      )}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}

"use client";

import { cn } from "cn";
import { useActionState, useId, useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearWhatsApp, LOGO_MAXIMO_BYTES } from "@/lib/validacion/organizador";
import { normalizarTelefono } from "@/lib/telefono";

import { actualizarPerfilAccion, logoAccion, type EstadoPerfil } from "./acciones";

function Aviso({ estado }: { estado: EstadoPerfil }) {
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

export function FormularioPerfil({
  inicial,
}: {
  inicial: { nombre: string; whatsapp: string; datosPago: string };
}) {
  const id = useId();
  const [estado, enviar, enviando] = useActionState(actualizarPerfilAccion, {});
  // Controlados: si hay un error de validación, no se pierde lo escrito.
  const [valores, setValores] = useState({
    ...inicial,
    whatsapp: inicial.whatsapp ? formatearWhatsApp(inicial.whatsapp) : "",
  });
  const errores = estado.errores ?? {};
  const normalizado = valores.whatsapp ? normalizarTelefono(valores.whatsapp) : null;

  const campo = (nombre: keyof typeof valores) => ({
    id: `${id}-${nombre}`,
    name: nombre,
    value: valores[nombre],
    onChange: (e: { target: { value: string } }) =>
      setValores((v) => ({ ...v, [nombre]: e.target.value })),
    "aria-invalid": Boolean(errores[nombre]) || undefined,
    "aria-describedby": `${id}-${nombre}-ayuda`,
  });

  return (
    <form action={enviar} className="space-y-5">
      <h2 className="font-semibold">Datos públicos</h2>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-nombre`}>Nombre del organizador</Label>
        <Input {...campo("nombre")} required maxLength={80} />
        <p id={`${id}-nombre-ayuda`} className={cn("text-xs", errores.nombre ? "text-destructive" : "text-muted-foreground")}>
          {errores.nombre ?? "Por ejemplo, el nombre de tu asociación o escuela."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-whatsapp`}>WhatsApp para recibir comprobantes</Label>
        <Input {...campo("whatsapp")} type="tel" inputMode="tel" placeholder="55 1234 5678" />
        <p id={`${id}-whatsapp-ayuda`} className={cn("text-xs", errores.whatsapp ? "text-destructive" : "text-muted-foreground")}>
          {errores.whatsapp ??
            (normalizado
              ? `Los compradores te escribirán a ${formatearWhatsApp(normalizado)}.`
              : "Sin WhatsApp, la página del pedido no muestra el botón para mandar el comprobante.")}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-datosPago`}>Datos de pago</Label>
        <Textarea
          {...campo("datosPago")}
          rows={5}
          maxLength={1000}
          placeholder={"Transferencia a BBVA\nCLABE 012 180 0000 0000 0000\nA nombre de ...\nO en efectivo con ..."}
        />
        <p id={`${id}-datosPago-ayuda`} className={cn("text-xs", errores.datosPago ? "text-destructive" : "text-muted-foreground")}>
          {errores.datosPago ??
            "Se muestran en el pedido de cada comprador. Una rifa puede tener sus propias instrucciones."}
        </p>
      </div>
      <Aviso estado={estado} />
      <Button type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar perfil"}
      </Button>
    </form>
  );
}

export function FormularioLogo({ logo }: { logo: string | null }) {
  const id = useId();
  const [vista, setVista] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoPerfil, formData: FormData) => {
      const resultado = await logoAccion(previo, formData);
      // Guardado: la vista previa local deja su lugar a la imagen de la base.
      if (!resultado.error) {
        setVista(null);
        if (entrada.current) entrada.current.value = "";
      }
      return resultado;
    },
    {},
  );
  const actual = vista ?? logo;

  return (
    <form action={enviar} className="space-y-4">
      <h2 className="font-semibold">Logo</h2>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
          {actual ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local o imagen de la base
            <img src={actual} alt="Logo actual" className="size-full object-contain" />
          ) : (
            <Logo className="size-10 opacity-40" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${id}-logo`}>Imagen</Label>
          <Input
            ref={entrada}
            id={`${id}-logo`}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              setErrorLocal(
                archivo && archivo.size > LOGO_MAXIMO_BYTES
                  ? "El logo pesa más de 256 KB; usa una imagen más pequeña."
                  : null,
              );
              setVista(archivo ? URL.createObjectURL(archivo) : null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPG o WebP, hasta 256 KB. Cuadrado se ve mejor. En los PDF se usa si es PNG o JPG.
          </p>
        </div>
      </div>
      {errorLocal && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorLocal}
        </p>
      )}
      {!errorLocal && <Aviso estado={estado} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando || !vista || Boolean(errorLocal)}>
          {enviando ? "Subiendo…" : "Subir logo"}
        </Button>
        {logo && !vista && (
          <Button type="submit" name="quitar" value="1" variant="outline" disabled={enviando}>
            Quitar logo
          </Button>
        )}
        {vista && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setVista(null);
              setErrorLocal(null);
              if (entrada.current) entrada.current.value = "";
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

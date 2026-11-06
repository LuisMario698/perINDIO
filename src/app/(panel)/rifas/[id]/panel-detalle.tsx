"use client";

import { cn } from "cn";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearDinero, formatearFechaHora, tiempoRelativo } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import type { NumeroOcupado } from "@/server/consultas";

import type { EstadoTablero } from "./acciones";
import {
  categoriaDe,
  NOMBRE_CATEGORIA,
  PUNTO_CATEGORIA,
  type AccionesTablero,
  type RifaTablero,
} from "./estados";

/** Detalle de un número ocupado, con sus acciones y las de todos los números del mismo comprador. */
export function PanelDetalle({
  rifa,
  ocupado,
  delComprador,
  acciones,
  onTerminar,
  onError,
  onCerrar,
}: {
  rifa: RifaTablero;
  ocupado: NumeroOcupado;
  /** Todos los números vigentes del mismo comprador en esta rifa (incluye este). */
  delComprador: NumeroOcupado[];
  acciones: AccionesTablero;
  onTerminar: (mensaje: string) => void;
  onError: (mensaje: string) => void;
  onCerrar: () => void;
}) {
  const categoria = categoriaDe(ocupado);
  const etiqueta = formatearNumero(ocupado.numero, rifa.digitos);
  const id = ocupado.asignacionId!;
  const pendiente = ocupado.estadoPago === "pendiente";

  const pendientes = delComprador.filter((o) => o.estadoPago === "pendiente");
  const vencidos = delComprador.filter((o) => categoriaDe(o) === "vencido");
  const totalPendiente = pendientes.reduce((suma, o) => suma + Number(o.monto ?? 0), 0);
  const ids = (lista: NumeroOcupado[]) => lista.map((o) => o.asignacionId!);

  return (
    <section className="space-y-4 lg:rounded-xl lg:border lg:p-4" aria-label={`Número ${etiqueta}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-2xl font-semibold tabular-nums">{etiqueta}</p>
          <Badge variant="outline" className="gap-1.5">
            <span className={cn("size-2 rounded-full", PUNTO_CATEGORIA[categoria])} />
            {NOMBRE_CATEGORIA[categoria]}
            {pendiente ? " · pago pendiente" : " · pagado"}
          </Badge>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <Dato nombre="Comprador">{ocupado.compradorNombre}</Dato>
        {ocupado.compradorTelefono && (
          <Dato nombre="Teléfono">
            <a href={`tel:${ocupado.compradorTelefono.replace(/\s/g, "")}`} className="underline">
              {ocupado.compradorTelefono}
            </a>
          </Dato>
        )}
        <Dato nombre="Precio">{formatearDinero(ocupado.monto ?? 0)}</Dato>
        {ocupado.asignadoEn && (
          <Dato nombre={pendiente ? "Apartado" : "Registrado"}>
            {formatearFechaHora(ocupado.asignadoEn)}
          </Dato>
        )}
        {pendiente && ocupado.fechaLimite && (
          <Dato nombre={categoria === "vencido" ? "Venció" : "Vence"}>
            {formatearFechaHora(ocupado.fechaLimite)}{" "}
            <span className={categoria === "vencido" ? "text-destructive" : "text-muted-foreground"}>
              ({tiempoRelativo(ocupado.fechaLimite)})
            </span>
          </Dato>
        )}
        {ocupado.fechaPago && <Dato nombre="Pagado">{formatearFechaHora(ocupado.fechaPago)}</Dato>}
        {ocupado.observaciones && <Dato nombre="Notas">{ocupado.observaciones}</Dato>}
      </dl>
      <Link
        href={`/rifas/${rifa.id}/historial?numero=${ocupado.numero}`}
        className="inline-block text-sm text-muted-foreground underline hover:text-foreground"
      >
        Ver historial del {etiqueta}
      </Link>

      <div className="space-y-2">
        {pendiente && (
          <BotonOperacion
            accion={acciones.pagar}
            ids={[id]}
            onTerminar={onTerminar}
            onError={onError}
          >
            Confirmar pago del {etiqueta}
          </BotonOperacion>
        )}
        {ocupado.estado === "apartado" && pendiente && (
          <BotonOperacion
            accion={acciones.liberar}
            ids={[id]}
            onTerminar={onTerminar}
            onError={onError}
            variante="outline"
            confirmacion={`El ${etiqueta} vuelve a estar disponible y el apartado queda en el historial.`}
          >
            Liberar el {etiqueta}
          </BotonOperacion>
        )}
        <BotonOperacion
          accion={acciones.cancelar}
          ids={[id]}
          onTerminar={onTerminar}
          onError={onError}
          variante="ghost"
          conMotivo
          confirmacion={
            pendiente
              ? `Se cancela el apartado del ${etiqueta} y vuelve a estar disponible.`
              : `Se cancela la venta del ${etiqueta} (por ejemplo, si se devolvió el dinero) y vuelve a estar disponible.`
          }
        >
          {pendiente ? "Cancelar apartado" : "Cancelar venta"}
        </BotonOperacion>
      </div>

      {delComprador.length > 1 && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">
            {delComprador.length} números de {ocupado.compradorNombre}
          </h3>
          <ul className="flex flex-wrap gap-1">
            {delComprador.map((o) => (
              <li
                key={o.numero}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-xs"
              >
                <span className={cn("size-2 rounded-full", PUNTO_CATEGORIA[categoriaDe(o)])} />
                {formatearNumero(o.numero, rifa.digitos)}
              </li>
            ))}
          </ul>
          {pendientes.length > 1 && (
            <BotonOperacion
              accion={acciones.pagar}
              ids={ids(pendientes)}
              onTerminar={onTerminar}
              onError={onError}
            >
              Confirmar pago de sus {pendientes.length} apartados · {formatearDinero(totalPendiente)}
            </BotonOperacion>
          )}
          {vencidos.length > 1 && (
            <BotonOperacion
              accion={acciones.liberar}
              ids={ids(vencidos)}
              onTerminar={onTerminar}
              onError={onError}
              variante="outline"
              confirmacion={`Sus ${vencidos.length} apartados vencidos vuelven a estar disponibles.`}
            >
              Liberar sus {vencidos.length} vencidos
            </BotonOperacion>
          )}
        </div>
      )}
    </section>
  );
}

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{nombre}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Botón que ejecuta una operación sobre asignaciones; con `confirmacion`, pide confirmarla antes. */
function BotonOperacion({
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

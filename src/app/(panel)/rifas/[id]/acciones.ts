"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { formatearNumero } from "@/lib/numeros";
import {
  esquemaApartado,
  esquemaIdsAsignacion,
  leerFormularioApartado,
  type CampoApartado,
} from "@/lib/validacion/apartado";
import { esUuid } from "@/lib/validacion/rifa";
import {
  apartarNumeros,
  cancelarAsignaciones,
  confirmarPago,
  liberarAsignaciones,
} from "@/server/asignaciones";
import { obtenerRifa } from "@/server/consultas";
import { ErrorDeNegocio } from "@/server/errores";
import { obtenerUsuarioActual } from "@/server/sesion";

export type EstadoTablero = {
  error?: string;
  errores?: Partial<Record<CampoApartado, string>>;
  /** Mensaje de éxito; el tablero lo muestra y limpia la selección. */
  mensaje?: string;
};

export type OperacionAsignaciones = "pagar" | "liberar" | "cancelar";

// Admin y operador pueden apartar, vender, confirmar pagos, liberar y cancelar;
// todo queda en el historial con el usuario que lo hizo.

export async function apartarAccion(
  rifaId: string,
  _previo: EstadoTablero,
  formData: FormData,
): Promise<EstadoTablero> {
  const usuario = await obtenerUsuarioActual();
  const rifa = esUuid(rifaId) ? await obtenerRifa(db, rifaId, usuario.organizadorId) : null;
  if (!rifa) return { error: "La rifa no existe." };

  const resultado = esquemaApartado.safeParse(leerFormularioApartado(formData));
  if (!resultado.success) {
    const { fieldErrors } = z.flattenError(resultado.error);
    const errores: EstadoTablero["errores"] = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.[0]) errores[campo as CampoApartado] = mensajes[0];
    }
    return { error: errores.numeros ?? "Revisa los campos marcados.", errores };
  }
  const datos = resultado.data;

  try {
    await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: datos.numeros,
      comprador: datos.compradorId
        ? { id: datos.compradorId }
        : { nombre: datos.nombre, telefono: datos.telefono },
      pagoConfirmado: datos.pagoConfirmado,
      plazoHoras: datos.plazoHoras,
      observaciones: datos.observaciones,
      usuarioId: usuario.id,
    });
  } catch (error) {
    // Si alguien más tomó un número, el tablero se actualiza para mostrarlo ocupado.
    refresh();
    return errorDeNegocio(error);
  }

  refresh();
  const etiquetas = [...datos.numeros]
    .sort((a, b) => a - b)
    .map((n) => formatearNumero(n, rifa.digitos))
    .join(", ");
  const verbo = datos.pagoConfirmado ? "Vendido" : "Apartado";
  return {
    mensaje:
      datos.numeros.length === 1
        ? `${verbo} el ${etiquetas}.`
        : `${verbo}s ${datos.numeros.length} números: ${etiquetas}.`,
  };
}

export async function operarAsignacionesAccion(
  rifaId: string,
  operacion: OperacionAsignaciones,
  _previo: EstadoTablero,
  formData: FormData,
): Promise<EstadoTablero> {
  const usuario = await obtenerUsuarioActual();
  const rifa = esUuid(rifaId) ? await obtenerRifa(db, rifaId, usuario.organizadorId) : null;
  if (!rifa) return { error: "La rifa no existe." };

  const ids = esquemaIdsAsignacion.safeParse(formData.getAll("asignacionId"));
  if (!ids.success) return { error: "Selecciona al menos un apartado." };
  const motivo = formData.get("motivo");

  // rifaId: solo se tocan asignaciones de esta rifa, que ya se comprobó que es del organizador.
  const datos = { asignacionIds: ids.data, usuarioId: usuario.id, rifaId: rifa.id };
  const cantidad = ids.data.length;
  const numeros = cantidad === 1 ? "1 número" : `${cantidad} números`;
  try {
    if (operacion === "pagar") await confirmarPago(db, datos);
    if (operacion === "liberar") await liberarAsignaciones(db, datos);
    if (operacion === "cancelar") {
      await cancelarAsignaciones(db, { ...datos, motivo: typeof motivo === "string" ? motivo : null });
    }
  } catch (error) {
    refresh();
    return errorDeNegocio(error);
  }

  refresh();
  const disponibles = cantidad === 1 ? "vuelve a estar disponible" : "vuelven a estar disponibles";
  const mensajes: Record<OperacionAsignaciones, string> = {
    pagar: `Pago confirmado: ${numeros}.`,
    liberar: `Liberado: ${numeros}; ${disponibles}.`,
    cancelar: `Cancelado: ${numeros}; ${disponibles}.`,
  };
  return { mensaje: mensajes[operacion] };
}

// Los errores de negocio se muestran en el tablero; cualquier otro llega a la página de error.
function errorDeNegocio(error: unknown): EstadoTablero {
  if (error instanceof ErrorDeNegocio) return { error: error.message };
  throw error;
}

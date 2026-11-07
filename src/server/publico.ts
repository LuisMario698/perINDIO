import { and, asc, count, eq, gt, ne, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import {
  asignaciones,
  compradores,
  intentosPublicos,
  numerosEstado,
  organizadores,
  pedidos,
  premios,
  rifas,
} from "@/db/schema";
import { normalizarTelefono } from "@/lib/telefono";

import { apartarNumeros, liberarApartadosVencidos } from "./asignaciones";
import { ErrorDeNegocio } from "./errores";
import { estadoPedido } from "./pedidos";

/** Pedidos que se pueden hacer por hora desde una misma conexión (IP). */
export const PEDIDOS_POR_HORA_POR_IP = 5;

/**
 * Lo que se muestra en la página pública de una rifa: nunca datos de compradores, solo qué
 * números están ocupados. null si la rifa no existe o no está publicada.
 */
export async function obtenerRifaPublica(db: Db, slug: string) {
  // Lo vencido de las rifas con liberación automática se libera antes de mostrar los números.
  await liberarApartadosVencidos(db);
  const [fila] = await db
    .select({
      rifa: {
        id: rifas.id,
        slug: rifas.slug,
        nombre: rifas.nombre,
        descripcion: rifas.descripcion,
        numeroInicial: rifas.numeroInicial,
        cantidadNumeros: rifas.cantidadNumeros,
        digitos: rifas.digitos,
        precioNumero: rifas.precioNumero,
        fechaSorteo: rifas.fechaSorteo,
        estado: rifas.estado,
        plazoPublicoHoras: rifas.plazoPublicoHoras,
        maxNumerosPublico: rifas.maxNumerosPublico,
      },
      organizador: {
        id: organizadores.id,
        nombre: organizadores.nombre,
        whatsapp: organizadores.whatsapp,
        logoVersion: sql<string | null>`left(md5(${organizadores.logo}), 8)`,
      },
    })
    .from(rifas)
    .innerJoin(organizadores, eq(organizadores.id, rifas.organizadorId))
    .where(and(eq(rifas.slug, slug), eq(rifas.publica, true)));
  if (!fila) return null;

  const [ocupados, listaPremios] = await Promise.all([
    db
      .select({ numero: numerosEstado.numero })
      .from(numerosEstado)
      .where(and(eq(numerosEstado.rifaId, fila.rifa.id), ne(numerosEstado.estado, "disponible"))),
    db
      .select({
        lugar: premios.lugar,
        descripcion: premios.descripcion,
        numeroGanador: premios.numeroGanador,
        ganador: compradores.nombre,
      })
      .from(premios)
      .leftJoin(asignaciones, eq(asignaciones.id, premios.asignacionGanadoraId))
      .leftJoin(compradores, eq(compradores.id, asignaciones.compradorId))
      .where(eq(premios.rifaId, fila.rifa.id))
      .orderBy(asc(premios.lugar)),
  ]);

  return {
    ...fila,
    ocupados: ocupados.map((o) => o.numero),
    // Del ganador solo se publica el nombre y la inicial del apellido.
    premios: listaPremios.map(({ ganador, ...premio }) => ({
      ...premio,
      ganador: ganador ? abreviarNombre(ganador) : null,
    })),
  };
}

export type RifaPublica = NonNullable<Awaited<ReturnType<typeof obtenerRifaPublica>>>;

/**
 * Apartado hecho por un comprador desde la página pública. Aplica las reglas contra apartados
 * falsos y devuelve el enlace secreto (token) de su pedido.
 */
export async function apartarPublico(
  db: Db,
  datos: { slug: string; numeros: number[]; nombre: string; telefono: string; ip: string },
): Promise<string> {
  const [rifa] = await db
    .select()
    .from(rifas)
    .where(and(eq(rifas.slug, datos.slug), eq(rifas.publica, true)));
  if (!rifa) throw new ErrorDeNegocio("La rifa no existe.");
  if (rifa.estado !== "activa") throw new ErrorDeNegocio("Las ventas de esta rifa ya cerraron.");

  const numeros = [...new Set(datos.numeros)];
  if (numeros.length > rifa.maxNumerosPublico) {
    throw new ErrorDeNegocio(`Puedes apartar hasta ${rifa.maxNumerosPublico} números por pedido.`);
  }
  const telefono = normalizarTelefono(datos.telefono);
  if (!telefono) throw new ErrorDeNegocio("Escribe un número de WhatsApp válido (10 dígitos).");
  // Un número vencido (liberación automática) se puede volver a apartar de inmediato.
  await liberarApartadosVencidos(db);

  // Límite por conexión: evita que alguien bloquee la rifa con muchos pedidos falsos.
  const claveIp = `ip:${datos.ip}`;
  const [{ recientes }] = await db
    .select({ recientes: count() })
    .from(intentosPublicos)
    .where(
      and(
        eq(intentosPublicos.clave, claveIp),
        gt(intentosPublicos.creadoEn, sql`now() - interval '1 hour'`),
      ),
    );
  if (recientes >= PEDIDOS_POR_HORA_POR_IP) {
    throw new ErrorDeNegocio(
      "Se hicieron muchos apartados desde esta conexión. Espera un rato o escríbele al organizador.",
    );
  }

  // Límite por teléfono: sus apartados sin pagar en esta rifa no pasan del máximo por pedido.
  const [{ pendientes }] = await db
    .select({ pendientes: count() })
    .from(asignaciones)
    .innerJoin(compradores, eq(compradores.id, asignaciones.compradorId))
    .where(
      and(
        eq(asignaciones.rifaId, rifa.id),
        eq(asignaciones.estado, "apartado"),
        eq(compradores.telefonoNormalizado, telefono),
      ),
    );
  if (pendientes + numeros.length > rifa.maxNumerosPublico) {
    throw new ErrorDeNegocio(
      `Ya tienes ${pendientes} ${pendientes === 1 ? "número apartado" : "números apartados"} sin pagar en esta rifa. ` +
        `Págalos o cancela alguno antes de apartar más (máximo ${rifa.maxNumerosPublico}).`,
    );
  }

  const creadas = await apartarNumeros(db, {
    rifaId: rifa.id,
    numeros,
    comprador: { nombre: datos.nombre, telefono: datos.telefono },
    origen: "publico",
    plazoHoras: rifa.plazoPublicoHoras,
    reutilizarCompradorPorTelefono: true,
  });

  await db.insert(intentosPublicos).values([{ clave: claveIp }, { clave: `tel:${telefono}` }]);
  const [pedido] = await db
    .select({ token: pedidos.token })
    .from(pedidos)
    .where(eq(pedidos.id, creadas[0].pedidoId));
  return pedido.token;
}

/** Todo lo que ve el comprador en el enlace de su pedido. null si el enlace no existe. */
export async function obtenerPedidoPublico(db: Db, token: string) {
  const [fila] = await db
    .select({
      pedido: { id: pedidos.id, folio: pedidos.folio, creadoEn: pedidos.creadoEn },
      rifa: {
        nombre: rifas.nombre,
        slug: rifas.slug,
        digitos: rifas.digitos,
        estado: rifas.estado,
        publica: rifas.publica,
        fechaSorteo: rifas.fechaSorteo,
        instruccionesPago: rifas.instruccionesPago,
      },
      organizador: {
        id: organizadores.id,
        nombre: organizadores.nombre,
        whatsapp: organizadores.whatsapp,
        datosPago: organizadores.datosPago,
        logoVersion: sql<string | null>`left(md5(${organizadores.logo}), 8)`,
      },
      comprador: { nombre: compradores.nombre, telefono: compradores.telefono },
    })
    .from(pedidos)
    .innerJoin(rifas, eq(rifas.id, pedidos.rifaId))
    .innerJoin(organizadores, eq(organizadores.id, rifas.organizadorId))
    .innerJoin(compradores, eq(compradores.id, pedidos.compradorId))
    .where(eq(pedidos.token, token));
  if (!fila) return null;

  const numeros = await db
    .select({
      numero: sql<number>`(select n.numero from numeros n where n.id = ${asignaciones.numeroId})`,
      estado: asignaciones.estado,
      estadoPago: asignaciones.estadoPago,
      monto: asignaciones.monto,
      fechaLimite: asignaciones.fechaLimite,
      fechaPago: asignaciones.fechaPago,
    })
    .from(asignaciones)
    .where(eq(asignaciones.pedidoId, fila.pedido.id))
    .orderBy(asc(asignaciones.creadoEn));
  numeros.sort((a, b) => a.numero - b.numero);

  const vigentes = numeros.filter((n) => n.estado === "apartado" || n.estado === "vendido");
  const pendientes = vigentes.filter((n) => n.estadoPago === "pendiente");
  const suma = (lista: typeof numeros) => lista.reduce((t, n) => t + Number(n.monto), 0);
  const limites = pendientes
    .map((n) => n.fechaLimite)
    .filter((f): f is Date => f !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    ...fila,
    numeros,
    estado: estadoPedido(numeros),
    total: suma(vigentes),
    porPagar: suma(pendientes),
    // El primer vencimiento manda: a esa hora se empiezan a liberar sus números.
    venceEn: limites[0] ?? null,
    instruccionesPago: fila.rifa.instruccionesPago ?? fila.organizador.datosPago,
  };
}

export type PedidoPublico = NonNullable<Awaited<ReturnType<typeof obtenerPedidoPublico>>>;

/** "María Guadalupe Hernández" → "María G." */
export function abreviarNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
}

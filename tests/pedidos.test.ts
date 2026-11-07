import { asc, count, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, compradores, movimientos, pedidos, rifas } from "@/db/schema";
import { normalizarTelefono } from "@/lib/telefono";
import {
  apartarNumeros,
  cancelarAsignaciones,
  cancelarPedidoPorComprador,
  confirmarPago,
  liberarApartadosVencidos,
} from "@/server/asignaciones";
import { AsignacionesNoVigentesError, ErrorDeNegocio } from "@/server/errores";
import { estadoPedido } from "@/server/pedidos";
import { actualizarRifa, crearRifa } from "@/server/rifas";

import {
  codigoDeError,
  conectarBaseDePruebas,
  crearRifaDePrueba,
  crearUsuarioDePrueba,
  vaciarTablas,
  vencer,
} from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function pedidoDe(pedidoId: string) {
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  return pedido;
}

describe("pedidos", () => {
  it("cada apartado crea un pedido con folio y enlace secreto", async () => {
    const rifa = await crearRifaDePrueba(db);
    const vendedor = await crearUsuarioDePrueba(db, rifa.organizadorId);

    const interno = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1, 2, 3],
      comprador: { nombre: "Ana" },
      usuarioId: vendedor.id,
    });
    const publico = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [4],
      comprador: { nombre: "Beto", telefono: "55 1234 5678" },
      origen: "publico",
    });

    expect(new Set(interno.map((a) => a.pedidoId)).size).toBe(1);
    const pedidoInterno = await pedidoDe(interno[0].pedidoId);
    const pedidoPublico = await pedidoDe(publico[0].pedidoId);
    expect(pedidoInterno).toMatchObject({ origen: "interno", vendedorId: vendedor.id });
    expect(pedidoPublico).toMatchObject({ origen: "publico", vendedorId: null });
    expect(pedidoInterno.folio).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(pedidoInterno.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pedidoInterno.folio).not.toBe(pedidoPublico.folio);

    const [mov] = await db
      .select()
      .from(movimientos)
      .where(eq(movimientos.asignacionId, interno[0].id));
    expect(mov.detalle).toMatchObject({ folio: pedidoInterno.folio, origen: "interno" });
  });

  it("reconoce al mismo comprador por su teléfono cuando se pide", async () => {
    const rifa = await crearRifaDePrueba(db);
    const apartar = (numero: number, telefono: string, reutilizar: boolean) =>
      apartarNumeros(db, {
        rifaId: rifa.id,
        numeros: [numero],
        comprador: { nombre: "Ana", telefono },
        origen: "publico",
        reutilizarCompradorPorTelefono: reutilizar,
      }).then(([a]) => a.compradorId);

    const primero = await apartar(1, "55 1234 5678", true);
    const mismo = await apartar(2, "+52 (55) 1234-5678", true);
    const otro = await apartar(3, "55 1234 5678", false);

    expect(mismo).toBe(primero);
    expect(otro).not.toBe(primero);
    const [guardado] = await db.select().from(compradores).where(eq(compradores.id, primero));
    expect(guardado.telefonoNormalizado).toBe("525512345678");
  });

  it("calcula el estado del pedido a partir de sus números", () => {
    const ayer = new Date(Date.now() - 86_400_000);
    const manana = new Date(Date.now() + 86_400_000);
    const a = (estado: string, estadoPago: string, fechaLimite: Date | null = manana) => ({
      estado,
      estadoPago,
      fechaLimite,
    });

    expect(estadoPedido([a("apartado", "pendiente")])).toBe("pendiente");
    expect(estadoPedido([a("apartado", "pendiente", ayer)])).toBe("vencido");
    expect(estadoPedido([a("vendido", "confirmado"), a("apartado", "pendiente")])).toBe("parcial");
    expect(estadoPedido([a("vendido", "confirmado"), a("liberado", "pendiente")])).toBe("pagado");
    expect(estadoPedido([a("liberado", "pendiente"), a("cancelado", "pendiente")])).toBe("cancelado");
  });
});

describe("cancelación por el comprador", () => {
  it("cancela solo sus apartados sin pagar y queda en el historial", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [pagado, pendiente] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1, 2],
      comprador: { nombre: "Ana" },
      origen: "publico",
    });
    await confirmarPago(db, { asignacionIds: [pagado.id] });
    const { token } = await pedidoDe(pagado.pedidoId);

    expect(await cancelarPedidoPorComprador(db, token)).toBe(1);

    const estados = await db
      .select({ id: asignaciones.id, estado: asignaciones.estado })
      .from(asignaciones)
      .orderBy(asc(asignaciones.creadoEn));
    expect(Object.fromEntries(estados.map((e) => [e.id, e.estado]))).toEqual({
      [pagado.id]: "vendido",
      [pendiente.id]: "cancelado",
    });
    const [mov] = await db
      .select()
      .from(movimientos)
      .where(eq(movimientos.tipo, "cancelacion_comprador"));
    expect(mov).toMatchObject({ asignacionId: pendiente.id, usuarioId: null });

    await expect(cancelarPedidoPorComprador(db, token)).rejects.toThrow(ErrorDeNegocio);
    await expect(cancelarPedidoPorComprador(db, "no-existe")).rejects.toThrow("El pedido no existe.");
  });
});

describe("rifa sorteada", () => {
  async function sortear(rifaId: string) {
    await db
      .update(rifas)
      .set({ estado: "sorteada", sorteadaEn: sql`now()` })
      .where(eq(rifas.id, rifaId));
  }

  it("queda de solo lectura, también para escrituras directas en la base", async () => {
    const rifa = await crearRifaDePrueba(db, { liberacionAutomatica: true });
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1],
      comprador: { nombre: "Ana" },
    });
    await vencer(db, apartado.id);
    await sortear(rifa.id);

    await expect(
      apartarNumeros(db, { rifaId: rifa.id, numeros: [2], comprador: { nombre: "Beto" } }),
    ).rejects.toThrow("La rifa ya fue sorteada.");
    await expect(confirmarPago(db, { asignacionIds: [apartado.id] })).rejects.toThrow(
      "ya fue sorteada",
    );
    // La liberación automática no la toca.
    expect(await liberarApartadosVencidos(db)).toBe(0);
    // El trigger lo impide aunque se escriba directo.
    const directo = db
      .update(asignaciones)
      .set({ estado: "cancelado", finalizadaEn: sql`now()` })
      .where(eq(asignaciones.id, apartado.id));
    expect(await codigoDeError(directo)).toBe("23514");
  });

  it("una rifa sorteada no se puede volver a configurar", async () => {
    const rifa = await crearRifaDePrueba(db);
    await sortear(rifa.id);
    await expect(
      actualizarRifa(db, rifa.id, rifa.organizadorId, {
        nombre: "Otra",
        descripcion: null,
        numeroInicial: 0,
        cantidadNumeros: 100,
        digitos: 2,
        precioNumero: "50.00",
        plazoApartadoHoras: 48,
        liberacionAutomatica: false,
        fechaSorteo: null,
        estado: "activa",
      }),
    ).rejects.toThrow("ya fue sorteada");
  });
});

describe("permisos al cancelar", () => {
  it("con soloPendientes no cancela números ya pagados", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [venta] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1],
      comprador: { nombre: "Ana" },
      pagoConfirmado: true,
    });

    await expect(
      cancelarAsignaciones(db, { asignacionIds: [venta.id], soloPendientes: true }),
    ).rejects.toThrow(AsignacionesNoVigentesError);
    await cancelarAsignaciones(db, { asignacionIds: [venta.id] });
  });
});

describe("enlace público de la rifa", () => {
  it("genera slugs únicos a partir del nombre y valida los que se escriben", async () => {
    const primera = await crearRifaDePrueba(db, { nombre: "Rifa de Navidad Ñoña" });
    const segunda = await crearRifa(db, {
      organizadorId: primera.organizadorId,
      nombre: "Rifa de Navidad Ñoña",
      cantidadNumeros: 10,
      precioNumero: "10",
    });

    expect(primera.slug).toBe("rifa-de-navidad-nona");
    expect(segunda.slug).toMatch(/^rifa-de-navidad-nona-[a-f0-9]{4}$/);
    await expect(
      crearRifa(db, {
        organizadorId: primera.organizadorId,
        nombre: "X",
        slug: "Con Espacios",
        cantidadNumeros: 10,
        precioNumero: "10",
      }),
    ).rejects.toThrow("solo puede tener minúsculas");
    const [{ total }] = await db.select({ total: count() }).from(rifas);
    expect(total).toBe(2);
  });
});

describe("normalizarTelefono", () => {
  it.each([
    ["55 1234 5678", "525512345678"],
    ["+52 1 55 1234 5678", "525512345678"],
    ["0052 55 1234 5678", "525512345678"],
    ["+1 (415) 555-0100", "14155550100"],
    ["1234", null],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });
});

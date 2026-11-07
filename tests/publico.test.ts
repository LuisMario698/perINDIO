import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { organizadores, pedidos, rifas } from "@/db/schema";
import { apartarNumeros, confirmarPago } from "@/server/asignaciones";
import { ErrorDeNegocio, NumerosNoDisponiblesError } from "@/server/errores";
import {
  abreviarNombre,
  apartarPublico,
  obtenerPedidoPublico,
  obtenerRifaPublica,
  PEDIDOS_POR_HORA_POR_IP,
} from "@/server/publico";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas, vencer } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function rifaPublica(datos: Parameters<typeof crearRifaDePrueba>[1] = {}) {
  return crearRifaDePrueba(db, {
    publica: true,
    slug: "rifa-publica",
    plazoPublicoHoras: 12,
    maxNumerosPublico: 5,
    ...datos,
  });
}

const apartar = (numeros: number[], extra: Partial<Parameters<typeof apartarPublico>[1]> = {}) =>
  apartarPublico(db, {
    slug: "rifa-publica",
    numeros,
    nombre: "Ana López",
    telefono: "55 1234 5678",
    ip: "1.1.1.1",
    ...extra,
  });

describe("apartado desde la página pública", () => {
  it("aparta con el plazo público y devuelve el enlace del pedido", async () => {
    await rifaPublica();

    const token = await apartar([3, 1]);
    const pedido = await obtenerPedidoPublico(db, token);

    expect(pedido).toMatchObject({
      estado: "pendiente",
      total: 100,
      porPagar: 100,
      comprador: { nombre: "Ana López", telefono: "55 1234 5678" },
    });
    expect(pedido!.numeros.map((n) => n.numero)).toEqual([1, 3]);
    const horas = (pedido!.venceEn!.getTime() - pedido!.pedido.creadoEn.getTime()) / 3_600_000;
    expect(Math.round(horas)).toBe(12);
    const [guardado] = await db.select().from(pedidos).where(eq(pedidos.token, token));
    expect(guardado).toMatchObject({ origen: "publico", vendedorId: null });
  });

  it("solo funciona en rifas publicadas y activas", async () => {
    const rifa = await rifaPublica();

    await db.update(rifas).set({ publica: false }).where(eq(rifas.id, rifa.id));
    await expect(apartar([1])).rejects.toThrow("La rifa no existe.");
    expect(await obtenerRifaPublica(db, "rifa-publica")).toBeNull();

    await db.update(rifas).set({ publica: true, estado: "cerrada" }).where(eq(rifas.id, rifa.id));
    await expect(apartar([1])).rejects.toThrow("ya cerraron");
  });

  it("aplica el máximo por pedido y por teléfono, y valida el WhatsApp", async () => {
    await rifaPublica();

    await expect(apartar([1, 2, 3, 4, 5, 6])).rejects.toThrow("hasta 5 números");
    await expect(apartar([1], { telefono: "123" })).rejects.toThrow("WhatsApp válido");

    await apartar([1, 2, 3]);
    // El mismo teléfono escrito distinto cuenta como la misma persona.
    await expect(apartar([4, 5, 6].slice(0, 3), { telefono: "+52 55 1234 5678", ip: "2.2.2.2" }))
      .rejects.toThrow("Ya tienes 3 números apartados sin pagar");
    await apartar([4, 5], { ip: "2.2.2.2" });
  });

  it("limita los pedidos por conexión", async () => {
    await rifaPublica({ maxNumerosPublico: 100 });

    for (let i = 0; i < PEDIDOS_POR_HORA_POR_IP; i++) {
      await apartar([i], { telefono: `55 0000 000${i}` });
    }
    await expect(apartar([50], { telefono: "55 0000 0099" })).rejects.toThrow(
      "muchos apartados desde esta conexión",
    );
    await apartar([50], { telefono: "55 0000 0099", ip: "9.9.9.9" });
  });

  it("si un número ya se apartó por dentro, no aparta ninguno", async () => {
    const rifa = await rifaPublica();
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [2], comprador: { nombre: "Beto" } });

    await expect(apartar([1, 2])).rejects.toThrow(NumerosNoDisponiblesError);
    const datos = await obtenerRifaPublica(db, "rifa-publica");
    expect(datos!.ocupados).toEqual([2]);
  });
});

describe("lo que se ve en público", () => {
  it("la rifa no expone compradores y el ganador sale abreviado", async () => {
    const rifa = await rifaPublica();
    await db.update(organizadores).set({ whatsapp: "525500000000" });
    await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [7],
      comprador: { nombre: "Ana López Pérez", telefono: "55 1111 2222" },
    });

    const datos = await obtenerRifaPublica(db, "rifa-publica");

    expect(datos!.ocupados).toEqual([7]);
    expect(JSON.stringify(datos)).not.toContain("Ana");
    expect(JSON.stringify(datos)).not.toContain("1111");
    expect(datos!.organizador.whatsapp).toBe("525500000000");
    expect(abreviarNombre("María Guadalupe Hernández")).toBe("María G.");
    expect(abreviarNombre("Cher")).toBe("Cher");
  });

  it("el pedido refleja pagos y vencimientos", async () => {
    await rifaPublica();
    const token = await apartar([1, 2]);
    const pedido = await obtenerPedidoPublico(db, token);
    const ids = await db.query.asignaciones.findMany({
      where: (a, { eq: igual }) => igual(a.pedidoId, pedido!.pedido.id),
    });

    await confirmarPago(db, { asignacionIds: [ids[0].id] });
    expect(await obtenerPedidoPublico(db, token)).toMatchObject({ estado: "parcial", porPagar: 50 });

    await vencer(db, ids[1].id);
    expect((await obtenerPedidoPublico(db, token))!.estado).toBe("parcial");

    await confirmarPago(db, { asignacionIds: [ids[1].id] });
    expect(await obtenerPedidoPublico(db, token)).toMatchObject({ estado: "pagado", porPagar: 0 });
    expect(await obtenerPedidoPublico(db, "otro-token")).toBeNull();
  });

  it("rechaza apartar en una rifa sin publicar aunque exista", async () => {
    await crearRifaDePrueba(db, { slug: "privada" });
    await expect(
      apartarPublico(db, { slug: "privada", numeros: [1], nombre: "Ana", telefono: "5512345678", ip: "x" }),
    ).rejects.toThrow(ErrorDeNegocio);
  });
});

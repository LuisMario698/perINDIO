import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { apartarNumeros, cancelarAsignaciones, confirmarPago } from "@/server/asignaciones";
import { reporteVendedores } from "@/server/reportes";

import { conectarBaseDePruebas, crearRifaDePrueba, crearUsuarioDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

describe("ventas por vendedor", () => {
  it("agrupa por quien levantó el pedido y suma cobros por quien los registró", async () => {
    const rifa = await crearRifaDePrueba(db); // $50 por número
    const otra = await crearRifaDePrueba(db, { organizadorId: rifa.organizadorId, nombre: "Otra" });
    const admin = await crearUsuarioDePrueba(db, rifa.organizadorId, "admin");
    const ana = await crearUsuarioDePrueba(db, rifa.organizadorId, "operador");

    // Ana: vende 2 pagados, aparta 1 sin pagar y uno que se cancela.
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [1, 2], comprador: { nombre: "C1" }, usuarioId: ana.id, pagoConfirmado: true });
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [3], comprador: { nombre: "C2" }, usuarioId: ana.id });
    const [caido] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [4], comprador: { nombre: "C3" }, usuarioId: ana.id });
    await cancelarAsignaciones(db, { asignacionIds: [caido.id], usuarioId: admin.id });

    // Página pública: 2 números; el admin confirma uno.
    const publicos = await apartarNumeros(db, { rifaId: rifa.id, numeros: [5, 6], comprador: { nombre: "C4" } });
    await confirmarPago(db, { asignacionIds: [publicos[0].id], usuarioId: admin.id });

    // En otra rifa, el admin vende uno.
    await apartarNumeros(db, { rifaId: otra.id, numeros: [9], comprador: { nombre: "C5" }, usuarioId: admin.id, pagoConfirmado: true });

    const deLaRifa = await reporteVendedores(db, rifa.organizadorId, rifa.id);
    expect(deLaRifa.vendedores).toEqual([
      expect.objectContaining({
        vendedorId: ana.id,
        pedidos: 3,
        numerosVigentes: 3,
        numerosPagados: 2,
        numerosCaidos: 1,
        cobrado: 100,
        porCobrar: 50,
      }),
      expect.objectContaining({
        vendedorId: null,
        vendedor: "Página pública",
        pedidos: 1,
        numerosVigentes: 2,
        numerosPagados: 1,
        cobrado: 50,
        porCobrar: 50,
      }),
    ]);
    expect(deLaRifa.cobros).toEqual([
      expect.objectContaining({ usuarioId: ana.id, pagos: 2, monto: 100 }),
      expect.objectContaining({ usuarioId: admin.id, pagos: 1, monto: 50 }),
    ]);

    // Sin rifa: todas las del organizador.
    const general = await reporteVendedores(db, rifa.organizadorId);
    expect(general.vendedores.find((v) => v.vendedorId === admin.id)).toMatchObject({ cobrado: 50 });
    expect(general.cobros.find((c) => c.usuarioId === admin.id)).toMatchObject({ pagos: 2, monto: 100 });

    // Otro organizador no ve nada de esto.
    const ajena = await crearRifaDePrueba(db);
    expect(await reporteVendedores(db, ajena.organizadorId)).toEqual({ vendedores: [], cobros: [] });
  });
});

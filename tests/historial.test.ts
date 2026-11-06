import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { describirMovimiento } from "@/lib/movimientos";
import {
  apartarNumeros,
  cancelarAsignaciones,
  confirmarPago,
  liberarApartadosVencidos,
} from "@/server/asignaciones";
import { listarMovimientos } from "@/server/consultas";

import {
  conectarBaseDePruebas,
  crearRifaDePrueba,
  crearUsuarioDePrueba,
  vaciarTablas,
  vencer,
} from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

describe("listarMovimientos", () => {
  it("muestra cada operación con su número, comprador y quién la hizo", async () => {
    const rifa = await crearRifaDePrueba(db, { liberacionAutomatica: true });
    const operador = await crearUsuarioDePrueba(db, rifa.organizadorId);
    const [a] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [7],
      comprador: { nombre: "Ana" },
      usuarioId: operador.id,
    });
    await confirmarPago(db, { asignacionIds: [a.id], usuarioId: operador.id });
    const [b] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [8], comprador: { nombre: "Beto" } });
    await vencer(db, b.id);
    await liberarApartadosVencidos(db);
    await cancelarAsignaciones(db, { asignacionIds: [a.id], usuarioId: operador.id, motivo: "Devolución" });

    const { movimientos, siguiente } = await listarMovimientos(db, rifa.id);

    expect(siguiente).toBeNull();
    expect(movimientos.map((m) => [m.tipo, m.numero, m.comprador, m.usuario])).toEqual([
      ["cancelacion", 7, "Ana", "Usuario operador"],
      ["liberacion_automatica", 8, "Beto", null],
      ["apartado", 8, "Beto", null],
      ["pago_confirmado", 7, "Ana", "Usuario operador"],
      ["apartado", 7, "Ana", "Usuario operador"],
    ]);
    expect(describirMovimiento("cancelacion", movimientos[0].detalle)).toBe(
      "Motivo: Devolución · ya estaba pagado",
    );
    expect(describirMovimiento("liberacion_automatica", movimientos[1].detalle)).toMatch(/^venció /);
  });

  it("filtra por tipo y número y pagina del más reciente al más antiguo", async () => {
    const rifa = await crearRifaDePrueba(db);
    for (let n = 0; n < 5; n++) {
      await apartarNumeros(db, { rifaId: rifa.id, numeros: [n], comprador: { nombre: `C${n}` } });
    }
    // Fechas iguales: el orden se desempata por id, también al paginar.
    await db.execute(sql`update movimientos set creado_en = '2026-11-01T12:00:00Z'`);

    const primera = await listarMovimientos(db, rifa.id, { limite: 2 });
    const segunda = await listarMovimientos(db, rifa.id, { limite: 2, antesDe: primera.siguiente! });
    const tercera = await listarMovimientos(db, rifa.id, { limite: 2, antesDe: segunda.siguiente! });

    expect([...primera.movimientos, ...segunda.movimientos, ...tercera.movimientos].map((m) => m.numero)).toEqual([
      4, 3, 2, 1, 0,
    ]);
    expect(tercera.siguiente).toBeNull();

    expect((await listarMovimientos(db, rifa.id, { numero: 3 })).movimientos).toHaveLength(1);
    expect((await listarMovimientos(db, rifa.id, { tipo: "venta" })).movimientos).toHaveLength(0);
  });
});

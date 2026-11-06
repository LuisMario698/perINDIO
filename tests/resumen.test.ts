import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { organizadores, rifas } from "@/db/schema";
import { apartarNumeros, cancelarAsignaciones, confirmarPago } from "@/server/asignaciones";
import { listarRifasConResumen } from "@/server/consultas";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas, vencer } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

describe("listarRifasConResumen", () => {
  it("suma lo cobrado y lo pendiente con el precio de cada apartado", async () => {
    const rifa = await crearRifaDePrueba(db); // 100 números a $50
    const apartar = (numeros: number[], pagoConfirmado = false) =>
      apartarNumeros(db, { rifaId: rifa.id, numeros, comprador: { nombre: "Ana" }, pagoConfirmado });

    await apartar([1, 2], true); // vendidos: $100
    const [pagado] = await apartar([3]);
    await confirmarPago(db, { asignacionIds: [pagado.id] }); // +$50 cobrado
    // El precio cambia: los apartados nuevos cuestan $80, los anteriores conservan $50.
    await db.update(rifas).set({ precioNumero: "80.00" }).where(eq(rifas.id, rifa.id));
    await apartar([4, 5]); // por cobrar: $160
    const [vencido] = await apartar([6]);
    await vencer(db, vencido.id); // por cobrar vencido: $80
    const [cancelado] = await apartar([7], true);
    await cancelarAsignaciones(db, { asignacionIds: [cancelado.id] }); // no cuenta

    const [resumen] = await listarRifasConResumen(db, rifa.organizadorId);

    expect(resumen).toMatchObject({
      vendidos: 3,
      apartados: 2,
      vencidos: 1,
      disponibles: 94,
      cobrado: "150.00",
      porCobrar: "240.00",
      porCobrarVencido: "80.00",
    });
  });

  it("solo incluye las rifas del organizador y una rifa vacía suma cero", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [otro] = await db.insert(organizadores).values({ nombre: "Otro" }).returning();

    expect(await listarRifasConResumen(db, otro.id)).toEqual([]);
    const [resumen] = await listarRifasConResumen(db, rifa.organizadorId);
    expect(resumen).toMatchObject({ cobrado: "0.00", porCobrar: "0.00", disponibles: 100 });
  });
});

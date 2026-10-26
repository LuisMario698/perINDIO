import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, movimientos, numerosEstado } from "@/db/schema";
import { apartarNumeros, liberarApartadosVencidos } from "@/server/asignaciones";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas, vencer } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function estadoDeAsignacion(id: string) {
  const [fila] = await db.select().from(asignaciones).where(eq(asignaciones.id, id));
  return fila.estado;
}

describe("liberar_apartados_vencidos()", () => {
  it("libera solo los apartados vencidos y sin pagar de rifas con liberación automática", async () => {
    const automatica = await crearRifaDePrueba(db, { liberacionAutomatica: true });
    const manual = await crearRifaDePrueba(db, { liberacionAutomatica: false });
    const apartar = (rifaId: string, numero: number, pagoConfirmado = false) =>
      apartarNumeros(db, {
        rifaId,
        numeros: [numero],
        comprador: { nombre: `Comprador ${numero}` },
        pagoConfirmado,
      }).then(([a]) => a);

    const vencido = await apartar(automatica.id, 1);
    const vigente = await apartar(automatica.id, 2);
    const pagado = await apartar(automatica.id, 3, true);
    const vencidoEnRifaManual = await apartar(manual.id, 1);
    await vencer(db, vencido.id);
    await vencer(db, vencidoEnRifaManual.id);

    expect(await liberarApartadosVencidos(db)).toBe(1);

    expect(await estadoDeAsignacion(vencido.id)).toBe("liberado");
    expect(await estadoDeAsignacion(vigente.id)).toBe("apartado");
    expect(await estadoDeAsignacion(pagado.id)).toBe("vendido");
    expect(await estadoDeAsignacion(vencidoEnRifaManual.id)).toBe("apartado");

    const [numero1] = await db
      .select()
      .from(numerosEstado)
      .where(and(eq(numerosEstado.rifaId, automatica.id), eq(numerosEstado.numero, 1)));
    expect(numero1.estado).toBe("disponible");

    // En la rifa manual el apartado sigue ahí, marcado como vencido para que el organizador decida.
    const [numeroManual] = await db
      .select()
      .from(numerosEstado)
      .where(eq(numerosEstado.asignacionId, vencidoEnRifaManual.id));
    expect(numeroManual).toMatchObject({ estado: "apartado", vencido: true });

    const [movimiento] = await db
      .select()
      .from(movimientos)
      .where(
        and(eq(movimientos.asignacionId, vencido.id), eq(movimientos.tipo, "liberacion_automatica")),
      );
    expect(movimiento.usuarioId).toBeNull();
  });

  it("no hace nada la segunda vez", async () => {
    const rifa = await crearRifaDePrueba(db, { liberacionAutomatica: true });
    const [a] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [1], comprador: { nombre: "Ana" } });
    await vencer(db, a.id);

    expect(await liberarApartadosVencidos(db)).toBe(1);
    expect(await liberarApartadosVencidos(db)).toBe(0);
  });
});

import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, compradores, movimientos } from "@/db/schema";
import { apartarNumeros, confirmarPago, liberarApartadosVencidos } from "@/server/asignaciones";
import { AsignacionesNoVigentesError, NumerosNoDisponiblesError } from "@/server/errores";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas, vencer } from "./helpers";

// Cada operación corre en su propia transacción y conexión, al mismo tiempo,
// como si varias personas capturaran desde distintos dispositivos.
const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function totalVigentesPorNumero() {
  return db.execute<{ numero_id: string; vigentes: number }>(sql`
    select numero_id, count(*)::int as vigentes
    from asignaciones
    where estado in ('apartado', 'vendido')
    group by numero_id
  `);
}

describe("concurrencia", () => {
  it("20 personas apartan el mismo número al mismo tiempo: solo una lo consigue", async () => {
    const rifa = await crearRifaDePrueba(db);

    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        apartarNumeros(db, { rifaId: rifa.id, numeros: [7], comprador: { nombre: `Persona ${i}` } }),
      ),
    );

    const ganadores = resultados.filter((r) => r.status === "fulfilled");
    const rechazados = resultados.filter((r) => r.status === "rejected");
    expect(ganadores).toHaveLength(1);
    expect(rechazados).toHaveLength(19);
    for (const r of rechazados) {
      expect(r.reason).toBeInstanceOf(NumerosNoDisponiblesError);
    }

    const [{ total: totalAsignaciones }] = await db.select({ total: count() }).from(asignaciones);
    const [{ total: totalCompradores }] = await db.select({ total: count() }).from(compradores);
    const [{ total: totalMovimientos }] = await db.select({ total: count() }).from(movimientos);
    expect([totalAsignaciones, totalCompradores, totalMovimientos]).toEqual([1, 1, 1]);
  });

  it("apartados simultáneos con números en común no se interbloquean ni se enciman", async () => {
    const rifa = await crearRifaDePrueba(db);
    // Grupos que se traslapan, algunos en orden inverso, para provocar bloqueos cruzados.
    const grupos = [
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [3, 4, 5, 6, 7],
      [9, 8, 7, 6, 5],
      [10, 11, 12],
      [12, 11, 10, 1],
      [20, 21],
      [21, 20],
    ];

    const resultados = await Promise.allSettled(
      grupos.map((numeros, i) =>
        apartarNumeros(db, { rifaId: rifa.id, numeros, comprador: { nombre: `Grupo ${i}` } }),
      ),
    );

    // Ningún error inesperado (por ejemplo, un deadlock): solo "ya no está disponible".
    for (const r of resultados) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(NumerosNoDisponiblesError);
    }
    // Cada solicitud exitosa obtuvo todos sus números.
    const ganadores = resultados.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []));
    for (const i of ganadores) {
      const r = resultados[i] as PromiseFulfilledResult<unknown[]>;
      expect(r.value).toHaveLength(new Set(grupos[i]).size);
    }
    // Ningún número quedó con dos asignaciones vigentes.
    const vigentes = await totalVigentesPorNumero();
    expect(vigentes.every((v) => v.vigentes === 1)).toBe(true);
    expect(vigentes).toHaveLength(ganadores.reduce((suma, i) => suma + new Set(grupos[i]).size, 0));
  });

  it("confirmar un pago mientras corre la liberación automática: gana uno y el estado queda consistente", async () => {
    const rifa = await crearRifaDePrueba(db, { liberacionAutomatica: true });

    for (let numero = 0; numero < 15; numero++) {
      const [apartado] = await apartarNumeros(db, {
        rifaId: rifa.id,
        numeros: [numero],
        comprador: { nombre: `Comprador ${numero}` },
      });
      await vencer(db, apartado.id);

      const [pago, liberacion] = await Promise.allSettled([
        confirmarPago(db, { asignacionIds: [apartado.id] }),
        liberarApartadosVencidos(db),
      ]);

      const [final] = await db.select().from(asignaciones).where(eq(asignaciones.id, apartado.id));
      const tipos = (
        await db
          .select({ tipo: movimientos.tipo })
          .from(movimientos)
          .where(eq(movimientos.asignacionId, apartado.id))
      ).map((m) => m.tipo);

      if (pago.status === "fulfilled") {
        // El pago llegó primero: la liberación ya no lo tocó.
        expect(liberacion).toEqual({ status: "fulfilled", value: 0 });
        expect(final.estado).toBe("vendido");
        expect(tipos.sort()).toEqual(["apartado", "pago_confirmado"]);
      } else {
        // La liberación llegó primero: el pago se rechazó sin modificar nada.
        expect(pago.reason).toBeInstanceOf(AsignacionesNoVigentesError);
        expect(liberacion).toEqual({ status: "fulfilled", value: 1 });
        expect(final.estado).toBe("liberado");
        expect(tipos.sort()).toEqual(["apartado", "liberacion_automatica"]);
      }
    }
  });

  it("varias liberaciones automáticas al mismo tiempo no duplican el historial", async () => {
    const rifa = await crearRifaDePrueba(db, { liberacionAutomatica: true });
    const apartados = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: Array.from({ length: 30 }, (_, i) => i),
      comprador: { nombre: "Ana" },
    });
    await db.execute(
      sql`update asignaciones set fecha_limite = now() - interval '1 minute' where rifa_id = ${rifa.id}`,
    );

    const liberados = await Promise.all(Array.from({ length: 5 }, () => liberarApartadosVencidos(db)));

    expect(liberados.reduce((a, b) => a + b, 0)).toBe(apartados.length);
    const [{ total }] = await db
      .select({ total: count() })
      .from(movimientos)
      .where(eq(movimientos.tipo, "liberacion_automatica"));
    expect(total).toBe(apartados.length);
  });
});

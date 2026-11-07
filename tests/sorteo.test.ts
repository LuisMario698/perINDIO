import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, rifas } from "@/db/schema";
import { apartarNumeros, confirmarPago } from "@/server/asignaciones";
import { obtenerRifaPublica } from "@/server/publico";
import {
  cerrarVentas,
  guardarPremios,
  listarPremios,
  reabrirVentas,
  registrarResultado,
} from "@/server/sorteo";

import { conectarBaseDePruebas, crearRifaDePrueba, crearUsuarioDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function preparar() {
  const rifa = await crearRifaDePrueba(db, { publica: true, slug: "sorteo" }); // números 0–99
  const admin = await crearUsuarioDePrueba(db, rifa.organizadorId, "admin");
  const base = { organizadorId: rifa.organizadorId, rifaId: rifa.id };
  await guardarPremios(db, rifa.organizadorId, rifa.id, [" Pantalla ", "", "Bicicleta"]);
  const premiosGuardados = await listarPremios(db, rifa.id);
  return { rifa, admin, base, premios: premiosGuardados };
}

describe("sorteo", () => {
  it("cierra ventas liberando lo pendiente, registra ganadores y queda en solo lectura", async () => {
    const { rifa, admin, base, premios } = await preparar();
    expect(premios.map((p) => [p.lugar, p.descripcion])).toEqual([
      [1, "Pantalla"],
      [2, "Bicicleta"],
    ]);

    await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [7],
      comprador: { nombre: "María Guadalupe Pérez", telefono: "5511112222" },
      usuarioId: admin.id,
      pagoConfirmado: true,
    });
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [8], comprador: { nombre: "Beto" }, usuarioId: admin.id });

    // Antes de cerrar ventas no se puede registrar.
    await expect(
      registrarResultado(db, { ...base, ganadores: { [premios[0].id]: 7, [premios[1].id]: 9 } }),
    ).rejects.toThrow("Primero cierra las ventas");

    expect(await cerrarVentas(db, { ...base, usuarioId: admin.id, liberarPendientes: true })).toBe(1);
    await expect(
      apartarNumeros(db, { rifaId: rifa.id, numeros: [10], comprador: { nombre: "Tarde" } }),
    ).rejects.toThrow("cerradas");

    // El 9 no tiene comprador: se advierte y no se guarda nada.
    const ganadores = { [premios[0].id]: 7, [premios[1].id]: 9 };
    const intento = await registrarResultado(db, { ...base, ganadores });
    expect(intento).toEqual({
      registrado: false,
      advertencias: ["2.º lugar: el número 09 no tiene comprador."],
    });
    expect((await db.select().from(rifas).where(eq(rifas.id, rifa.id)))[0].estado).toBe("cerrada");

    expect(await registrarResultado(db, { ...base, ganadores, aunqueNoEstenPagados: true })).toEqual({
      registrado: true,
    });
    const [final] = await db.select().from(rifas).where(eq(rifas.id, rifa.id));
    expect(final.estado).toBe("sorteada");
    expect(final.sorteadaEn).toBeInstanceOf(Date);

    const resultado = await listarPremios(db, rifa.id);
    expect(resultado[0]).toMatchObject({ numeroGanador: 7, ganador: "María Guadalupe Pérez", estadoPago: "confirmado" });
    expect(resultado[1]).toMatchObject({ numeroGanador: 9, ganador: null });

    // En público, el ganador sale abreviado.
    const publica = await obtenerRifaPublica(db, "sorteo");
    expect(publica!.premios[0]).toMatchObject({ numeroGanador: 7, ganador: "María G." });

    // Solo lectura: ni premios, ni reabrir, ni tocar asignaciones.
    await expect(guardarPremios(db, rifa.organizadorId, rifa.id, ["Otro"])).rejects.toThrow("sorteada");
    await expect(reabrirVentas(db, rifa.organizadorId, rifa.id)).rejects.toThrow("sorteada");
    await expect(
      db.update(asignaciones).set({ observaciones: "x" }).where(eq(asignaciones.rifaId, rifa.id)),
    ).rejects.toThrow();
  });

  it("advierte si el ganador no ha pagado y valida los números", async () => {
    const { rifa, admin, base, premios } = await preparar();
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [3],
      comprador: { nombre: "Ana" },
      usuarioId: admin.id,
    });
    await cerrarVentas(db, { ...base, usuarioId: admin.id, liberarPendientes: false });

    await expect(
      registrarResultado(db, { ...base, ganadores: { [premios[0].id]: 3, [premios[1].id]: 3 } }),
    ).rejects.toThrow("dos premios");
    await expect(
      registrarResultado(db, { ...base, ganadores: { [premios[0].id]: 3, [premios[1].id]: 100 } }),
    ).rejects.toThrow("entre 00 y 99");
    await expect(registrarResultado(db, { ...base, ganadores: { [premios[0].id]: 3 } })).rejects.toThrow(
      "2.º lugar",
    );

    const sinPagar = await registrarResultado(db, {
      ...base,
      ganadores: { [premios[0].id]: 3, [premios[1].id]: 4 },
    });
    expect(sinPagar.registrado).toBe(false);
    expect(!sinPagar.registrado && sinPagar.advertencias[0]).toContain("apartado pero no pagado");

    // Pagado ya no hay advertencia para el 3; reabrir y volver a cerrar funciona.
    await confirmarPago(db, { asignacionIds: [apartado.id], usuarioId: admin.id });
    await reabrirVentas(db, rifa.organizadorId, rifa.id);
    await cerrarVentas(db, { ...base, usuarioId: admin.id, liberarPendientes: false });
    const conLibre = await registrarResultado(db, { ...base, ganadores: { [premios[0].id]: 3, [premios[1].id]: 4 } });
    expect(conLibre).toEqual({ registrado: false, advertencias: ["2.º lugar: el número 04 no tiene comprador."] });
  });

  it("sin premios no se puede sortear y otra organización no toca la rifa", async () => {
    const rifa = await crearRifaDePrueba(db);
    const admin = await crearUsuarioDePrueba(db, rifa.organizadorId, "admin");
    await cerrarVentas(db, { organizadorId: rifa.organizadorId, rifaId: rifa.id, usuarioId: admin.id, liberarPendientes: false });
    await expect(
      registrarResultado(db, { organizadorId: rifa.organizadorId, rifaId: rifa.id, ganadores: {} }),
    ).rejects.toThrow("al menos un premio");

    const ajena = await crearRifaDePrueba(db);
    await expect(guardarPremios(db, ajena.organizadorId, rifa.id, ["X"])).rejects.toThrow("no existe");
  });
});

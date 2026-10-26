import { and, asc, count, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, compradores, movimientos, numeros, numerosEstado, rifas } from "@/db/schema";
import {
  apartarNumeros,
  cancelarAsignaciones,
  confirmarPago,
  liberarAsignaciones,
} from "@/server/asignaciones";
import {
  AsignacionesNoVigentesError,
  ErrorDeNegocio,
  NumerosNoDisponiblesError,
} from "@/server/errores";

import { codigoDeError, conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function estadoDe(rifaId: string, numero: number) {
  const [fila] = await db
    .select()
    .from(numerosEstado)
    .where(and(eq(numerosEstado.rifaId, rifaId), eq(numerosEstado.numero, numero)));
  return fila;
}

async function tiposDeMovimiento(numeroId: string) {
  const filas = await db
    .select({ tipo: movimientos.tipo })
    .from(movimientos)
    .where(eq(movimientos.numeroId, numeroId))
    .orderBy(asc(movimientos.id));
  return filas.map((f) => f.tipo);
}

describe("apartarNumeros", () => {
  it("aparta con pago pendiente y fecha límite según el plazo de la rifa", async () => {
    const rifa = await crearRifaDePrueba(db, { plazoApartadoHoras: 48 });

    const [asignacion] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [7],
      comprador: { nombre: "  Ana López ", telefono: "55 0000 0001" },
    });

    expect(asignacion.estado).toBe("apartado");
    expect(asignacion.estadoPago).toBe("pendiente");
    expect(asignacion.monto).toBe("50.00");
    expect(asignacion.fechaLimite!.getTime() - asignacion.creadoEn.getTime()).toBe(48 * 3600 * 1000);

    const numero = await estadoDe(rifa.id, 7);
    expect(numero).toMatchObject({
      etiqueta: "07",
      estado: "apartado",
      estadoPago: "pendiente",
      vencido: false,
      compradorNombre: "Ana López",
    });
    expect(await tiposDeMovimiento(numero.numeroId)).toEqual(["apartado"]);
  });

  it("con pago confirmado registra una venta directa", async () => {
    const rifa = await crearRifaDePrueba(db);

    const [asignacion] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [3],
      comprador: { nombre: "Luis" },
      pagoConfirmado: true,
    });

    expect(asignacion).toMatchObject({ estado: "vendido", estadoPago: "confirmado", fechaLimite: null });
    expect(asignacion.fechaPago).toBeInstanceOf(Date);
    expect(await tiposDeMovimiento(asignacion.numeroId)).toEqual(["venta"]);
  });

  it("es todo o nada: si un número está ocupado no aparta ninguno", async () => {
    const rifa = await crearRifaDePrueba(db);
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [5], comprador: { nombre: "Ana" } });

    const intento = apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [6, 5, 4],
      comprador: { nombre: "Beto" },
    });

    await expect(intento).rejects.toThrow(NumerosNoDisponiblesError);
    await expect(intento).rejects.toThrow("El número 05 ya no está disponible.");
    expect((await estadoDe(rifa.id, 4)).estado).toBe("disponible");
    expect((await estadoDe(rifa.id, 6)).estado).toBe("disponible");
    // El comprador nuevo también se revirtió.
    const [{ total }] = await db.select({ total: count() }).from(compradores);
    expect(total).toBe(1);
  });

  it("reutiliza un comprador existente", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [primera] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1],
      comprador: { nombre: "Ana" },
    });

    const [segunda] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [2],
      comprador: { id: primera.compradorId },
    });

    expect(segunda.compradorId).toBe(primera.compradorId);
  });

  it("rechaza números que la rifa no tiene y rifas cerradas", async () => {
    const rifa = await crearRifaDePrueba(db);

    await expect(
      apartarNumeros(db, { rifaId: rifa.id, numeros: [150], comprador: { nombre: "Ana" } }),
    ).rejects.toThrow("La rifa no tiene los números 150.");

    await db.update(rifas).set({ estado: "cerrada" }).where(eq(rifas.id, rifa.id));
    await expect(
      apartarNumeros(db, { rifaId: rifa.id, numeros: [1], comprador: { nombre: "Ana" } }),
    ).rejects.toThrow(ErrorDeNegocio);
  });
});

describe("confirmarPago", () => {
  it("convierte el apartado en venta pagada, una sola vez", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [10],
      comprador: { nombre: "Ana" },
    });

    const [pagado] = await confirmarPago(db, { asignacionIds: [apartado.id] });

    expect(pagado).toMatchObject({ estado: "vendido", estadoPago: "confirmado" });
    expect((await estadoDe(rifa.id, 10)).estado).toBe("vendido");
    await expect(confirmarPago(db, { asignacionIds: [apartado.id] })).rejects.toThrow(
      AsignacionesNoVigentesError,
    );
    expect(await tiposDeMovimiento(apartado.numeroId)).toEqual(["apartado", "pago_confirmado"]);
  });
});

describe("liberarAsignaciones", () => {
  it("devuelve el número a disponible y conserva el historial", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [20],
      comprador: { nombre: "Ana" },
    });

    await liberarAsignaciones(db, { asignacionIds: [apartado.id], usuarioId: "admin" });
    expect((await estadoDe(rifa.id, 20)).estado).toBe("disponible");

    // Otro comprador puede tomarlo.
    await apartarNumeros(db, { rifaId: rifa.id, numeros: [20], comprador: { nombre: "Beto" } });
    expect((await estadoDe(rifa.id, 20)).compradorNombre).toBe("Beto");

    const historial = await db
      .select({ estado: asignaciones.estado })
      .from(asignaciones)
      .where(eq(asignaciones.numeroId, apartado.numeroId))
      .orderBy(asc(asignaciones.creadoEn));
    expect(historial.map((a) => a.estado)).toEqual(["liberado", "apartado"]);
    expect(await tiposDeMovimiento(apartado.numeroId)).toEqual([
      "apartado",
      "liberacion_manual",
      "apartado",
    ]);
  });

  it("no libera un número ya pagado", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [venta] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [30],
      comprador: { nombre: "Ana" },
      pagoConfirmado: true,
    });

    await expect(liberarAsignaciones(db, { asignacionIds: [venta.id] })).rejects.toThrow(
      AsignacionesNoVigentesError,
    );
    expect((await estadoDe(rifa.id, 30)).estado).toBe("vendido");
  });
});

describe("cancelarAsignaciones", () => {
  it("cancela una venta y guarda el motivo", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [venta] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [40],
      comprador: { nombre: "Ana" },
      pagoConfirmado: true,
    });

    await cancelarAsignaciones(db, { asignacionIds: [venta.id], motivo: "Error de captura" });

    expect((await estadoDe(rifa.id, 40)).estado).toBe("disponible");
    const [movimiento] = await db
      .select()
      .from(movimientos)
      .where(and(eq(movimientos.asignacionId, venta.id), eq(movimientos.tipo, "cancelacion")));
    expect(movimiento.detalle).toEqual({ motivo: "Error de captura", estadoPago: "confirmado" });
  });
});

// Estas reglas las impone Postgres, aunque alguien escriba directo en la base.
describe("reglas en la base", () => {
  it("no permite dos asignaciones vigentes del mismo número", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [a] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [1], comprador: { nombre: "Ana" } });

    const duplicada = db.insert(asignaciones).values({
      rifaId: rifa.id,
      numeroId: a.numeroId,
      compradorId: a.compradorId,
      estado: "vendido",
      estadoPago: "pendiente",
      monto: "50.00",
    });
    expect(await codigoDeError(duplicada)).toBe("23505"); // unique_violation
  });

  it("no permite un apartado con pago confirmado ni sin fecha límite", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [a] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [1], comprador: { nombre: "Ana" } });

    const conPago = db
      .update(asignaciones)
      .set({ estadoPago: "confirmado", fechaPago: new Date() })
      .where(eq(asignaciones.id, a.id));
    expect(await codigoDeError(conPago)).toBe("23514"); // check_violation

    const sinFecha = db.update(asignaciones).set({ fechaLimite: null }).where(eq(asignaciones.id, a.id));
    expect(await codigoDeError(sinFecha)).toBe("23514");
  });

  it("no permite asignar un número de otra rifa", async () => {
    const rifaA = await crearRifaDePrueba(db);
    const rifaB = await crearRifaDePrueba(db);
    const [a] = await apartarNumeros(db, { rifaId: rifaA.id, numeros: [1], comprador: { nombre: "Ana" } });
    const [libreDeA] = await db
      .select({ id: numeros.id })
      .from(numeros)
      .where(and(eq(numeros.rifaId, rifaA.id), eq(numeros.numero, 2)));

    const cruzada = db.insert(asignaciones).values({
      rifaId: rifaB.id,
      numeroId: libreDeA.id,
      compradorId: a.compradorId,
      estado: "vendido",
      estadoPago: "pendiente",
      monto: "50.00",
    });
    expect(await codigoDeError(cruzada)).toBe("23503"); // foreign_key_violation
  });
});

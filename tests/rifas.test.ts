import { asc, count, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { asignaciones, numeros, numerosEstado, organizadores, rifas } from "@/db/schema";
import { apartarNumeros, liberarAsignaciones } from "@/server/asignaciones";
import { ErrorDeNegocio } from "@/server/errores";
import {
  actualizarRifa,
  eliminarRifa,
  tieneAsignaciones,
  type ConfiguracionRifa,
} from "@/server/rifas";

import { codigoDeError, conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

async function etiquetas(rifaId: string) {
  const filas = await db
    .select({ etiqueta: numerosEstado.etiqueta })
    .from(numerosEstado)
    .where(eq(numerosEstado.rifaId, rifaId))
    .orderBy(asc(numerosEstado.numero));
  return filas.map((f) => f.etiqueta);
}

/** La configuración actual de la rifa con los cambios indicados. */
async function configuracion(rifaId: string, cambios: Partial<ConfiguracionRifa> = {}) {
  const [r] = await db.select().from(rifas).where(eq(rifas.id, rifaId));
  return {
    nombre: r.nombre,
    descripcion: r.descripcion,
    numeroInicial: r.numeroInicial,
    cantidadNumeros: r.cantidadNumeros,
    digitos: r.digitos,
    precioNumero: r.precioNumero,
    plazoApartadoHoras: r.plazoApartadoHoras,
    liberacionAutomatica: r.liberacionAutomatica,
    fechaSorteo: r.fechaSorteo,
    estado: r.estado === "cerrada" ? "cerrada" : "activa",
    ...cambios,
  } satisfies ConfiguracionRifa;
}

describe("crearRifa", () => {
  it("genera los 2,000 números del 0000 al 1999", async () => {
    const rifa = await crearRifaDePrueba(db, { cantidadNumeros: 2000 });

    expect(rifa.digitos).toBe(4);
    const [{ total }] = await db
      .select({ total: count() })
      .from(numeros)
      .where(eq(numeros.rifaId, rifa.id));
    expect(total).toBe(2000);

    const lista = await db
      .select()
      .from(numerosEstado)
      .where(eq(numerosEstado.rifaId, rifa.id))
      .orderBy(asc(numerosEstado.numero));
    expect(lista[0].etiqueta).toBe("0000");
    expect(lista[7].etiqueta).toBe("0007");
    expect(lista.at(-1)?.etiqueta).toBe("1999");
    expect(lista.every((n) => n.estado === "disponible" && !n.vencido)).toBe(true);
  });

  it("respeta el número inicial y los dígitos indicados", async () => {
    const rifa = await crearRifaDePrueba(db, { numeroInicial: 1, cantidadNumeros: 100, digitos: 3 });

    const lista = await db
      .select({ etiqueta: numerosEstado.etiqueta })
      .from(numerosEstado)
      .where(eq(numerosEstado.rifaId, rifa.id))
      .orderBy(asc(numerosEstado.numero));
    expect(lista.map((n) => n.etiqueta)).toEqual(
      Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(3, "0")),
    );
  });

  it("rechaza un rango que no cabe en los dígitos y no deja nada a medias", async () => {
    const codigo = await codigoDeError(crearRifaDePrueba(db, { cantidadNumeros: 2000, digitos: 3 }));

    expect(codigo).toBe("23514"); // check_violation
    const [{ total }] = await db.select({ total: count() }).from(rifas);
    expect(total).toBe(0);
  });
});

describe("actualizarRifa", () => {
  it("sin asignaciones puede cambiar el rango y regenera los números", async () => {
    const rifa = await crearRifaDePrueba(db);

    const actualizada = await actualizarRifa(
      db,
      rifa.id,
      rifa.organizadorId,
      await configuracion(rifa.id, { numeroInicial: 1, cantidadNumeros: 500, digitos: 3 }),
    );

    expect(actualizada.cantidadNumeros).toBe(500);
    const lista = await etiquetas(rifa.id);
    expect(lista).toHaveLength(500);
    expect([lista[0], lista.at(-1)]).toEqual(["001", "500"]);
  });

  it("con asignaciones no deja cambiar el rango ni los dígitos, pero sí lo demás", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [5],
      comprador: { nombre: "Ana" },
    });

    for (const cambio of [{ cantidadNumeros: 200, digitos: 3 }, { digitos: 3 }]) {
      await expect(
        actualizarRifa(db, rifa.id, rifa.organizadorId, await configuracion(rifa.id, cambio)),
      ).rejects.toThrow("el rango y los dígitos ya no se pueden cambiar");
    }

    const actualizada = await actualizarRifa(
      db,
      rifa.id,
      rifa.organizadorId,
      await configuracion(rifa.id, {
        nombre: "Nuevo nombre",
        precioNumero: "75.00",
        plazoApartadoHoras: 24,
        fechaSorteo: "2026-12-20",
        estado: "cerrada",
      }),
    );

    expect(actualizada).toMatchObject({
      nombre: "Nuevo nombre",
      precioNumero: "75.00",
      fechaSorteo: "2026-12-20",
      estado: "cerrada",
    });
    // El apartado conserva el precio con el que se hizo.
    const [guardado] = await db.select().from(asignaciones).where(eq(asignaciones.id, apartado.id));
    expect(guardado.monto).toBe("50.00");
    expect(await etiquetas(rifa.id)).toHaveLength(100);
  });

  it("no deja modificar la rifa de otro organizador", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [otro] = await db.insert(organizadores).values({ nombre: "Otro" }).returning();

    await expect(
      actualizarRifa(db, rifa.id, otro.id, await configuracion(rifa.id, { nombre: "Mía" })),
    ).rejects.toThrow("La rifa no existe.");
  });

  it("cambiar el rango mientras alguien aparta deja todo consistente", async () => {
    for (let intento = 0; intento < 10; intento++) {
      await vaciarTablas(db);
      const rifa = await crearRifaDePrueba(db);
      const nueva = await configuracion(rifa.id, { cantidadNumeros: 50 });

      const [apartado, cambio] = await Promise.allSettled([
        apartarNumeros(db, { rifaId: rifa.id, numeros: [70], comprador: { nombre: "Ana" } }),
        actualizarRifa(db, rifa.id, rifa.organizadorId, nueva),
      ]);

      const [{ cantidad }] = await db
        .select({ cantidad: rifas.cantidadNumeros })
        .from(rifas)
        .where(eq(rifas.id, rifa.id));
      if (cambio.status === "fulfilled") {
        // El cambio llegó primero: el 70 ya no existe y el apartado se rechazó.
        expect(apartado.status).toBe("rejected");
        expect(cantidad).toBe(50);
        expect(await tieneAsignaciones(db, rifa.id)).toBe(false);
      } else {
        // El apartado llegó primero: el rango quedó como estaba.
        expect(cambio.reason).toBeInstanceOf(ErrorDeNegocio);
        expect(apartado.status).toBe("fulfilled");
        expect(cantidad).toBe(100);
      }
    }
  });
});

describe("opciones de la página pública", () => {
  it("guarda el enlace, los límites y las instrucciones de pago", async () => {
    const rifa = await crearRifaDePrueba(db, { slug: "original" });
    await crearRifaDePrueba(db, { slug: "ocupado" });

    const actualizada = await actualizarRifa(
      db,
      rifa.id,
      rifa.organizadorId,
      await configuracion(rifa.id, {
        publica: false,
        slug: "nuevo-enlace",
        plazoPublicoHoras: 6,
        maxNumerosPublico: 8,
        instruccionesPago: "  CLABE 123  ",
      }),
    );
    expect(actualizada).toMatchObject({
      publica: false,
      slug: "nuevo-enlace",
      plazoPublicoHoras: 6,
      maxNumerosPublico: 8,
      instruccionesPago: "CLABE 123",
    });

    // Sin slug se conserva el actual; uno ocupado se rechaza.
    const igual = await actualizarRifa(db, rifa.id, rifa.organizadorId, await configuracion(rifa.id));
    expect(igual.slug).toBe("nuevo-enlace");
    await expect(
      actualizarRifa(db, rifa.id, rifa.organizadorId, await configuracion(rifa.id, { slug: "ocupado" })),
    ).rejects.toThrow("Ese enlace ya lo usa otra rifa");
  });
});

describe("eliminarRifa", () => {
  it("borra una rifa sin asignaciones junto con sus números", async () => {
    const rifa = await crearRifaDePrueba(db);

    await eliminarRifa(db, rifa.id, rifa.organizadorId);

    const [{ total }] = await db.select({ total: count() }).from(numeros);
    expect(total).toBe(0);
    expect(await db.select().from(rifas)).toHaveLength(0);
  });

  it("no borra una rifa que tuvo asignaciones, aunque ya estén liberadas", async () => {
    const rifa = await crearRifaDePrueba(db);
    const [apartado] = await apartarNumeros(db, {
      rifaId: rifa.id,
      numeros: [1],
      comprador: { nombre: "Ana" },
    });
    await liberarAsignaciones(db, { asignacionIds: [apartado.id] });

    await expect(eliminarRifa(db, rifa.id, rifa.organizadorId)).rejects.toThrow(ErrorDeNegocio);
    expect(await db.select().from(rifas)).toHaveLength(1);
  });
});

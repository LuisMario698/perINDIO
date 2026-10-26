import { asc, count, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { numeros, numerosEstado, rifas } from "@/db/schema";

import { codigoDeError, conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

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

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { esquemaRifa, esUuid, leerFormularioRifa } from "@/lib/validacion/rifa";

const valida = {
  nombre: "  Rifa Pro Fondos ",
  descripcion: "",
  numeroInicial: "0",
  cantidadNumeros: "2000",
  digitos: "4",
  precioNumero: "$1,500.50",
  plazoApartadoHoras: "48",
  liberacionAutomatica: true,
  fechaSorteo: "",
  estado: undefined,
};

function errores(datos: Record<string, unknown>) {
  const resultado = esquemaRifa.safeParse(datos);
  return resultado.success ? {} : z.flattenError(resultado.error).fieldErrors;
}

describe("esquemaRifa", () => {
  it("normaliza los datos del formulario", () => {
    expect(esquemaRifa.parse(valida)).toEqual({
      nombre: "Rifa Pro Fondos",
      descripcion: null,
      numeroInicial: 0,
      cantidadNumeros: 2000,
      digitos: 4,
      precioNumero: "1500.50",
      plazoApartadoHoras: 48,
      liberacionAutomatica: true,
      fechaSorteo: null,
      estado: "activa",
    });
  });

  it("explica cada campo inválido en español", () => {
    expect(
      errores({
        ...valida,
        nombre: " ",
        cantidadNumeros: "muchos",
        precioNumero: "10.999",
        plazoApartadoHoras: "0",
        fechaSorteo: "2026-02-30",
      }),
    ).toEqual({
      nombre: ["Escribe el nombre de la rifa."],
      cantidadNumeros: ["Escribe un número entero."],
      precioNumero: ["Escribe un precio válido, por ejemplo 100 o 99.50."],
      plazoApartadoHoras: ["Al menos una hora."],
      fechaSorteo: ["Fecha no válida."],
    });
  });

  it("avisa cuando el rango no cabe en los dígitos", () => {
    expect(errores({ ...valida, digitos: "3" })).toEqual({
      digitos: ["El número más alto (1999) necesita 4 dígitos."],
    });
  });
});

describe("leerFormularioRifa", () => {
  it("convierte la casilla y los campos vacíos", () => {
    const formulario = new FormData();
    formulario.set("nombre", "Rifa");

    expect(leerFormularioRifa(formulario)).toMatchObject({
      nombre: "Rifa",
      cantidadNumeros: "",
      liberacionAutomatica: false,
      estado: undefined,
    });

    formulario.set("liberacionAutomatica", "on");
    expect(leerFormularioRifa(formulario).liberacionAutomatica).toBe(true);
  });
});

describe("esUuid", () => {
  it("solo acepta UUID", () => {
    expect(esUuid("0e2b5c3a-1f7e-4d8b-9c1a-2b3c4d5e6f70")).toBe(true);
    expect(esUuid("1; drop table rifas")).toBe(false);
  });
});

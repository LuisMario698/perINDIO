import { describe, expect, it } from "vitest";
import { z } from "zod";

import { esquemaApartado, esquemaIdsAsignacion, leerFormularioApartado } from "@/lib/validacion/apartado";

function formulario(campos: Record<string, string | string[]>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) datos.append(campo, v);
  }
  return leerFormularioApartado(datos);
}

function errores(campos: Record<string, string | string[]>) {
  const resultado = esquemaApartado.safeParse(formulario(campos));
  return resultado.success ? {} : z.flattenError(resultado.error).fieldErrors;
}

describe("esquemaApartado", () => {
  it("lee varios números y normaliza a un comprador nuevo", () => {
    expect(
      esquemaApartado.parse(
        formulario({ numeros: ["12", "7"], nombre: " Ana ", telefono: "", plazoHoras: "48" }),
      ),
    ).toEqual({
      numeros: [12, 7],
      compradorId: null,
      nombre: "Ana",
      telefono: null,
      pagoConfirmado: false,
      plazoHoras: 48,
      observaciones: null,
    });
  });

  it("con un comprador existente no pide nombre", () => {
    const compradorId = "0e2b5c3a-1f7e-4d8b-9c1a-2b3c4d5e6f70";
    const datos = esquemaApartado.parse(
      formulario({ numeros: "3", compradorId, pagoConfirmado: "on", plazoHoras: "24" }),
    );
    expect(datos).toMatchObject({ compradorId, pagoConfirmado: true });
  });

  it("pide números, nombre y un plazo válido", () => {
    expect(errores({ plazoHoras: "0" })).toEqual({
      numeros: ["Selecciona al menos un número."],
      nombre: ["Escribe el nombre del comprador o elige uno existente."],
      plazoHoras: ["Al menos una hora."],
    });
    expect(errores({ numeros: "1", plazoHoras: "48" })).toEqual({
      nombre: ["Escribe el nombre del comprador o elige uno existente."],
    });
  });

  it("rechaza un comprador que no es un id válido", () => {
    expect(errores({ numeros: "1", compradorId: "otro", plazoHoras: "48" })).toHaveProperty(
      "compradorId",
    );
  });
});

describe("esquemaIdsAsignacion", () => {
  it("solo acepta UUID", () => {
    expect(esquemaIdsAsignacion.safeParse(["x"]).success).toBe(false);
    expect(esquemaIdsAsignacion.safeParse([]).success).toBe(false);
  });
});

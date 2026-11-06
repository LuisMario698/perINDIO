import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { TIPOS_PDF, type TipoPdf } from "@/lib/pdfs";
import { apartarNumeros } from "@/server/asignaciones";
import { listarNumerosParaPdf } from "@/server/consultas";
import { generarPdf } from "@/server/pdf";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas, vencer } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

/** Genera el PDF sin comprimir para poder buscar el texto dentro del archivo. */
async function pdfDe(tipo: TipoPdf, cantidadNumeros = 100) {
  const rifa = await crearRifaDePrueba(db, { cantidadNumeros, nombre: "Rifa PDF" });
  await apartarNumeros(db, { rifaId: rifa.id, numeros: [3], comprador: { nombre: "Ana Uno" }, pagoConfirmado: true });
  await apartarNumeros(db, { rifaId: rifa.id, numeros: [5], comprador: { nombre: "Beto Dos" } });
  const [vencido] = await apartarNumeros(db, { rifaId: rifa.id, numeros: [7], comprador: { nombre: "Caro Tres" } });
  await vencer(db, vencido.id);

  const numeros = await listarNumerosParaPdf(db, rifa.id);
  const pdf = generarPdf(tipo, { rifa, numeros, generadoEn: new Date() }, { comprimir: false });
  const texto = Buffer.from(pdf).toString("latin1");
  return { texto, paginas: (texto.match(/\/Type \/Page[^s]/g) ?? []).length };
}

describe("PDF", () => {
  it("disponibles: solo los números libres, sin compradores", async () => {
    const { texto } = await pdfDe("disponibles");

    expect(texto).toContain("Rifa PDF");
    expect(texto).toContain("(02)");
    expect(texto).toContain("(99)");
    for (const ocupado of ["(03)", "(05)", "(07)", "Ana Uno", "Beto Dos", "Caro Tres"]) {
      expect(texto).not.toContain(ocupado);
    }
    expect(texto).toContain("97 de 100 n");
  });

  it("apartados: pendientes con vencidos marcados y el total por cobrar", async () => {
    const { texto } = await pdfDe("apartados");

    expect(texto).toContain("Beto Dos");
    expect(texto).toContain("Caro Tres");
    expect(texto).not.toContain("Ana Uno");
    expect(texto).toContain("VENCIDO");
    expect(texto).toContain("$100.00"); // 2 apartados de $50
  });

  it("ventas: solo pagados y el total cobrado", async () => {
    const { texto } = await pdfDe("ventas");

    expect(texto).toContain("Ana Uno");
    expect(texto).not.toContain("Beto Dos");
    expect(texto).toContain("Total cobrado");
    expect(texto).toContain("$50.00");
  });

  it("lista completa: 80 números por hoja en dos bloques", async () => {
    const { texto, paginas } = await pdfDe("lista-completa", 2000);

    expect(paginas).toBe(25);
    expect(texto).toContain("(1999)");
    expect(texto).toContain("Vencido");
  });

  it("genera todos los tipos comprimidos y pequeños", async () => {
    const rifa = await crearRifaDePrueba(db, { cantidadNumeros: 2000 });
    const numeros = await listarNumerosParaPdf(db, rifa.id);
    for (const tipo of TIPOS_PDF) {
      const pdf = generarPdf(tipo, { rifa, numeros, generadoEn: new Date() });
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.byteLength).toBeLessThan(200 * 1024);
    }
  });
});

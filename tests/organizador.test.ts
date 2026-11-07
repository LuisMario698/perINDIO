import { deflateSync } from "node:zlib";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { esquemaPerfil, formatearWhatsApp, tipoDeImagen } from "@/lib/validacion/organizador";
import { listarNumerosParaPdf } from "@/server/consultas";
import {
  actualizarPerfil,
  guardarLogo,
  logoParaPdf,
  obtenerPerfil,
  quitarLogo,
} from "@/server/organizador";
import { generarPdf } from "@/server/pdf";

import { conectarBaseDePruebas, crearRifaDePrueba, vaciarTablas } from "./helpers";

const db = conectarBaseDePruebas();

beforeEach(() => vaciarTablas(db));
afterAll(() => db.$client.end());

/** PNG válido de 1×1 píxel, armado a mano para no depender de archivos. */
function png1x1() {
  const crc = (datos: Buffer) => {
    let c = ~0;
    for (const byte of datos) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloque = (tipo: string, datos: Buffer) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      bloque("IHDR", ihdr),
      bloque("IDAT", deflateSync(Buffer.from([0, 255, 0, 0]))),
      bloque("IEND", Buffer.alloc(0)),
    ]),
  );
}

describe("validación del perfil", () => {
  it("normaliza el WhatsApp y acepta dejarlo vacío", () => {
    const ok = esquemaPerfil.parse({ nombre: " Club ", whatsapp: "55 1234 5678", datosPago: "" });
    expect(ok).toEqual({ nombre: "Club", whatsapp: "525512345678", datosPago: null });
    expect(esquemaPerfil.parse({ nombre: "Club", whatsapp: "", datosPago: "x" }).whatsapp).toBeNull();

    const mal = esquemaPerfil.safeParse({ nombre: "C", whatsapp: "123", datosPago: "" });
    expect(mal.success).toBe(false);
    expect(mal.error!.issues.map((i) => i.path[0]).sort()).toEqual(["nombre", "whatsapp"]);
    expect(formatearWhatsApp("525512345678")).toBe("+52 55 1234 5678");
  });

  it("reconoce el tipo de imagen por su contenido, no por el nombre", () => {
    expect(tipoDeImagen(png1x1())).toBe("image/png");
    expect(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
    expect(tipoDeImagen(webp)).toBe("image/webp");
    expect(tipoDeImagen(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("perfil del organizador", () => {
  it("guarda datos y logo, y el logo cambia de versión", async () => {
    const rifa = await crearRifaDePrueba(db);
    const id = rifa.organizadorId;

    await actualizarPerfil(db, id, { nombre: "Club Deportivo", whatsapp: "525512345678", datosPago: "CLABE" });
    expect(await obtenerPerfil(db, id)).toMatchObject({
      nombre: "Club Deportivo",
      whatsapp: "525512345678",
      datosPago: "CLABE",
      logoVersion: null,
    });

    await guardarLogo(db, id, png1x1());
    const { logoVersion } = await obtenerPerfil(db, id);
    expect(logoVersion).toMatch(/^[0-9a-f]{8}$/);
    expect(await logoParaPdf(db, id)).toMatchObject({ formato: "PNG" });

    await quitarLogo(db, id);
    expect((await obtenerPerfil(db, id)).logoVersion).toBeNull();
    expect(await logoParaPdf(db, id)).toBeUndefined();
  });

  it("rechaza archivos que no son imagen o que pesan demasiado", async () => {
    const { organizadorId } = await crearRifaDePrueba(db);

    await expect(guardarLogo(db, organizadorId, new TextEncoder().encode("<svg/>"))).rejects.toThrow(
      "PNG, JPG o WebP",
    );
    const enorme = new Uint8Array(300 * 1024);
    enorme.set(png1x1());
    await expect(guardarLogo(db, organizadorId, enorme)).rejects.toThrow("256 KB");
    await expect(guardarLogo(db, organizadorId, new Uint8Array())).rejects.toThrow("Elige una imagen");
  });

  it("el PDF lleva el logo y quién organiza", async () => {
    const rifa = await crearRifaDePrueba(db, { nombre: "Rifa con logo" });
    await guardarLogo(db, rifa.organizadorId, png1x1());

    const pdf = generarPdf(
      "disponibles",
      {
        rifa,
        numeros: await listarNumerosParaPdf(db, rifa.id),
        generadoEn: new Date(),
        organizador: {
          nombre: "Club Deportivo",
          whatsapp: "525512345678",
          logo: await logoParaPdf(db, rifa.organizadorId),
        },
      },
      { comprimir: false },
    );
    const texto = Buffer.from(pdf).toString("latin1");
    expect(texto).toContain("Organiza Club Deportivo");
    expect(texto).toContain("+52 55 1234 5678");
    expect(texto).toContain("/Subtype /Image");
  });
});

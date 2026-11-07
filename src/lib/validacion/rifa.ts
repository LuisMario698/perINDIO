import { z } from "zod";
import { es } from "zod/locales";

import { FORMATO_SLUG } from "../slug";

// Mensajes de zod en español para los casos que no tienen uno propio.
z.config(es());

export const LIMITES_RIFA = {
  cantidadMaxima: 100_000,
  digitosMaximos: 6,
  plazoMaximoHoras: 24 * 90,
} as const;

const entero = (mensaje = "Escribe un número entero.") =>
  z.coerce.number({ error: mensaje }).int(mensaje);

/** Configuración de una rifa tal como llega del formulario, ya validada y normalizada. */
export const esquemaRifa = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "Escribe el nombre de la rifa.")
      .max(120, "Máximo 120 caracteres."),
    descripcion: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres.")
      .transform((v) => v || null),
    numeroInicial: entero().min(0, "No puede ser negativo."),
    cantidadNumeros: entero()
      .min(1, "Debe haber al menos un número.")
      .max(LIMITES_RIFA.cantidadMaxima, "Máximo 100,000 números."),
    digitos: entero()
      .min(1, "Al menos 1 dígito.")
      .max(LIMITES_RIFA.digitosMaximos, `Máximo ${LIMITES_RIFA.digitosMaximos} dígitos.`),
    // Acepta "100", "99.5", "$1,500.00".
    precioNumero: z
      .string()
      .transform((v) => v.replace(/[$,\s]/g, ""))
      .pipe(
        z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un precio válido, por ejemplo 100 o 99.50."),
      ),
    plazoApartadoHoras: entero()
      .min(1, "Al menos una hora.")
      .max(LIMITES_RIFA.plazoMaximoHoras, "Máximo 90 días (2,160 horas)."),
    liberacionAutomatica: z.boolean(),
    fechaSorteo: z
      .union([z.literal(""), z.iso.date("Fecha no válida.")])
      .transform((v) => v || null),
    estado: z.enum(["activa", "cerrada"]).default("activa"),
    // Página pública
    publica: z.boolean(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(60, "Máximo 60 caracteres.")
      .refine((v) => v === "" || (v.length >= 3 && FORMATO_SLUG.test(v)), {
        message: "Solo minúsculas, números y guiones (por ejemplo rifa-de-navidad).",
      })
      // Vacío: se genera a partir del nombre (al crear) o se queda el actual (al editar).
      .transform((v) => v || undefined),
    plazoPublicoHoras: entero()
      .min(1, "Al menos una hora.")
      .max(LIMITES_RIFA.plazoMaximoHoras, "Máximo 90 días (2,160 horas)."),
    maxNumerosPublico: entero().min(1, "Al menos 1.").max(100, "Máximo 100."),
    instruccionesPago: z
      .string()
      .trim()
      .max(1000, "Máximo 1,000 caracteres.")
      .transform((v) => v || null),
  })
  .superRefine((datos, ctx) => {
    const ultimo = datos.numeroInicial + datos.cantidadNumeros - 1;
    const necesarios = String(ultimo).length;
    if (necesarios > datos.digitos) {
      ctx.addIssue({
        code: "custom",
        path: ["digitos"],
        message: `El número más alto (${ultimo}) necesita ${necesarios} dígitos.`,
      });
    }
  });

export type DatosRifa = z.output<typeof esquemaRifa>;
export type CampoRifa = keyof z.input<typeof esquemaRifa>;

/** Convierte el FormData del formulario de rifas en el objeto que valida esquemaRifa. */
export function leerFormularioRifa(formData: FormData) {
  const texto = (campo: CampoRifa) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };
  return {
    nombre: texto("nombre"),
    descripcion: texto("descripcion"),
    numeroInicial: texto("numeroInicial"),
    cantidadNumeros: texto("cantidadNumeros"),
    digitos: texto("digitos"),
    precioNumero: texto("precioNumero"),
    plazoApartadoHoras: texto("plazoApartadoHoras"),
    liberacionAutomatica: formData.get("liberacionAutomatica") === "on",
    fechaSorteo: texto("fechaSorteo"),
    estado: texto("estado") || undefined,
    publica: formData.get("publica") === "on",
    slug: texto("slug"),
    plazoPublicoHoras: texto("plazoPublicoHoras"),
    maxNumerosPublico: texto("maxNumerosPublico"),
    instruccionesPago: texto("instruccionesPago"),
  };
}

/** true si el texto es un UUID (para descartar ids inválidos antes de consultar la base). */
export function esUuid(valor: unknown): valor is string {
  return z.uuid().safeParse(valor).success;
}

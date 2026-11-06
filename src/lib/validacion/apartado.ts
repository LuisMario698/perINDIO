import { z } from "zod";

// Importar rifa.ts también deja configurados los mensajes de zod en español.
import { LIMITES_RIFA } from "./rifa";

export const MAXIMO_NUMEROS_POR_APARTADO = 500;

/** Apartado o venta de uno o varios números, tal como llega del tablero. */
export const esquemaApartado = z
  .object({
    numeros: z
      .array(z.coerce.number().int().min(0))
      .min(1, "Selecciona al menos un número.")
      .max(MAXIMO_NUMEROS_POR_APARTADO, "Máximo 500 números por apartado."),
    // Vacío: comprador nuevo con el nombre y teléfono escritos.
    compradorId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    nombre: z.string().trim().max(120, "Máximo 120 caracteres."),
    telefono: z
      .string()
      .trim()
      .max(30, "Máximo 30 caracteres.")
      .transform((v) => v || null),
    pagoConfirmado: z.boolean(),
    plazoHoras: z.coerce
      .number({ error: "Escribe un número entero." })
      .int("Escribe un número entero.")
      .min(1, "Al menos una hora.")
      .max(LIMITES_RIFA.plazoMaximoHoras, "Máximo 90 días (2,160 horas)."),
    observaciones: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres.")
      .transform((v) => v || null),
  })
  .superRefine((datos, ctx) => {
    if (!datos.compradorId && !datos.nombre) {
      ctx.addIssue({
        code: "custom",
        path: ["nombre"],
        message: "Escribe el nombre del comprador o elige uno existente.",
      });
    }
  });

export type CampoApartado = keyof z.input<typeof esquemaApartado>;

export function leerFormularioApartado(formData: FormData) {
  const texto = (campo: CampoApartado) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };
  return {
    numeros: formData.getAll("numeros").filter((v) => typeof v === "string"),
    compradorId: texto("compradorId"),
    nombre: texto("nombre"),
    telefono: texto("telefono"),
    pagoConfirmado: formData.get("pagoConfirmado") === "on",
    plazoHoras: texto("plazoHoras"),
    observaciones: texto("observaciones"),
  };
}

/** Ids de asignaciones sobre las que se confirma un pago, se libera o se cancela. */
export const esquemaIdsAsignacion = z
  .array(z.uuid())
  .min(1, "Selecciona al menos un apartado.")
  .max(MAXIMO_NUMEROS_POR_APARTADO);

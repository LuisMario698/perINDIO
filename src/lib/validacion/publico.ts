import { z } from "zod";

// Importar rifa.ts deja configurados los mensajes de zod en español.
import "./rifa";

/** Formulario de la página pública para apartar números. */
export const esquemaApartadoPublico = z.object({
  numeros: z
    .array(z.coerce.number().int().min(0))
    .min(1, "Elige al menos un número.")
    .max(100, "Elige menos números."),
  nombre: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo.")
    .max(80, "Máximo 80 caracteres."),
  telefono: z.string().trim().min(8, "Escribe tu número de WhatsApp.").max(25, "Número demasiado largo."),
  // Campo trampa: invisible para las personas; si viene lleno, lo llenó un bot.
  sitio: z.string().max(0).optional(),
});

export type CampoApartadoPublico = keyof z.input<typeof esquemaApartadoPublico>;

export function leerFormularioApartadoPublico(formData: FormData) {
  const texto = (campo: CampoApartadoPublico) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };
  return {
    numeros: formData.getAll("numeros").filter((v) => typeof v === "string"),
    nombre: texto("nombre"),
    telefono: texto("telefono"),
    sitio: texto("sitio"),
  };
}

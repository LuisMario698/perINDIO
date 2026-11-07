import { z } from "zod";

import "./rifa"; // mensajes de zod en español

export const esquemaUsuario = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre.").max(80, "Máximo 80 caracteres."),
  email: z.email("Escribe un correo válido.").trim().toLowerCase(),
  rol: z.enum(["admin", "operador"], { error: "Elige un rol." }),
});

export const esquemaEdicionUsuario = esquemaUsuario.pick({ nombre: true, rol: true });

export const esquemaCambioContrasena = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual."),
    nueva: z.string().min(10, "Al menos 10 caracteres.").max(128, "Máximo 128 caracteres."),
    confirmacion: z.string(),
  })
  .refine((d) => d.nueva === d.confirmacion, {
    path: ["confirmacion"],
    message: "No coincide con la contraseña nueva.",
  })
  .refine((d) => d.nueva !== d.actual, {
    path: ["nueva"],
    message: "Debe ser distinta de la actual.",
  });

/** Primer mensaje de error de cada campo, para mostrarlo junto al campo. */
export function erroresPorCampo(error: z.ZodError) {
  const { fieldErrors } = z.flattenError(error);
  const errores: Record<string, string> = {};
  for (const [campo, mensajes] of Object.entries(fieldErrors)) {
    const primero = (mensajes as string[] | undefined)?.[0];
    if (primero) errores[campo] = primero;
  }
  return errores;
}

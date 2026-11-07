import { z } from "zod";

import { normalizarTelefono } from "../telefono";

import "./rifa"; // mensajes de zod en español

/** Datos públicos del organizador: aparecen en la página de la rifa, el pedido y los PDF. */
export const esquemaPerfil = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre que verán los compradores.")
    .max(80, "Máximo 80 caracteres."),
  // Opcional; si viene, debe poder usarse en un enlace de WhatsApp.
  whatsapp: z
    .string()
    .trim()
    .transform((texto, ctx) => {
      if (!texto) return null;
      const normalizado = normalizarTelefono(texto);
      if (!normalizado) {
        ctx.addIssue({ code: "custom", message: "Escribe un WhatsApp de 10 dígitos (o con lada de país)." });
        return z.NEVER;
      }
      return normalizado;
    }),
  datosPago: z
    .string()
    .trim()
    .max(1000, "Máximo 1,000 caracteres.")
    .transform((v) => v || null),
});

export type DatosPerfil = z.output<typeof esquemaPerfil>;
export type CampoPerfil = keyof z.input<typeof esquemaPerfil>;

export function leerFormularioPerfil(formData: FormData) {
  const texto = (campo: CampoPerfil) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };
  return { nombre: texto("nombre"), whatsapp: texto("whatsapp"), datosPago: texto("datosPago") };
}

export const LOGO_MAXIMO_BYTES = 256 * 1024;

/**
 * Tipo real de la imagen a partir de sus primeros bytes (no del nombre ni del tipo que manda
 * el navegador). Solo PNG, JPEG y WebP; cualquier otra cosa devuelve null.
 */
export function tipoDeImagen(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const empieza = (firma: number[], desde = 0) => firma.every((b, i) => bytes[desde + i] === b);
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (empieza([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Formatea un WhatsApp normalizado para mostrarlo: "525512345678" → "+52 55 1234 5678". */
export function formatearWhatsApp(normalizado: string) {
  const m = /^52(\d{2})(\d{4})(\d{4})$/.exec(normalizado);
  return m ? `+52 ${m[1]} ${m[2]} ${m[3]}` : `+${normalizado}`;
}

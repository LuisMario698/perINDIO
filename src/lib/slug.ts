/** Formato del enlace público de una rifa: minúsculas, dígitos y guiones ("rifa-de-navidad"). */
export const FORMATO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Rifa Pro Fondos 2026" → "rifa-pro-fondos-2026" (sin acentos, máximo 50 caracteres). */
export function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

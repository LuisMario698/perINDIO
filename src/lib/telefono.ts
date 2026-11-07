/**
 * Deja solo dígitos con lada de país, listo para comparar y para enlaces de WhatsApp.
 * "55 1234 5678" → "525512345678". Devuelve null si no parece un teléfono válido.
 */
export function normalizarTelefono(texto: string): string | null {
  let digitos = texto.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  // Número mexicano sin lada de país.
  if (digitos.length === 10) return `52${digitos}`;
  // Formato anterior de celulares mexicanos (52 1 + 10 dígitos).
  if (digitos.length === 13 && digitos.startsWith("521")) return `52${digitos.slice(3)}`;
  if (digitos.length >= 11 && digitos.length <= 15) return digitos;
  return null;
}

/** Enlace que abre WhatsApp con un mensaje ya escrito para ese número. */
export function enlaceWhatsApp(telefonoNormalizado: string, mensaje: string): string {
  return `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensaje)}`;
}

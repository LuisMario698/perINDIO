/**
 * Ruta interna a la que volver después del login. Cualquier otra cosa (una URL externa,
 * "//otro-sitio.com") se descarta para que el login no sirva para redirigir a otro sitio.
 */
export function destinoSeguro(desde: unknown): string {
  if (
    typeof desde !== "string" ||
    !desde.startsWith("/") ||
    desde.startsWith("//") ||
    desde.startsWith("/\\")
  ) {
    return "/";
  }
  return desde;
}

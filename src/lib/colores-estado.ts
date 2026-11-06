/** Estado de un número tal como se ve en pantalla (un apartado vencido se distingue del vigente). */
export type EstadoVisible = "disponible" | "apartado" | "vencido" | "vendido";

/**
 * Color de cada estado para puntos, leyendas y barras. El verde, el ámbar y el rojo se eligieron
 * con un verificador de contraste y de daltonismo; siempre van acompañados de su nombre.
 */
export const COLOR_ESTADO: Record<EstadoVisible, string> = {
  disponible: "border border-border bg-background",
  apartado: "bg-amber-500",
  vencido: "bg-red-500",
  vendido: "bg-emerald-600",
};

export const TIPOS_PDF = ["disponibles", "lista-completa", "apartados", "ventas"] as const;
export type TipoPdf = (typeof TIPOS_PDF)[number];

export const NOMBRE_PDF: Record<TipoPdf, string> = {
  disponibles: "Números disponibles",
  "lista-completa": "Lista completa",
  apartados: "Apartados pendientes de pago",
  ventas: "Ventas confirmadas",
};

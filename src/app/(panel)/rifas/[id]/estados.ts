import { COLOR_ESTADO, type EstadoVisible } from "@/lib/colores-estado";
import type { NumeroOcupado } from "@/server/consultas";

import type { EstadoTablero } from "./acciones";

/** Cómo se ve un número en el tablero. Un apartado vencido se distingue del vigente. */
export type Categoria = EstadoVisible;

export type Filtro = "todos" | Categoria | "pendientes";

export type RifaTablero = {
  id: string;
  numeroInicial: number;
  cantidadNumeros: number;
  digitos: number;
  precioNumero: string;
  plazoApartadoHoras: number;
  estado: "activa" | "cerrada";
};

type Accion = (estado: EstadoTablero, formData: FormData) => Promise<EstadoTablero>;

export type AccionesTablero = {
  apartar: Accion;
  pagar: Accion;
  liberar: Accion;
  cancelar: Accion;
};

export function categoriaDe(ocupado: NumeroOcupado | undefined): Categoria {
  if (!ocupado) return "disponible";
  if (ocupado.estado === "vendido") return "vendido";
  return ocupado.vencido ? "vencido" : "apartado";
}

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  disponible: "Disponible",
  apartado: "Apartado",
  vencido: "Vencido",
  vendido: "Vendido",
};

export const ESTILO_CATEGORIA: Record<Categoria, string> = {
  disponible: "border-border bg-background text-foreground hover:bg-muted",
  apartado: "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200",
  vencido: "border-red-300 bg-red-100 text-red-950 hover:bg-red-200",
  vendido: "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200",
};

/** Punto de color para leyendas y filtros. */
export const PUNTO_CATEGORIA: Record<Categoria, string> = COLOR_ESTADO;

export const FILTROS: { valor: Filtro; nombre: string; categoria?: Categoria }[] = [
  { valor: "todos", nombre: "Todos" },
  { valor: "disponible", nombre: "Disponibles", categoria: "disponible" },
  { valor: "apartado", nombre: "Apartados", categoria: "apartado" },
  { valor: "vencido", nombre: "Vencidos", categoria: "vencido" },
  { valor: "pendientes", nombre: "Pago pendiente" },
  { valor: "vendido", nombre: "Vendidos", categoria: "vendido" },
];

export function cumpleFiltro(filtro: Filtro, categoria: Categoria) {
  if (filtro === "todos") return true;
  if (filtro === "pendientes") return categoria === "apartado" || categoria === "vencido";
  return filtro === categoria;
}

/** Minúsculas y sin acentos, para buscar "jose" y encontrar "José". */
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

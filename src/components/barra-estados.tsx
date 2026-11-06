import { cn } from "cn";

import { COLOR_ESTADO, type EstadoVisible } from "@/lib/colores-estado";
import { formatearEntero } from "@/lib/formato";

const ORDEN: { estado: EstadoVisible; nombre: string }[] = [
  { estado: "vendido", nombre: "vendidos" },
  { estado: "apartado", nombre: "apartados" },
  { estado: "vencido", nombre: "vencidos" },
  { estado: "disponible", nombre: "disponibles" },
];

/**
 * Barra delgada con la proporción de números en cada estado, sin texto: las cifras van al
 * lado (cada una con su punto de color). Cada tramo muestra su cifra al pasar el cursor.
 */
export function BarraEstados({
  conteos,
  className,
}: {
  conteos: Record<EstadoVisible, number>;
  className?: string;
}) {
  const total = ORDEN.reduce((suma, { estado }) => suma + conteos[estado], 0);
  const tramos = ORDEN.filter(({ estado }) => conteos[estado] > 0);
  const descripcion = tramos
    .map(({ estado, nombre }) => `${formatearEntero(conteos[estado])} ${nombre}`)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={`De ${formatearEntero(total)} números: ${descripcion}.`}
      // gap de 2px entre tramos para que no se fundan colores vecinos.
      className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", className)}
    >
      {tramos.map(({ estado, nombre }) => (
        <div
          key={estado}
          title={`${formatearEntero(conteos[estado])} ${nombre}`}
          className={cn("h-full", estado === "disponible" ? "bg-muted" : COLOR_ESTADO[estado])}
          style={{ width: `${(conteos[estado] / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

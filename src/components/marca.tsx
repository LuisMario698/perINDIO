import { cn } from "cn";

/** Nombre de la app con la letra y los colores de la marca (para fondos oscuros). */
export function MarcaApp({ className }: { className?: string }) {
  return (
    <span className={cn("titulo-marca text-2xl", className)}>
      <span className="text-white">per</span>
      <span className="text-marca-oro">INDIO</span>
    </span>
  );
}

import { formatearNumero } from "@/lib/numeros";

/** Error esperado por una regla del negocio; su mensaje se puede mostrar tal cual al usuario. */
export class ErrorDeNegocio extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorDeNegocio";
  }
}

/** Alguno de los números pedidos ya tiene una asignación vigente. No se apartó ninguno. */
export class NumerosNoDisponiblesError extends ErrorDeNegocio {
  readonly numeros: number[];

  constructor(numeros: number[], digitos: number) {
    const etiquetas = numeros.map((n) => formatearNumero(n, digitos)).join(", ");
    super(
      numeros.length === 1
        ? `El número ${etiquetas} ya no está disponible.`
        : `Los números ${etiquetas} ya no están disponibles.`,
    );
    this.name = "NumerosNoDisponiblesError";
    this.numeros = numeros;
  }
}

/** Alguna asignación cambió antes de la operación (se liberó, se canceló o ya se pagó). No se modificó ninguna. */
export class AsignacionesNoVigentesError extends ErrorDeNegocio {
  readonly asignacionIds: string[];

  constructor(asignacionIds: string[], message: string) {
    super(message);
    this.name = "AsignacionesNoVigentesError";
    this.asignacionIds = asignacionIds;
  }
}

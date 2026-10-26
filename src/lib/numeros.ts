/** Muestra un número con ceros a la izquierda: formatearNumero(42, 4) → "0042". */
export function formatearNumero(numero: number, digitos: number): string {
  return String(numero).padStart(digitos, "0");
}

/** Dígitos necesarios para mostrar el número más alto de la rifa: 1999 → 4. */
export function digitosNecesarios(ultimoNumero: number): number {
  return String(ultimoNumero).length;
}

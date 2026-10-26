const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const entero = new Intl.NumberFormat("es-MX");

/** "1500" o 1500 → "$1,500.00" */
export function formatearDinero(monto: string | number): string {
  return dinero.format(Number(monto));
}

/** 2000 → "2,000" */
export function formatearEntero(valor: number): string {
  return entero.format(valor);
}

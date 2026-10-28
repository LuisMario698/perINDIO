const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const entero = new Intl.NumberFormat("es-MX");
// Las fechas sin hora ("2026-12-20") se leen como medianoche UTC; se formatean en UTC para no cambiar de día.
const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" });

/** "1500" o 1500 → "$1,500.00" */
export function formatearDinero(monto: string | number): string {
  return dinero.format(Number(monto));
}

/** 2000 → "2,000" */
export function formatearEntero(valor: number): string {
  return entero.format(valor);
}

/** "2026-12-20" → "20 de diciembre de 2026" */
export function formatearFecha(dia: string): string {
  return fecha.format(new Date(`${dia}T00:00:00Z`));
}

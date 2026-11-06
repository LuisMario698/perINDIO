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

// Fecha y hora en la zona horaria de quien la ve: usarlas solo en componentes de cliente
// que se muestran después de una interacción, para no generar diferencias de hidratación.
const fechaHora = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const relativo = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

/** 2026-11-06T20:30Z → "6 nov 2026, 14:30" (hora local del navegador) */
export function formatearFechaHora(valor: Date | string): string {
  return fechaHora.format(new Date(valor));
}

/** Diferencia con ahora en la unidad más natural: "en 5 horas", "hace 2 días". */
export function tiempoRelativo(valor: Date | string, ahora = Date.now()): string {
  const segundos = Math.round((new Date(valor).getTime() - ahora) / 1000);
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unidad, tamano] of unidades) {
    if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad);
  }
  return relativo.format(segundos, "second");
}

import { jsPDF } from "jspdf";
import { autoTable, type CellInput, type RowInput } from "jspdf-autotable";

import { formatearDinero, formatearEntero, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import { NOMBRE_PDF, type TipoPdf } from "@/lib/pdfs";

import type { NumeroParaPdf } from "./consultas";


export type DatosPdf = {
  rifa: {
    nombre: string;
    digitos: number;
    cantidadNumeros: number;
    precioNumero: string;
    fechaSorteo: string | null;
  };
  /** Todos los números de la rifa, en orden. */
  numeros: NumeroParaPdf[];
  generadoEn: Date;
};

// Carta vertical, en puntos (1/72 de pulgada).
const MARGEN = 40;
const TINTA = 20;
const GRIS = 110;
const LINEA = 200;

/**
 * Genera el PDF pedido con el estado de la rifa en el momento de llamarlo.
 * Usa las fuentes estándar de PDF (Helvetica), que cubren acentos y ñ sin archivos extra.
 */
export function generarPdf(
  tipo: TipoPdf,
  datos: DatosPdf,
  { comprimir = true }: { comprimir?: boolean } = {},
): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: comprimir });
  doc.setProperties({ title: `${NOMBRE_PDF[tipo]} · ${datos.rifa.nombre}`, creator: "perINDIO" });

  if (tipo === "disponibles") dibujarDisponibles(doc, datos);
  if (tipo === "lista-completa") dibujarListaCompleta(doc, datos);
  if (tipo === "apartados") dibujarApartados(doc, datos);
  if (tipo === "ventas") dibujarVentas(doc, datos);

  pieDePagina(doc, datos.generadoEn);
  return doc.output("arraybuffer");
}

/** Título de la rifa y una línea de datos; devuelve la altura en la que puede empezar el contenido. */
function encabezado(doc: jsPDF, datos: DatosPdf, titulo: string, resumen: string): number {
  const { rifa } = datos;
  doc.setTextColor(TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(rifa.nombre, MARGEN, MARGEN + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(titulo, MARGEN, MARGEN + 30);

  const detalles = [
    resumen,
    `${formatearDinero(rifa.precioNumero)} cada número`,
    rifa.fechaSorteo ? `Sorteo: ${formatearFecha(rifa.fechaSorteo)}` : null,
  ].filter(Boolean);
  doc.setFontSize(9);
  doc.setTextColor(GRIS);
  doc.text(detalles.join("  ·  "), MARGEN, MARGEN + 46);
  doc.text(`Actualizado al ${formatearFechaHora(datos.generadoEn)}`, MARGEN, MARGEN + 58);
  doc.setTextColor(TINTA);
  return MARGEN + 74;
}

function pieDePagina(doc: jsPDF, generadoEn: Date) {
  const paginas = doc.getNumberOfPages();
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GRIS);
    doc.text(`perINDIO · ${formatearFechaHora(generadoEn)}`, MARGEN, alto - 20);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - MARGEN, alto - 20, { align: "right" });
  }
}

/**
 * Cuadrícula con solo los números libres, en orden y sin datos de compradores, como las
 * listas impresas tradicionales.
 */
function dibujarDisponibles(doc: jsPDF, datos: DatosPdf) {
  const { rifa } = datos;
  const libres = datos.numeros.filter((n) => n.estado === "disponible");
  const resumen = `${formatearEntero(libres.length)} de ${formatearEntero(rifa.cantidadNumeros)} números disponibles`;

  const ancho = doc.internal.pageSize.getWidth() - MARGEN * 2;
  const alto = doc.internal.pageSize.getHeight();
  // Más columnas cuanto más corto es el número, para aprovechar la hoja.
  const columnas = rifa.digitos <= 2 ? 15 : rifa.digitos === 3 ? 12 : rifa.digitos === 4 ? 10 : 8;
  const anchoCelda = ancho / columnas;
  const altoCelda = 20;

  let y = encabezado(doc, datos, "Números disponibles", resumen);
  if (libres.length === 0) {
    doc.setFontSize(11);
    doc.text("No quedan números disponibles.", MARGEN, y + 12);
    return;
  }

  doc.setDrawColor(LINEA);
  doc.setLineWidth(0.5);
  libres.forEach((n, i) => {
    const columna = i % columnas;
    if (columna === 0 && i > 0) y += altoCelda;
    if (y + altoCelda > alto - MARGEN - 10) {
      doc.addPage();
      y = encabezado(doc, datos, "Números disponibles (continuación)", resumen);
      doc.setDrawColor(LINEA);
      doc.setLineWidth(0.5);
    }
    const x = MARGEN + columna * anchoCelda;
    doc.rect(x, y, anchoCelda, altoCelda);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatearNumero(n.numero, rifa.digitos), x + anchoCelda / 2, y + altoCelda / 2, {
      align: "center",
      baseline: "middle",
    });
  });
}

const ESTILOS_TABLA = {
  theme: "grid" as const,
  styles: {
    font: "helvetica",
    fontSize: 8.5,
    cellPadding: 4,
    textColor: TINTA,
    lineColor: LINEA,
    lineWidth: 0.5,
  },
  headStyles: { fillColor: 240, textColor: TINTA, fontStyle: "bold" as const },
  footStyles: { fillColor: 240, textColor: TINTA, fontStyle: "bold" as const },
  margin: { left: MARGEN, right: MARGEN, bottom: MARGEN + 10 },
};

function tabla(
  doc: jsPDF,
  datos: DatosPdf,
  titulo: string,
  resumen: string,
  head: string[],
  body: RowInput[],
  foot?: RowInput[],
) {
  const inicio = encabezado(doc, datos, titulo, resumen);
  autoTable(doc, {
    ...ESTILOS_TABLA,
    head: [head],
    body,
    foot,
    showFoot: "lastPage",
    startY: inicio,
    // En las páginas siguientes el encabezado de la rifa se repite arriba de la tabla.
    margin: { ...ESTILOS_TABLA.margin, top: inicio },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) encabezado(doc, datos, `${titulo} (continuación)`, resumen);
    },
  });
}

const NOMBRE_ESTADO = { disponible: "Disponible", apartado: "Apartado", vendido: "Vendido" };

/**
 * Todos los números con su estado y comprador, en dos bloques por hoja (izquierda y derecha)
 * para que 2,000 números quepan en 25 hojas. El pago se deduce del estado: vendido es
 * pagado; apartado o vencido, pendiente. Los teléfonos van en el PDF de apartados.
 */
function dibujarListaCompleta(doc: jsPDF, datos: DatosPdf) {
  const { rifa, numeros } = datos;
  const ocupados = numeros.filter((n) => n.estado !== "disponible").length;
  const titulo = "Lista completa";
  const resumen = `${formatearEntero(rifa.cantidadNumeros)} números · ${formatearEntero(ocupados)} ocupados`;
  const FILAS = 40;
  const celdas = (n: NumeroParaPdf | undefined): CellInput[] =>
    n
      ? [
          formatearNumero(n.numero, rifa.digitos),
          n.vencido ? { content: "Vencido", styles: { fontStyle: "bold" } } : NOMBRE_ESTADO[n.estado],
          n.compradorNombre ?? "",
        ]
      : ["", "", ""];

  for (let inicio = 0; inicio < numeros.length; inicio += FILAS * 2) {
    if (inicio > 0) doc.addPage();
    const bloque = numeros.slice(inicio, inicio + FILAS * 2);
    const filas = Math.min(FILAS, Math.ceil(bloque.length / 2));
    const body: RowInput[] = Array.from({ length: filas }, (_, i) => [
      ...celdas(bloque[i]),
      ...celdas(bloque[i + filas]),
    ]);
    autoTable(doc, {
      ...ESTILOS_TABLA,
      styles: { ...ESTILOS_TABLA.styles, fontSize: 8, cellPadding: 3, overflow: "ellipsize" },
      head: [["Número", "Estado", "Comprador", "Número", "Estado", "Comprador"]],
      body,
      startY: encabezado(doc, datos, titulo, resumen),
      columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 54 }, 3: { cellWidth: 44 }, 4: { cellWidth: 54 } },
      rowPageBreak: "avoid",
    });
  }
}

function dibujarApartados(doc: jsPDF, datos: DatosPdf) {
  const { rifa } = datos;
  // Agrupados por comprador para cobrarle todo junto; dentro, por número.
  const pendientes = datos.numeros
    .filter((n) => n.estadoPago === "pendiente")
    .sort(
      (a, b) =>
        (a.compradorNombre ?? "").localeCompare(b.compradorNombre ?? "", "es") || a.numero - b.numero,
    );
  const total = pendientes.reduce((suma, n) => suma + Number(n.monto ?? 0), 0);
  const vencidos = pendientes.filter((n) => n.vencido).length;

  tabla(
    doc,
    datos,
    "Apartados pendientes de pago",
    `${formatearEntero(pendientes.length)} apartados · ${formatearEntero(vencidos)} vencidos`,
    ["Número", "Comprador", "Teléfono", "Apartado", "Vence", "Monto"],
    pendientes.map((n) => [
      formatearNumero(n.numero, rifa.digitos),
      n.compradorNombre ?? "",
      n.compradorTelefono ?? "",
      n.asignadoEn ? formatearFechaHora(n.asignadoEn) : "",
      n.vencido
        ? { content: `VENCIDO · ${formatearFechaHora(n.fechaLimite!)}`, styles: { fontStyle: "bold" } }
        : n.fechaLimite
          ? formatearFechaHora(n.fechaLimite)
          : "",
      { content: formatearDinero(n.monto ?? 0), styles: { halign: "right" } },
    ]),
    [
      [
        { content: "Total por cobrar", colSpan: 5 },
        { content: formatearDinero(total), styles: { halign: "right" } },
      ],
    ],
  );
}

function dibujarVentas(doc: jsPDF, datos: DatosPdf) {
  const { rifa } = datos;
  const ventas = datos.numeros.filter((n) => n.estadoPago === "confirmado");
  const total = ventas.reduce((suma, n) => suma + Number(n.monto ?? 0), 0);

  tabla(
    doc,
    datos,
    "Ventas confirmadas",
    `${formatearEntero(ventas.length)} números pagados`,
    ["Número", "Comprador", "Teléfono", "Pagado", "Monto"],
    ventas.map((n) => [
      formatearNumero(n.numero, rifa.digitos),
      n.compradorNombre ?? "",
      n.compradorTelefono ?? "",
      n.fechaPago ? formatearFechaHora(n.fechaPago) : "",
      { content: formatearDinero(n.monto ?? 0), styles: { halign: "right" } },
    ]),
    [
      [
        { content: "Total cobrado", colSpan: 4 },
        { content: formatearDinero(total), styles: { halign: "right" } },
      ],
    ],
  );
}

import { db } from "@/db";
import { esUuid } from "@/lib/validacion/rifa";
import { listarNumerosParaPdf, obtenerRifa } from "@/server/consultas";
import { TIPOS_PDF, type TipoPdf } from "@/lib/pdfs";
import { generarPdf } from "@/server/pdf";
import { leerSesion } from "@/server/sesion";

// Genera el PDF en cada petición con el estado actual de la rifa (nunca se guarda en disco).
export async function GET(_request: Request, ctx: RouteContext<"/rifas/[id]/pdf/[tipo]">) {
  const sesion = await leerSesion();
  if (!sesion) return new Response("Inicia sesión para descargar el PDF.", { status: 401 });

  const { id, tipo } = await ctx.params;
  if (!esUuid(id) || !TIPOS_PDF.includes(tipo as TipoPdf)) {
    return new Response("No encontrado.", { status: 404 });
  }
  const rifa = await obtenerRifa(db, id, sesion.user.organizadorId);
  if (!rifa) return new Response("No encontrado.", { status: 404 });

  const numeros = await listarNumerosParaPdf(db, rifa.id);
  const pdf = generarPdf(tipo as TipoPdf, { rifa, numeros, generadoEn: new Date() });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      // inline: se abre en el visor del navegador, desde donde se imprime o se guarda.
      "Content-Disposition": `inline; filename="${tipo}-${nombreDeArchivo(rifa.nombre)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/** "Rifa Pro Fondos 2026" → "rifa-pro-fondos-2026" */
function nombreDeArchivo(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "rifa"
  );
}

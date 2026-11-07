import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizadores } from "@/db/schema";
import { esUuid } from "@/lib/validacion/rifa";

// Logo del organizador guardado en la base (público: aparece en la página de cada rifa).
export async function GET(_request: Request, ctx: RouteContext<"/logo/[id]">) {
  const { id } = await ctx.params;
  if (!esUuid(id)) return new Response(null, { status: 404 });
  const [fila] = await db
    .select({ logo: organizadores.logo, tipo: organizadores.logoTipo })
    .from(organizadores)
    .where(eq(organizadores.id, id));
  if (!fila?.logo || !fila.tipo) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(fila.logo), {
    headers: {
      "Content-Type": fila.tipo,
      // La URL lleva ?v=<huella del logo>: al cambiar el logo cambia la URL.
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

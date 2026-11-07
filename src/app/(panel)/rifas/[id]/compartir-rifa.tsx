import Link from "next/link";
import QRCode from "qrcode";

import { BotonCopiar } from "@/components/boton-copiar";

/** Enlace de la página pública con botón para copiarlo y código QR para imprimir o compartir. */
export async function CompartirRifa({
  rifa,
  urlBase,
  esAdmin,
}: {
  rifa: { id: string; slug: string; publica: boolean };
  urlBase: string;
  esAdmin: boolean;
}) {
  if (!rifa.publica) {
    return (
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        La página pública está apagada: los compradores no pueden apartar por su cuenta.
        {esAdmin && (
          <>
            {" "}
            <Link href={`/rifas/${rifa.id}/configuracion`} className="underline">
              Publicarla
            </Link>
          </>
        )}
      </p>
    );
  }

  const url = `${urlBase}/r/${rifa.slug}`;
  // SVG generado aquí mismo a partir del enlace; no viene de ninguna entrada del usuario.
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 180 });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="text-muted-foreground">Página pública:</span>
      <a href={url} target="_blank" rel="noopener" className="font-mono break-all underline">
        {url.replace(/^https?:\/\//, "")}
      </a>
      <BotonCopiar texto={url} etiqueta="Copiar enlace" variante="ghost" />
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-md px-2 py-1 hover:bg-muted [&::-webkit-details-marker]:hidden">
          Código QR
        </summary>
        <div
          className="absolute right-0 z-30 mt-1 rounded-lg border bg-white p-2 shadow-lg"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </details>
    </div>
  );
}

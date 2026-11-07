"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Copia un texto (por ejemplo un enlace) y confirma por un momento. */
export function BotonCopiar({
  texto,
  etiqueta,
  variante = "outline",
}: {
  texto: string;
  etiqueta: string;
  variante?: "outline" | "ghost" | "default";
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant={variante}
      onClick={async () => {
        // Si el texto es una ruta, se copia con el dominio actual.
        const valor = texto.startsWith("/") ? `${window.location.origin}${texto}` : texto;
        await navigator.clipboard.writeText(valor);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </Button>
  );
}

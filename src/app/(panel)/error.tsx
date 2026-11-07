"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

// Errores inesperados (los de negocio se muestran en cada formulario). En producción Next.js
// no manda el detalle al navegador; el identificador sirve para buscarlo en los registros.
export default function ErrorDelPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="titulo-marca text-3xl">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo; si sigue
        pasando, avisa al administrador.
      </p>
      {digest && <p className="font-mono text-xs text-muted-foreground">Referencia: {digest}</p>}
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Reintentar</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ir al resumen
        </Link>
      </div>
    </div>
  );
}

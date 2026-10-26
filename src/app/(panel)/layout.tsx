import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { obtenerUsuarioActual } from "@/server/sesion";

import { cerrarSesion } from "./acciones";

export default function LayoutPanel({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            perINDIO
          </Link>
          <Suspense fallback={null}>
            <MenuUsuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function MenuUsuario() {
  const usuario = await obtenerUsuarioActual();
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="truncate" title={usuario.email}>
        {usuario.nombre}
      </span>
      <Badge variant="secondary">{usuario.rol === "admin" ? "Admin" : "Operador"}</Badge>
      <form action={cerrarSesion}>
        <Button type="submit" variant="ghost" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}

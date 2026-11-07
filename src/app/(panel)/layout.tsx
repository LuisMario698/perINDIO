import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { obtenerUsuarioActual } from "@/server/sesion";

import { cerrarSesion } from "./acciones";
import { Navegacion } from "./navegacion";

export default function LayoutPanel({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="size-6" />
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
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
      <Navegacion esAdmin={usuario.rol === "admin"} />
      <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
      <Link
        href="/cuenta"
        className="truncate underline-offset-4 hover:underline"
        title={`${usuario.email} · Mi cuenta`}
      >
        {usuario.nombre}
      </Link>
      <Badge variant="secondary">{usuario.rol === "admin" ? "Admin" : "Operador"}</Badge>
      <form action={cerrarSesion}>
        <Button type="submit" variant="ghost" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";

import { MarcaApp } from "@/components/marca";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { obtenerUsuarioActual } from "@/server/sesion";

import { cerrarSesion } from "./acciones";
import { Navegacion } from "./navegacion";

export default function LayoutPanel({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Dos filas: marca y usuario arriba; secciones abajo (en celular se desplazan de lado). */}
      <header className="fondo-marca">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/" aria-label="perINDIO, inicio">
              <MarcaApp />
            </Link>
            <Suspense fallback={null}>
              <MenuUsuario />
            </Suspense>
          </div>
          <Suspense fallback={<div className="h-10" />}>
            <Secciones />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function Secciones() {
  const usuario = await obtenerUsuarioActual();
  return <Navegacion esAdmin={usuario.rol === "admin"} />;
}

async function MenuUsuario() {
  const usuario = await obtenerUsuarioActual();
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Link
        href="/cuenta"
        className="truncate text-white underline-offset-4 hover:underline"
        title={`${usuario.email} · Mi cuenta`}
      >
        {usuario.nombre}
      </Link>
      <Badge className="shrink-0 bg-marca-oro text-marca-noche">
        {usuario.rol === "admin" ? "Admin" : "Operador"}
      </Badge>
      <form action={cerrarSesion} className="shrink-0">
        <Button type="submit" variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
          Salir
        </Button>
      </form>
    </div>
  );
}

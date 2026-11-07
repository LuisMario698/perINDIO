import { Suspense } from "react";

import { db } from "@/db";
import { obtenerAdminActual } from "@/server/sesion";
import { listarUsuarios } from "@/server/usuarios";

import { AdministrarUsuarios } from "./administrar-usuarios";

export const metadata = { title: "Usuarios · perINDIO" };

export default function PaginaUsuarios() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Los <strong>operadores</strong> apartan, venden, confirman pagos y liberan; no configuran
          rifas ni cancelan ventas ya pagadas. Los <strong>administradores</strong> pueden todo.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const admin = await obtenerAdminActual();
  const usuarios = await listarUsuarios(db, admin.organizadorId);
  return <AdministrarUsuarios usuarios={usuarios} yoId={admin.id} />;
}

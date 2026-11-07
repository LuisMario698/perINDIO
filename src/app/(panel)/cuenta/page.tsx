import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { obtenerUsuarioActual } from "@/server/sesion";

import { CambiarContrasena } from "./cambiar-contrasena";

export const metadata = { title: "Mi cuenta · perINDIO" };

export default function PaginaCuenta() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="titulo-marca text-3xl">Mi cuenta</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Datos />
      </Suspense>
      <Card>
        <CardContent>
          <CambiarContrasena />
        </CardContent>
      </Card>
    </div>
  );
}

async function Datos() {
  const usuario = await obtenerUsuarioActual();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Nombre</dt>
      <dd>{usuario.nombre}</dd>
      <dt className="text-muted-foreground">Correo</dt>
      <dd className="break-all">{usuario.email}</dd>
      <dt className="text-muted-foreground">Rol</dt>
      <dd>{usuario.rol === "admin" ? "Administrador" : "Operador"}</dd>
    </dl>
  );
}

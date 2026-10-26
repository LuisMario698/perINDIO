import { connection } from "next/server";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkDatabase } from "@/db/health";

// Página temporal de la fase 1: confirma que la app llega a Postgres.
// En la fase 3 la reemplaza el login y el panel.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">perINDIO</h1>
        <p className="text-muted-foreground">Administración y control de rifas</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Base de datos</CardTitle>
          <CardDescription>Estado de la conexión con Postgres</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Verificando conexión…</p>}
          >
            <DbStatus />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function DbStatus() {
  // Consultar en cada petición, nunca durante el build.
  await connection();
  const health = await checkDatabase();

  if (!health.ok) {
    return (
      <div className="space-y-2">
        <Badge variant="destructive">Sin conexión</Badge>
        {process.env.NODE_ENV !== "production" && (
          <p className="font-mono text-xs break-all text-muted-foreground">{health.error}</p>
        )}
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Estado</dt>
      <dd>
        <Badge>Conectada</Badge>
      </dd>
      <dt className="text-muted-foreground">Postgres</dt>
      <dd className="font-mono">{health.version}</dd>
      <dt className="text-muted-foreground">Hora del servidor</dt>
      <dd className="font-mono">{health.serverTime}</dd>
    </dl>
  );
}

import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { destinoSeguro } from "@/lib/rutas";
import { leerSesion } from "@/server/sesion";

import { FormularioLogin } from "./formulario-login";

export const metadata = { title: "Entrar · perINDIO" };

export default function PaginaLogin({ searchParams }: PageProps<"/login">) {
  return (
    <main className="fondo-marca flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="titulo-marca text-4xl">
            per<span className="text-marca-rojo">INDIO</span>
          </CardTitle>
          <CardDescription>
            Administración de rifas. Entra con la cuenta que te dio el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-48" />}>
            <Login searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Con una sesión válida no tiene caso mostrar el formulario.
  if (await leerSesion()) redirect("/");

  const { desde } = await searchParams;
  return <FormularioLogin destino={destinoSeguro(desde)} />;
}

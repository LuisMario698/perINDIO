import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { obtenerPerfil } from "@/server/organizador";
import { obtenerAdminActual } from "@/server/sesion";

import { FormularioLogo, FormularioPerfil } from "./formularios";

export const metadata = { title: "Organizador · perINDIO" };

export default function PaginaOrganizador() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="titulo-marca text-3xl">Perfil del organizador</h1>
        <p className="text-sm text-muted-foreground">
          Lo ven los compradores en la página de cada rifa, en su pedido, en los mensajes de
          WhatsApp y en los PDF.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const usuario = await obtenerAdminActual();
  const perfil = await obtenerPerfil(db, usuario.organizadorId);

  return (
    <>
      <Card>
        <CardContent>
          <FormularioPerfil
            inicial={{
              nombre: perfil.nombre,
              whatsapp: perfil.whatsapp ?? "",
              datosPago: perfil.datosPago ?? "",
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <FormularioLogo
            logo={perfil.logoVersion ? `/logo/${perfil.id}?v=${perfil.logoVersion}` : null}
          />
        </CardContent>
      </Card>
    </>
  );
}

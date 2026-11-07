import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EncabezadoPublico, PiePublico } from "@/components/encabezado-publico";
import { db } from "@/db";
import { formatearDinero, formatearEntero, formatearFecha } from "@/lib/formato";
import { formatearNumero } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/telefono";
import { obtenerRifaPublica, type RifaPublica } from "@/server/publico";

import { apartarPublicoAccion } from "./acciones";
import { SeleccionPublica } from "./seleccion-publica";

export default function PaginaRifaPublica({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Cargando la rifa…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]">) {
  await connection();
  const { slug } = await params;
  const rifa = await obtenerRifaPublica(db, slug);
  return { title: rifa ? `${rifa.rifa.nombre} · ${rifa.organizador.nombre}` : "Rifa no encontrada" };
}

async function Contenido({ params }: Pick<PageProps<"/r/[slug]">, "params">) {
  await connection();
  const { slug } = await params;
  const datos = await obtenerRifaPublica(db, slug);
  if (!datos) notFound();
  const { rifa, organizador } = datos;
  const disponibles = rifa.cantidadNumeros - datos.ocupados.length;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EncabezadoPublico organizador={organizador} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{rifa.nombre}</h1>
          <p className="text-lg">
            <strong>{formatearDinero(rifa.precioNumero)}</strong> por número
            {rifa.fechaSorteo && (
              <span className="text-muted-foreground">
                {" "}
                · Sorteo: {formatearFecha(rifa.fechaSorteo)}
              </span>
            )}
          </p>
          {rifa.descripcion && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{rifa.descripcion}</p>
          )}
        </section>

        {datos.premios.length > 0 && <Premios datos={datos} />}

        {rifa.estado === "activa" ? (
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Elige tus números</h2>
              <p className="text-sm text-muted-foreground">
                {formatearEntero(disponibles)} disponibles de {formatearEntero(rifa.cantidadNumeros)}.
                Al apartar tienes {rifa.plazoPublicoHoras} horas para pagar; si no, los números se
                liberan.
              </p>
            </div>
            <SeleccionPublica
              rifa={{
                numeroInicial: rifa.numeroInicial,
                cantidadNumeros: rifa.cantidadNumeros,
                digitos: rifa.digitos,
                precioNumero: rifa.precioNumero,
                maxNumeros: rifa.maxNumerosPublico,
                plazoHoras: rifa.plazoPublicoHoras,
              }}
              ocupados={datos.ocupados}
              accion={apartarPublicoAccion.bind(null, rifa.slug)}
            />
          </section>
        ) : rifa.estado === "cerrada" ? (
          <p className="rounded-xl border bg-muted/50 p-4 text-sm">
            Las ventas de esta rifa ya cerraron. Si apartaste números, revisa el enlace de tu pedido.
          </p>
        ) : null}

        {organizador.whatsapp && (
          <p className="text-sm text-muted-foreground">
            ¿Dudas?{" "}
            <a
              href={enlaceWhatsApp(organizador.whatsapp, `Hola, tengo una duda sobre la ${rifa.nombre}.`)}
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener"
            >
              Escríbele al organizador por WhatsApp
            </a>
            .
          </p>
        )}
      </main>
      <PiePublico />
    </div>
  );
}

function Premios({ datos }: { datos: RifaPublica }) {
  const sorteada = datos.rifa.estado === "sorteada";
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{sorteada ? "Resultados del sorteo" : "Premios"}</h2>
      <ol className="divide-y rounded-xl border">
        {datos.premios.map((premio) => (
          <li key={premio.lugar} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
            <span>
              <span className="font-semibold">{premio.lugar}.º</span> {premio.descripcion}
            </span>
            {sorteada && premio.numeroGanador !== null && (
              <span className="text-sm">
                Número ganador{" "}
                <strong className="font-mono">
                  {formatearNumero(premio.numeroGanador, datos.rifa.digitos)}
                </strong>
                {premio.ganador ? ` · ${premio.ganador}` : " · sin comprador"}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

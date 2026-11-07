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
  const sorteada = rifa.estado === "sorteada";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EncabezadoPublico organizador={organizador} />

      {/* Portada, como los anuncios: nombre, precio del boleto, fecha y premios. */}
      <section className="fondo-marca border-t border-white/10">
        <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pt-6 pb-8">
          <h1 className="titulo-marca text-4xl text-white sm:text-5xl">{rifa.nombre}</h1>
          <div className="flex flex-wrap items-stretch gap-3">
            <div className="rounded-xl bg-marca-oro px-4 py-2 text-marca-noche">
              <p className="text-xs font-semibold tracking-wide uppercase">Boleto</p>
              <p className="titulo-marca text-3xl">{formatearDinero(rifa.precioNumero)}</p>
            </div>
            {rifa.fechaSorteo && (
              <div className="rounded-xl bg-marca-rojo px-4 py-2 text-white">
                <p className="text-xs font-semibold tracking-wide uppercase">
                  {sorteada ? "Se jugó el" : "Se juega el"}
                </p>
                <p className="titulo-marca text-2xl">{formatearFecha(rifa.fechaSorteo)}</p>
              </div>
            )}
          </div>
          {rifa.descripcion && (
            <p className="max-w-2xl whitespace-pre-line text-white/80">{rifa.descripcion}</p>
          )}
          {datos.premios.length > 0 && <Premios datos={datos} />}
          {rifa.estado === "activa" && (
            <Avance disponibles={disponibles} total={rifa.cantidadNumeros} />
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        {rifa.estado === "activa" ? (
          <>
            <ComoParticipar horas={rifa.plazoPublicoHoras} maximo={rifa.maxNumerosPublico} />
            <section className="space-y-3" aria-labelledby="elige">
              <h2 id="elige" className="titulo-marca text-2xl">
                Elige tus números
              </h2>
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
          </>
        ) : rifa.estado === "cerrada" ? (
          <p className="rounded-xl border-2 border-marca-oro bg-amber-50 p-5 text-amber-950">
            <strong className="block text-lg">Las ventas ya cerraron.</strong>
            Pronto se juega el sorteo. Si apartaste números, revisa el enlace de tu pedido.
          </p>
        ) : null}

        {organizador.whatsapp && (
          <a
            href={enlaceWhatsApp(organizador.whatsapp, `Hola, tengo una duda sobre la ${rifa.nombre}.`)}
            className="flex items-center justify-between gap-3 rounded-xl border p-4 hover:bg-muted"
            target="_blank"
            rel="noopener"
          >
            <span>
              <strong className="block">¿Tienes dudas?</strong>
              <span className="text-sm text-muted-foreground">Escríbele al organizador por WhatsApp.</span>
            </span>
            <span aria-hidden className="text-2xl text-primary">→</span>
          </a>
        )}
      </main>
      <PiePublico />
    </div>
  );
}

function Avance({ disponibles, total }: { disponibles: number; total: number }) {
  const vendidos = total - disponibles;
  return (
    <div className="max-w-md space-y-1.5">
      <div className="flex justify-between text-sm text-white/80">
        <span>
          <strong className="text-white">{formatearEntero(disponibles)}</strong> números libres de{" "}
          {formatearEntero(total)}
        </span>
        <span>{Math.round((vendidos / total) * 100)}% ocupado</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="h-full rounded-full bg-marca-oro" style={{ width: `${(vendidos / total) * 100}%` }} />
      </div>
    </div>
  );
}

function ComoParticipar({ horas, maximo }: { horas: number; maximo: number }) {
  const pasos = [
    { titulo: "Elige tus números", texto: `Toca los números libres que quieras (hasta ${maximo}).` },
    { titulo: "Apártalos", texto: "Escribe tu nombre y tu WhatsApp. Te damos un folio." },
    {
      titulo: "Paga y manda tu comprobante",
      texto: `Tienes ${horas} horas. Envía tu comprobante por WhatsApp con un botón.`,
    },
  ];
  return (
    <section aria-labelledby="como" className="space-y-3">
      <h2 id="como" className="titulo-marca text-2xl">
        ¿Cómo participar?
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {pasos.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-3 rounded-xl border p-4">
            <span
              aria-hidden
              className="titulo-marca flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-noche text-lg text-marca-oro"
            >
              {i + 1}
            </span>
            <span>
              <strong className="block">{paso.titulo}</strong>
              <span className="text-sm text-muted-foreground">{paso.texto}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Premios({ datos }: { datos: RifaPublica }) {
  const sorteada = datos.rifa.estado === "sorteada";
  return (
    <section className="space-y-2" aria-labelledby="premios">
      <h2 id="premios" className="titulo-marca text-xl text-marca-oro">
        {sorteada ? "Resultados del sorteo" : "Premios"}
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {datos.premios.map((premio) => (
          <li
            key={premio.lugar}
            className="rounded-xl border border-white/15 bg-white/5 p-3"
          >
            <p className="titulo-marca text-sm text-marca-oro">{premio.lugar}.º lugar</p>
            <p className="font-medium text-white">{premio.descripcion}</p>
            {sorteada && premio.numeroGanador !== null && (
              <p className="mt-2 flex items-baseline gap-2 border-t border-white/10 pt-2 text-sm text-white/80">
                Ganó el
                <strong className="titulo-marca text-2xl text-white">
                  {formatearNumero(premio.numeroGanador, datos.rifa.digitos)}
                </strong>
                {premio.ganador ? `· ${premio.ganador}` : "· sin comprador"}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

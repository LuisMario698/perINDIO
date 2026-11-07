import { Logo } from "@/components/logo";

/** Encabezado de las páginas públicas: logo y nombre del organizador en la banda de la marca. */
export function EncabezadoPublico({
  organizador,
}: {
  organizador: { id: string; nombre: string; logoVersion: string | null };
}) {
  return (
    <header className="fondo-marca">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-3 px-4 py-2">
        {organizador.logoVersion ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base
          <img
            src={`/logo/${organizador.id}?v=${organizador.logoVersion}`}
            alt=""
            className="size-12 shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-marca-oro"
          />
        ) : (
          <Logo className="size-10 shrink-0" />
        )}
        <span className="titulo-marca text-xl text-marca-oro sm:text-2xl">{organizador.nombre}</span>
      </div>
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className="mt-auto bg-marca-noche">
      <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-white/60">
        Rifa administrada con perINDIO.
      </p>
    </footer>
  );
}

import { Logo } from "@/components/logo";

/** Encabezado de las páginas públicas: logo y nombre del organizador. */
export function EncabezadoPublico({
  organizador,
}: {
  organizador: { id: string; nombre: string; tieneLogo: boolean };
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
        {organizador.tieneLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base
          <img
            src={`/logo/${organizador.id}`}
            alt=""
            className="size-8 rounded-md object-contain"
          />
        ) : (
          <Logo className="size-7" />
        )}
        <span className="font-semibold tracking-tight">{organizador.nombre}</span>
      </div>
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className="mt-auto border-t">
      <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground">
        Rifa administrada con perINDIO.
      </p>
    </footer>
  );
}

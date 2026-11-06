import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function NoEncontrado() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-4xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold tracking-tight">No encontramos esa página</h1>
      <p className="text-sm text-muted-foreground">
        Puede que la rifa se haya eliminado o que el enlace esté incompleto.
      </p>
      <Link href="/" className={buttonVariants()}>
        Ir al resumen
      </Link>
    </div>
  );
}

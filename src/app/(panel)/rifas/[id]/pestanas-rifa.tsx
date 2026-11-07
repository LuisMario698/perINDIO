"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pestañas de una rifa. Las de administración solo las ve el admin. */
export function PestanasRifa({ rifaId, esAdmin }: { rifaId: string; esAdmin: boolean }) {
  const ruta = usePathname();
  const base = `/rifas/${rifaId}`;
  const pestanas = [
    { href: base, nombre: "Números" },
    { href: `${base}/pedidos`, nombre: "Pedidos" },
    { href: `${base}/vendedores`, nombre: "Vendedores" },
    { href: `${base}/historial`, nombre: "Historial" },
    ...(esAdmin
      ? [
          { href: `${base}/sorteo`, nombre: "Sorteo" },
          { href: `${base}/configuracion`, nombre: "Configurar" },
        ]
      : []),
  ];
  return (
    <nav aria-label="Secciones de la rifa" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {pestanas.map((p) => {
          const activa = p.href === base ? ruta === base : ruta.startsWith(p.href);
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm transition-colors",
                  activa
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

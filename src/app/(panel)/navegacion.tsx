"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Secciones principales del panel. Las de administración solo las ve el admin. */
export function Navegacion({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const secciones = [
    { href: "/", nombre: "Rifas", activa: ruta === "/" || ruta.startsWith("/rifas") },
    { href: "/vendedores", nombre: "Vendedores", activa: ruta.startsWith("/vendedores") },
    ...(esAdmin
      ? [
          { href: "/usuarios", nombre: "Usuarios", activa: ruta.startsWith("/usuarios") },
          { href: "/configuracion", nombre: "Organizador", activa: ruta.startsWith("/configuracion") },
        ]
      : []),
  ];
  return (
    <nav aria-label="Secciones del panel" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
      {secciones.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.activa ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
            s.activa ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          {s.nombre}
        </Link>
      ))}
    </nav>
  );
}

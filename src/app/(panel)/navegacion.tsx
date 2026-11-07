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
    <nav aria-label="Secciones del panel" className="flex items-center gap-1">
      {secciones.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.activa ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-sm transition-colors",
            s.activa ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s.nombre}
        </Link>
      ))}
    </nav>
  );
}

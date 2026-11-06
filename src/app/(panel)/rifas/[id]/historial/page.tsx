import { cn } from "cn";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { formatearFechaHora } from "@/lib/formato";
import { describirMovimiento, NOMBRE_MOVIMIENTO, TIPOS_MOVIMIENTO } from "@/lib/movimientos";
import { formatearNumero } from "@/lib/numeros";
import { esUuid } from "@/lib/validacion/rifa";
import { listarMovimientos, obtenerRifa, type TipoMovimiento } from "@/server/consultas";
import { obtenerUsuarioActual } from "@/server/sesion";

export const metadata = { title: "Historial · perINDIO" };

const POR_PAGINA = 100;

const PUNTO: Record<TipoMovimiento, string> = {
  apartado: "bg-amber-500",
  venta: "bg-emerald-600",
  pago_confirmado: "bg-emerald-600",
  cancelacion: "bg-zinc-400",
  liberacion_manual: "bg-red-500",
  liberacion_automatica: "bg-red-500",
};

// Los filtros vienen de la URL: lo que no se entienda se ignora en vez de fallar.
const primero = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const esquemaFiltros = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO).optional().catch(undefined),
  numero: z.coerce.number().int().min(0).optional().catch(undefined),
  antes: z.coerce.number().int().min(1).optional().catch(undefined),
});

export default function PaginaHistorial({
  params,
  searchParams,
}: PageProps<"/rifas/[id]/historial">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando historial…</p>}>
      <Historial params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Historial({ params, searchParams }: PageProps<"/rifas/[id]/historial">) {
  const usuario = await obtenerUsuarioActual();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const rifa = await obtenerRifa(db, id, usuario.organizadorId);
  if (!rifa) notFound();

  const crudos = await searchParams;
  const filtros = esquemaFiltros.parse({
    tipo: primero(crudos.tipo) || undefined,
    numero: primero(crudos.numero) || undefined,
    antes: primero(crudos.antes) || undefined,
  });
  const { movimientos, siguiente } = await listarMovimientos(db, rifa.id, {
    tipo: filtros.tipo,
    numero: filtros.numero,
    antesDe: filtros.antes,
    limite: POR_PAGINA,
  });

  const base = `/rifas/${rifa.id}/historial`;
  const conFiltros = (extra: Record<string, string | number>) => {
    const query = new URLSearchParams();
    if (filtros.tipo) query.set("tipo", filtros.tipo);
    if (filtros.numero !== undefined) query.set("numero", String(filtros.numero));
    for (const [clave, valor] of Object.entries(extra)) query.set(clave, String(valor));
    const texto = query.toString();
    return texto ? `${base}?${texto}` : base;
  };
  const filtrando = filtros.tipo !== undefined || filtros.numero !== undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/rifas/${rifa.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Números
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">
          {rifa.nombre} · apartados, ventas, pagos, cancelaciones y liberaciones, con quién los hizo.
        </p>
      </div>

      <Form action={base} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Movimiento</span>
          <select
            name="tipo"
            defaultValue={filtros.tipo ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="">Todos</option>
            {TIPOS_MOVIMIENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {NOMBRE_MOVIMIENTO[tipo]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Número</span>
          <Input
            name="numero"
            inputMode="numeric"
            defaultValue={
              filtros.numero !== undefined ? formatearNumero(filtros.numero, rifa.digitos) : ""
            }
            placeholder={formatearNumero(42, rifa.digitos)}
            className="w-28"
          />
        </label>
        <Button type="submit">Filtrar</Button>
        {filtrando && (
          <Link href={base} className={buttonVariants({ variant: "ghost" })}>
            Quitar filtros
          </Link>
        )}
      </Form>

      {movimientos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filtrando ? "Ningún movimiento coincide con el filtro." : "Todavía no hay movimientos."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Número</th>
                <th className="px-3 py-2 font-medium">Movimiento</th>
                <th className="px-3 py-2 font-medium">Comprador</th>
                <th className="px-3 py-2 font-medium">Detalle</th>
                <th className="px-3 py-2 font-medium">Hecho por</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movimientos.map((m) => (
                <tr key={m.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatearFechaHora(m.creadoEn)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    <Link
                      href={conFiltros({ numero: m.numero })}
                      className="hover:underline"
                      title="Ver solo este número"
                    >
                      {formatearNumero(m.numero, rifa.digitos)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", PUNTO[m.tipo])} />
                      {NOMBRE_MOVIMIENTO[m.tipo]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{m.comprador}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {describirMovimiento(m.tipo, m.detalle)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.usuario ?? "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between gap-2">
        {filtros.antes ? (
          <Link href={conFiltros({})} className={buttonVariants({ variant: "ghost" })}>
            ← Más recientes
          </Link>
        ) : (
          <span />
        )}
        {siguiente && (
          <Link href={conFiltros({ antes: siguiente })} className={buttonVariants({ variant: "outline" })}>
            Más antiguos →
          </Link>
        )}
      </div>
    </div>
  );
}

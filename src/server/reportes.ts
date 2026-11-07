import { sql } from "drizzle-orm";

import type { Db } from "@/db/client";

export type FilaVendedor = {
  /** null: pedidos hechos por los compradores en la página pública. */
  vendedorId: string | null;
  vendedor: string;
  activo: boolean;
  pedidos: number;
  /** Números que siguen a nombre de un comprador (apartados o vendidos). */
  numerosVigentes: number;
  numerosPagados: number;
  /** Apartados que se liberaron o cancelaron sin concretarse. */
  numerosCaidos: number;
  cobrado: number;
  porCobrar: number;
};

export type FilaCobros = {
  usuarioId: string;
  usuario: string;
  pagos: number;
  monto: number;
};

export type ReporteVendedores = {
  vendedores: FilaVendedor[];
  cobros: FilaCobros[];
};

/**
 * Ventas por vendedor (quien levantó cada pedido) y cobros por usuario (quien registró cada
 * pago o venta), de una rifa o de todas las del organizador. Cobrado y por cobrar reflejan el
 * estado actual; los cobros registrados son históricos (cuentan aunque después se cancelara).
 */
export async function reporteVendedores(
  db: Db,
  organizadorId: string,
  rifaId?: string,
): Promise<ReporteVendedores> {
  const filtroRifa = rifaId ? sql`and r.id = ${rifaId}` : sql``;

  const vendedores = await db.execute<{
    vendedor_id: string | null;
    vendedor: string | null;
    banned: boolean | null;
    pedidos: string;
    vigentes: string;
    pagados: string;
    caidos: string;
    cobrado: string;
    por_cobrar: string;
  }>(sql`
    select
      p.vendedor_id,
      u.name as vendedor,
      u.banned,
      count(distinct p.id) as pedidos,
      count(*) filter (where a.estado in ('apartado', 'vendido')) as vigentes,
      count(*) filter (where a.estado in ('apartado', 'vendido') and a.estado_pago = 'confirmado') as pagados,
      count(*) filter (where a.estado in ('liberado', 'cancelado')) as caidos,
      coalesce(sum(a.monto) filter (where a.estado in ('apartado', 'vendido') and a.estado_pago = 'confirmado'), 0) as cobrado,
      coalesce(sum(a.monto) filter (where a.estado = 'apartado' and a.estado_pago = 'pendiente'), 0) as por_cobrar
    from pedidos p
    join rifas r on r.id = p.rifa_id
    join asignaciones a on a.pedido_id = p.id
    left join usuarios u on u.id = p.vendedor_id
    where r.organizador_id = ${organizadorId} ${filtroRifa}
    group by p.vendedor_id, u.name, u.banned
    order by cobrado desc, vigentes desc
  `);

  const cobros = await db.execute<{ usuario_id: string; usuario: string; pagos: string; monto: string }>(sql`
    select m.usuario_id, u.name as usuario, count(*) as pagos, coalesce(sum(a.monto), 0) as monto
    from movimientos m
    join rifas r on r.id = m.rifa_id
    join asignaciones a on a.id = m.asignacion_id
    join usuarios u on u.id = m.usuario_id
    where m.tipo in ('venta', 'pago_confirmado') and r.organizador_id = ${organizadorId} ${filtroRifa}
    group by m.usuario_id, u.name
    order by monto desc
  `);

  return {
    vendedores: vendedores.map((f) => ({
      vendedorId: f.vendedor_id,
      vendedor: f.vendedor_id ? (f.vendedor ?? "Usuario eliminado") : "Página pública",
      activo: f.vendedor_id ? !f.banned : true,
      pedidos: Number(f.pedidos),
      numerosVigentes: Number(f.vigentes),
      numerosPagados: Number(f.pagados),
      numerosCaidos: Number(f.caidos),
      cobrado: Number(f.cobrado),
      porCobrar: Number(f.por_cobrar),
    })),
    cobros: cobros.map((f) => ({
      usuarioId: f.usuario_id,
      usuario: f.usuario,
      pagos: Number(f.pagos),
      monto: Number(f.monto),
    })),
  };
}

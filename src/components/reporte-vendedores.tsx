import { cn } from "cn";

import { formatearDinero, formatearEntero } from "@/lib/formato";
import type { ReporteVendedores } from "@/server/reportes";

/** Tablas de ventas por vendedor y cobros registrados por usuario. */
export function TablasVendedores({ reporte }: { reporte: ReporteVendedores }) {
  const { vendedores, cobros } = reporte;
  if (vendedores.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay pedidos.
      </p>
    );
  }
  const total = vendedores.reduce(
    (t, v) => ({
      pedidos: t.pedidos + v.pedidos,
      numerosVigentes: t.numerosVigentes + v.numerosVigentes,
      numerosPagados: t.numerosPagados + v.numerosPagados,
      numerosCaidos: t.numerosCaidos + v.numerosCaidos,
      cobrado: t.cobrado + v.cobrado,
      porCobrar: t.porCobrar + v.porCobrar,
    }),
    { pedidos: 0, numerosVigentes: 0, numerosPagados: 0, numerosCaidos: 0, cobrado: 0, porCobrar: 0 },
  );
  const num = "px-3 py-2 text-right tabular-nums";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="font-semibold">Ventas por vendedor</h2>
        <p className="text-sm text-muted-foreground">
          Quién levantó cada pedido. Los de la página pública los hizo el propio comprador.
        </p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Vendedor</th>
                <th scope="col" className={cn(num, "font-medium")}>Pedidos</th>
                <th scope="col" className={cn(num, "font-medium")}>Números</th>
                <th scope="col" className={cn(num, "font-medium")}>Pagados</th>
                <th scope="col" className={cn(num, "font-medium")} title="Apartados que se liberaron o cancelaron">
                  No concretados
                </th>
                <th scope="col" className={cn(num, "font-medium")}>Cobrado</th>
                <th scope="col" className={cn(num, "font-medium")}>Por cobrar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendedores.map((v) => (
                <tr key={v.vendedorId ?? "publico"}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className={cn(!v.vendedorId && "italic")}>{v.vendedor}</span>
                    {!v.activo && <span className="ml-2 text-xs text-muted-foreground">(desactivado)</span>}
                  </th>
                  <td className={num}>{formatearEntero(v.pedidos)}</td>
                  <td className={num}>{formatearEntero(v.numerosVigentes)}</td>
                  <td className={num}>{formatearEntero(v.numerosPagados)}</td>
                  <td className={cn(num, "text-muted-foreground")}>{formatearEntero(v.numerosCaidos)}</td>
                  <td className={cn(num, "font-medium")}>{formatearDinero(v.cobrado)}</td>
                  <td className={num}>{formatearDinero(v.porCobrar)}</td>
                </tr>
              ))}
            </tbody>
            {vendedores.length > 1 && (
              <tfoot className="border-t-2 font-medium">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left">Total</th>
                  <td className={num}>{formatearEntero(total.pedidos)}</td>
                  <td className={num}>{formatearEntero(total.numerosVigentes)}</td>
                  <td className={num}>{formatearEntero(total.numerosPagados)}</td>
                  <td className={num}>{formatearEntero(total.numerosCaidos)}</td>
                  <td className={num}>{formatearDinero(total.cobrado)}</td>
                  <td className={num}>{formatearDinero(total.porCobrar)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Cobros registrados por usuario</h2>
        <p className="text-sm text-muted-foreground">
          Quién confirmó cada pago (o vendió ya pagado), incluidos los pedidos de la página pública.
          Sirve para cuadrar el dinero que recibió cada quien.
        </p>
        {cobros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie ha registrado cobros todavía.</p>
        ) : (
          <table className="w-full max-w-md text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Usuario</th>
                <th scope="col" className={cn(num, "font-medium")}>Números</th>
                <th scope="col" className={cn(num, "font-medium")}>Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cobros.map((c) => (
                <tr key={c.usuarioId}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">{c.usuario}</th>
                  <td className={num}>{formatearEntero(c.pagos)}</td>
                  <td className={cn(num, "font-medium")}>{formatearDinero(c.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

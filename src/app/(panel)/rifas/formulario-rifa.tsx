"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearEntero } from "@/lib/formato";
import { digitosNecesarios, formatearNumero } from "@/lib/numeros";
import type { CampoRifa } from "@/lib/validacion/rifa";

import type { EstadoFormularioRifa } from "./acciones";

/** Valores de los campos tal como se escriben en el formulario. */
export type ValoresRifa = {
  nombre: string;
  descripcion: string;
  numeroInicial: string;
  cantidadNumeros: string;
  digitos: string;
  precioNumero: string;
  plazoApartadoHoras: string;
  liberacionAutomatica: boolean;
  fechaSorteo: string;
  estado: "activa" | "cerrada";
};

const VALORES_NUEVA_RIFA: ValoresRifa = {
  nombre: "",
  descripcion: "",
  numeroInicial: "0",
  cantidadNumeros: "1000",
  digitos: "3",
  precioNumero: "",
  plazoApartadoHoras: "48",
  liberacionAutomatica: false,
  fechaSorteo: "",
  estado: "activa",
};

type Props = {
  modo: "crear" | "editar";
  accion: (estado: EstadoFormularioRifa, formData: FormData) => Promise<EstadoFormularioRifa>;
  inicial?: ValoresRifa;
  /** La rifa ya tiene asignaciones: el rango y los dígitos se muestran pero no se pueden cambiar. */
  rangoBloqueado?: boolean;
};

const CLASES_SELECT =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function FormularioRifa({ modo, accion, inicial = VALORES_NUEVA_RIFA, rangoBloqueado = false }: Props) {
  // Ids únicos: Next.js deja montada (oculta) la página anterior, así que puede haber dos
  // formularios de rifa en el documento a la vez.
  const prefijo = useId();
  const idDe = (campo: CampoRifa) => `${prefijo}-${campo}`;

  // true mientras se envía; si la acción redirige (rifa creada), se queda en true.
  const enviado = useRef(false);
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoFormularioRifa, entrada: FormData | null) => {
      if (entrada === null) return {}; // reinicio de avisos
      enviado.current = true;
      const resultado = await accion(previo, entrada);
      enviado.current = false;
      return resultado;
    },
    {},
  );
  const [valores, setValores] = useState(inicial);
  // Mientras nadie toque los dígitos, se ajustan solos al número más alto.
  const [digitosManual, setDigitosManual] = useState(
    () => Number(inicial.digitos) !== digitosAutomaticos(inicial),
  );

  // Al navegar, Next.js oculta esta página con <Activity> en lugar de desmontarla. Al ocultarse
  // se borran los avisos, y si la rifa se acaba de crear también los campos, para que la
  // siguiente "Nueva rifa" empiece en blanco. Un borrador sin enviar se conserva.
  useLayoutEffect(() => {
    return () => {
      startTransition(() => enviar(null));
      if (modo === "crear" && enviado.current) {
        enviado.current = false;
        setValores(VALORES_NUEVA_RIFA);
        setDigitosManual(false);
      }
    };
  }, [enviar, modo]);

  function cambiar<K extends keyof ValoresRifa>(campo: K, valor: ValoresRifa[K]) {
    setValores((previos) => {
      const siguientes = { ...previos, [campo]: valor };
      if (!digitosManual && (campo === "numeroInicial" || campo === "cantidadNumeros")) {
        const automaticos = digitosAutomaticos(siguientes);
        if (automaticos) siguientes.digitos = String(automaticos);
      }
      return siguientes;
    });
  }

  const errores = estado.errores ?? {};
  // Atributos de accesibilidad para que el lector de pantalla anuncie el error o la ayuda del campo.
  const describir = (campo: CampoRifa, conAyuda = false) => ({
    id: idDe(campo),
    name: campo,
    "aria-invalid": Boolean(errores[campo]) || undefined,
    "aria-describedby": errores[campo]
      ? `${idDe(campo)}-error`
      : conAyuda
        ? `${idDe(campo)}-ayuda`
        : undefined,
  });

  return (
    <form action={enviar} className="space-y-8">
      <Seccion titulo="Datos generales">
        <Campo id={idDe("nombre")} etiqueta="Nombre" error={errores.nombre}>
          <Input
            {...describir("nombre")}
            value={valores.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            maxLength={120}
            required
            placeholder="Ej. Rifa de fin de año"
          />
        </Campo>
        <Campo id={idDe("descripcion")} etiqueta="Descripción (opcional)" error={errores.descripcion}>
          <Textarea
            {...describir("descripcion")}
            value={valores.descripcion}
            onChange={(e) => cambiar("descripcion", e.target.value)}
            maxLength={500}
            rows={2}
          />
        </Campo>
      </Seccion>

      <Seccion
        titulo="Números"
        nota={
          rangoBloqueado
            ? "La rifa ya tiene números apartados o vendidos, así que el rango y los dígitos ya no se pueden cambiar."
            : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo id={idDe("numeroInicial")} etiqueta="Primer número" error={errores.numeroInicial}>
            <Input
              {...describir("numeroInicial")}
              type="number"
              inputMode="numeric"
              min={0}
              value={valores.numeroInicial}
              onChange={(e) => cambiar("numeroInicial", e.target.value)}
              readOnly={rangoBloqueado}
              className={rangoBloqueado ? "bg-muted" : undefined}
              required
            />
          </Campo>
          <Campo id={idDe("cantidadNumeros")} etiqueta="Cantidad de números" error={errores.cantidadNumeros}>
            <Input
              {...describir("cantidadNumeros")}
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              value={valores.cantidadNumeros}
              onChange={(e) => cambiar("cantidadNumeros", e.target.value)}
              readOnly={rangoBloqueado}
              className={rangoBloqueado ? "bg-muted" : undefined}
              required
            />
          </Campo>
          <Campo
            id={idDe("digitos")}
            etiqueta="Dígitos"
            error={errores.digitos}
            ayuda="Con 4, el 7 se muestra como 0007."
          >
            <Input
              {...describir("digitos", true)}
              type="number"
              inputMode="numeric"
              min={1}
              max={6}
              value={valores.digitos}
              onChange={(e) => {
                setDigitosManual(true);
                cambiar("digitos", e.target.value);
              }}
              readOnly={rangoBloqueado}
              className={rangoBloqueado ? "bg-muted" : undefined}
              required
            />
          </Campo>
        </div>
        <VistaPreviaRango valores={valores} />
      </Seccion>

      <Seccion titulo="Precio y apartados">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id={idDe("precioNumero")}
            etiqueta="Precio por número"
            error={errores.precioNumero}
            ayuda={modo === "editar" ? "Solo aplica a los apartados nuevos." : undefined}
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                $
              </span>
              <Input
                {...describir("precioNumero", modo === "editar")}
                inputMode="decimal"
                value={valores.precioNumero}
                onChange={(e) => cambiar("precioNumero", e.target.value)}
                className="pl-6"
                placeholder="100"
                required
              />
            </div>
          </Campo>
          <Campo
            id={idDe("plazoApartadoHoras")}
            etiqueta="Plazo para pagar un apartado (horas)"
            error={errores.plazoApartadoHoras}
            ayuda={describirPlazo(valores.plazoApartadoHoras)}
          >
            <Input
              {...describir("plazoApartadoHoras", true)}
              type="number"
              inputMode="numeric"
              min={1}
              value={valores.plazoApartadoHoras}
              onChange={(e) => cambiar("plazoApartadoHoras", e.target.value)}
              required
            />
          </Campo>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            name="liberacionAutomatica"
            checked={valores.liberacionAutomatica}
            onChange={(e) => cambiar("liberacionAutomatica", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Liberar solos los apartados vencidos</span>
            <span className="block text-xs text-muted-foreground">
              Cuando pase el plazo sin pago, el número vuelve a estar disponible sin que nadie lo
              libere a mano. Si no lo activas, los vencidos se marcan para que tú decidas.
            </span>
          </span>
        </label>
      </Seccion>

      <Seccion titulo="Sorteo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={idDe("fechaSorteo")} etiqueta="Fecha del sorteo (opcional)" error={errores.fechaSorteo}>
            <Input
              {...describir("fechaSorteo")}
              type="date"
              value={valores.fechaSorteo}
              onChange={(e) => cambiar("fechaSorteo", e.target.value)}
            />
          </Campo>
          {modo === "editar" && (
            <Campo
              id={idDe("estado")}
              etiqueta="Estado"
              error={errores.estado}
              ayuda="En una rifa cerrada ya no se aparta ni se vende."
            >
              <select
                {...describir("estado", true)}
                value={valores.estado}
                onChange={(e) => cambiar("estado", e.target.value as ValoresRifa["estado"])}
                className={CLASES_SELECT}
              >
                <option value="activa">Activa</option>
                <option value="cerrada">Cerrada</option>
              </select>
            </Campo>
          )}
        </div>
      </Seccion>

      {estado.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {estado.error}
        </p>
      )}
      {estado.mensaje && !enviando && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {estado.mensaje}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {modo === "crear" ? "Cancelar" : "Volver"}
        </Link>
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? "Guardando…" : modo === "crear" ? "Crear rifa" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b pb-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="text-xs text-muted-foreground">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

function VistaPreviaRango({ valores }: { valores: ValoresRifa }) {
  const inicio = Number(valores.numeroInicial);
  const cantidad = Number(valores.cantidadNumeros);
  const digitos = Number(valores.digitos);
  const completos =
    valores.numeroInicial !== "" &&
    valores.cantidadNumeros !== "" &&
    Number.isInteger(inicio) &&
    Number.isInteger(cantidad) &&
    Number.isInteger(digitos) &&
    inicio >= 0 &&
    cantidad >= 1 &&
    digitos >= 1;

  if (!completos) {
    return <p className="text-sm text-muted-foreground">Completa el rango para ver la numeración.</p>;
  }
  const ultimo = inicio + cantidad - 1;
  if (digitosNecesarios(ultimo) > digitos) {
    return (
      <p className="text-sm text-destructive">
        El {ultimo} no cabe en {digitos} {digitos === 1 ? "dígito" : "dígitos"}.
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-sm">
      Números del <strong className="font-mono">{formatearNumero(inicio, digitos)}</strong> al{" "}
      <strong className="font-mono">{formatearNumero(ultimo, digitos)}</strong> ·{" "}
      {formatearEntero(cantidad)} en total
    </p>
  );
}

function digitosAutomaticos(valores: Pick<ValoresRifa, "numeroInicial" | "cantidadNumeros">) {
  const inicio = Number(valores.numeroInicial);
  const cantidad = Number(valores.cantidadNumeros);
  if (!Number.isInteger(inicio) || !Number.isInteger(cantidad) || inicio < 0 || cantidad < 1) {
    return null;
  }
  return digitosNecesarios(inicio + cantidad - 1);
}

function describirPlazo(texto: string) {
  const horas = Number(texto);
  if (!Number.isInteger(horas) || horas < 1) return undefined;
  if (horas % 24 !== 0) return `${horas} ${horas === 1 ? "hora" : "horas"}.`;
  const dias = horas / 24;
  return `${horas} horas = ${dias} ${dias === 1 ? "día" : "días"}.`;
}

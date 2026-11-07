"use client";

import { cn } from "cn";
import { useActionState, useId, useState, useTransition } from "react";

import { BotonCopiar } from "@/components/boton-copiar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UsuarioDelOrganizador } from "@/server/usuarios";

import {
  actualizarUsuarioAccion,
  cambiarActivoAccion,
  crearUsuarioAccion,
  restablecerContrasenaAccion,
  type EstadoUsuarios,
} from "./acciones";

type Credenciales = NonNullable<EstadoUsuarios["credenciales"]>;

const CLASES_SELECT =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function Aviso({ estado }: { estado: { error?: string; mensaje?: string } }) {
  if (!estado.error && !estado.mensaje) return null;
  return (
    <p
      role={estado.error ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        estado.error ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-900",
      )}
    >
      {estado.error ?? estado.mensaje}
    </p>
  );
}

export function AdministrarUsuarios({
  usuarios,
  yoId,
}: {
  usuarios: UsuarioDelOrganizador[];
  yoId: string;
}) {
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);

  return (
    <div className="space-y-6">
      {credenciales && (
        <MostrarCredenciales credenciales={credenciales} onCerrar={() => setCredenciales(null)} />
      )}
      <Card>
        <CardContent>
          <NuevoUsuario onCreado={setCredenciales} />
        </CardContent>
      </Card>
      <ul className="divide-y rounded-xl border">
        {usuarios.map((u) => (
          <FilaUsuario key={u.id} usuario={u} esYo={u.id === yoId} onCredenciales={setCredenciales} />
        ))}
      </ul>
    </div>
  );
}

function MostrarCredenciales({
  credenciales,
  onCerrar,
}: {
  credenciales: Credenciales;
  onCerrar: () => void;
}) {
  const texto =
    `Tu acceso a perINDIO:\nCorreo: ${credenciales.email}\n` +
    `Contraseña temporal: ${credenciales.password}\n` +
    `Entra en ${typeof window === "undefined" ? "" : window.location.origin}/login y cámbiala en Mi cuenta.`;
  return (
    <div role="status" className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="font-medium">Contraseña temporal de {credenciales.email}</p>
      <p className="font-mono text-2xl tracking-wider select-all">{credenciales.password}</p>
      <p className="text-sm">
        Solo se muestra esta vez. Compártela por un medio privado y pídele que la cambie en
        &laquo;Mi cuenta&raquo; al entrar.
      </p>
      <div className="flex flex-wrap gap-2">
        <BotonCopiar texto={texto} etiqueta="Copiar acceso" />
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Ya la compartí
        </Button>
      </div>
    </div>
  );
}

function NuevoUsuario({ onCreado }: { onCreado: (c: Credenciales) => void }) {
  const id = useId();
  const [valores, setValores] = useState({ nombre: "", email: "", rol: "operador" });
  const [estado, enviar, enviando] = useActionState(
    async (previo: EstadoUsuarios, formData: FormData) => {
      const resultado = await crearUsuarioAccion(previo, formData);
      if (resultado.credenciales) {
        onCreado(resultado.credenciales);
        setValores({ nombre: "", email: "", rol: "operador" });
      }
      return resultado;
    },
    {},
  );
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} className="space-y-4">
      <h2 className="font-semibold">Agregar usuario</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_10rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-nombre`}>Nombre</Label>
          <Input
            id={`${id}-nombre`}
            name="nombre"
            value={valores.nombre}
            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
            required
            maxLength={80}
            aria-invalid={Boolean(errores.nombre) || undefined}
          />
          {errores.nombre && <p className="text-xs text-destructive">{errores.nombre}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>Correo</Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            value={valores.email}
            onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
            required
            autoComplete="off"
            aria-invalid={Boolean(errores.email) || undefined}
          />
          {errores.email && <p className="text-xs text-destructive">{errores.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-rol`}>Rol</Label>
          <select
            id={`${id}-rol`}
            name="rol"
            value={valores.rol}
            onChange={(e) => setValores((v) => ({ ...v, rol: e.target.value }))}
            className={CLASES_SELECT}
          >
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      {!estado.credenciales && <Aviso estado={estado} />}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Creando…" : "Crear usuario"}
      </Button>
    </form>
  );
}

function FilaUsuario({
  usuario,
  esYo,
  onCredenciales,
}: {
  usuario: UsuarioDelOrganizador;
  esYo: boolean;
  onCredenciales: (c: Credenciales) => void;
}) {
  const id = useId();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState<"restablecer" | "desactivar" | null>(null);
  const [aviso, setAviso] = useState<EstadoUsuarios>({});
  const [ocupado, iniciar] = useTransition();
  const [estado, enviar, guardando] = useActionState(
    async (previo: EstadoUsuarios, formData: FormData) => {
      const resultado = await actualizarUsuarioAccion(usuario.id, previo, formData);
      if (resultado.mensaje) setEditando(false);
      setAviso(resultado);
      return resultado;
    },
    {},
  );

  const ejecutar = (accion: () => Promise<EstadoUsuarios>) =>
    iniciar(async () => {
      const resultado = await accion();
      if (resultado.credenciales) onCredenciales(resultado.credenciales);
      setAviso(resultado);
      setConfirmar(null);
    });

  return (
    <li className={cn("space-y-3 p-4", !usuario.activo && "bg-muted/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {usuario.nombre}
            {esYo && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
            <Badge variant={usuario.rol === "admin" ? "default" : "secondary"}>
              {usuario.rol === "admin" ? "Administrador" : "Operador"}
            </Badge>
            {!usuario.activo && <Badge variant="outline">Desactivado</Badge>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{usuario.email}</p>
        </div>
        {!editando && !confirmar && (
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}>
              Editar
            </Button>
            {!esYo && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmar("restablecer")}>
                  Restablecer contraseña
                </Button>
                {usuario.activo ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmar("desactivar")}>
                    Desactivar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => ejecutar(() => cambiarActivoAccion(usuario.id, true))}
                  >
                    Reactivar
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {confirmar && (
        <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
          <p>
            {confirmar === "restablecer"
              ? `Se genera una contraseña temporal nueva para ${usuario.nombre} y se cierran sus sesiones.`
              : `${usuario.nombre} ya no podrá entrar y se cierran sus sesiones. Su historial se conserva.`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={confirmar === "desactivar" ? "destructive" : "default"}
              disabled={ocupado}
              onClick={() =>
                ejecutar(() =>
                  confirmar === "restablecer"
                    ? restablecerContrasenaAccion(usuario.id, usuario.email)
                    : cambiarActivoAccion(usuario.id, false),
                )
              }
            >
              {ocupado ? "Un momento…" : confirmar === "restablecer" ? "Restablecer" : "Desactivar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {editando && (
        <form action={enviar} className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-nombre`}>Nombre</Label>
            <Input id={`${id}-nombre`} name="nombre" defaultValue={usuario.nombre} required maxLength={80} />
            {estado.errores?.nombre && <p className="text-xs text-destructive">{estado.errores.nombre}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-rol`}>Rol</Label>
            <select
              id={`${id}-rol`}
              name="rol"
              defaultValue={usuario.rol}
              disabled={esYo}
              className={CLASES_SELECT}
            >
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            {/* Un select deshabilitado no se envía: el propio rol viaja oculto. */}
            {esYo && <input type="hidden" name="rol" value={usuario.rol} />}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {!aviso.credenciales && <Aviso estado={aviso} />}
    </li>
  );
}

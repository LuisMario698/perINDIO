"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// El login va directo a /api/auth (no por una server action) para que aplique el límite
// de intentos de Better Auth.
export function FormularioLogin({ destino }: { destino: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);

    const { error } = await authClient.signIn.email({
      email: String(datos.get("email") ?? "").trim(),
      password: String(datos.get("password") ?? ""),
    });
    if (error) {
      setError(mensajeDeError(error));
      setEnviando(false);
      return;
    }

    router.replace(destino);
    router.refresh();
  }

  // method="post": si el JavaScript no cargara, el navegador no pondría la contraseña en la URL.
  return (
    <form method="post" onSubmit={entrar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function mensajeDeError(error: { status: number; code?: string }) {
  if (error.status === 429) return "Demasiados intentos. Espera unos segundos y vuelve a intentar.";
  if (error.code === "BANNED_USER") return "Tu cuenta está desactivada. Habla con el administrador.";
  if (error.status === 401) return "Correo o contraseña incorrectos.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

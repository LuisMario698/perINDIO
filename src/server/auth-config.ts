import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { defaultAc } from "better-auth/plugins/admin/access";

import type { Db } from "@/db/client";
import { cuentas, limitesDeSolicitudes, sesiones, usuarios, verificaciones } from "@/db/schema";

// Permisos sobre cuentas (plugin admin). Deben coincidir con ROLES de src/db/schema.ts.
// El admin administra usuarios y sesiones, sin poder suplantar a nadie; el operador no
// tiene permisos sobre cuentas. Lo que cada rol puede hacer con las rifas se revisa en la app.
const roles = {
  admin: defaultAc.newRole({
    user: ["create", "list", "set-role", "ban", "delete", "set-password", "set-email", "get", "update"],
    session: ["list", "revoke", "delete"],
  }),
  operador: defaultAc.newRole({ user: [], session: [] }),
};

/**
 * Configuración de Better Auth. Es una fábrica para que la app, los scripts y las pruebas
 * la usen con su propia conexión; la app usa la instancia de src/server/auth.ts.
 * Better Auth lee BETTER_AUTH_SECRET y BETTER_AUTH_URL del entorno.
 */
export function crearAuth(db: Db) {
  return betterAuth({
    appName: "perINDIO",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: usuarios,
        session: sesiones,
        account: cuentas,
        verification: verificaciones,
        rateLimit: limitesDeSolicitudes,
      },
    }),
    // Sin registro público: las cuentas las crea un administrador (seed o pnpm usuario:crear).
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
    user: {
      additionalFields: {
        organizadorId: { type: "string", required: true, input: false },
      },
    },
    // Aplica a las peticiones HTTP a /api/auth; en producción permite 3 intentos de
    // login cada 10 segundos por IP. Por eso el formulario de login llama a ese endpoint.
    rateLimit: { storage: "database" },
    plugins: [
      admin({ roles, defaultRole: "operador", adminRoles: ["admin"] }),
      nextCookies(), // debe ir al final
    ],
  });
}

export type Auth = ReturnType<typeof crearAuth>;

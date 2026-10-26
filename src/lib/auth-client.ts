import { createAuthClient } from "better-auth/react";

// Cliente para el navegador; usa el mismo origen que la app (/api/auth).
export const authClient = createAuthClient();

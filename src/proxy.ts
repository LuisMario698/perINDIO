import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Redirección rápida al login cuando no hay cookie de sesión. Solo revisa que la cookie
// exista; la sesión se valida en cada página con obtenerUsuarioActual().
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  const desde = request.nextUrl.pathname + request.nextUrl.search;
  if (desde !== "/") login.searchParams.set("desde", desde);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo menos el login, la API de autenticación, el health check, el cron (que se protege
  // con su propio secreto) y los archivos estáticos.
  matcher: ["/((?!login|api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico).*)"],
};

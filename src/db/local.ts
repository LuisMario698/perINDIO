const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** true si la cadena de conexión apunta a una base en esta máquina. */
export function esBaseLocal(url: string): boolean {
  return HOSTS_LOCALES.has(new URL(url).hostname);
}

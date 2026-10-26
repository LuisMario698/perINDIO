# perINDIO

Sistema web para administrar rifas: números disponibles, apartados y vendidos, seguimiento de pagos, liberación de apartados vencidos y listas en PDF.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Drizzle ORM · PostgreSQL 17.

## Requisitos

- Node.js 22 o superior y pnpm
- Docker Desktop (para el Postgres local)

## Arranque local

```bash
cp .env.example .env
pnpm install
pnpm db:up        # levanta Postgres en Docker y espera a que esté listo
pnpm db:migrate   # aplica las migraciones
pnpm db:seed      # carga datos de prueba
pnpm dev          # http://localhost:3000
```

La página de inicio muestra si la app llega a la base de datos; `GET /api/health` responde lo mismo en JSON.

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` / `pnpm typecheck` | ESLint y TypeScript |
| `pnpm db:up` / `pnpm db:down` | Levanta o detiene el contenedor de Postgres (los datos se conservan) |
| `pnpm db:reset` | Borra la base local, la vuelve a crear, migra y siembra |
| `pnpm db:generate` | Genera una migración SQL a partir de `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes en `DATABASE_URL` |
| `pnpm db:seed` | Carga datos de prueba; solo corre contra una base local |
| `pnpm db:studio` | Abre Drizzle Studio para ver los datos |

## Estructura

```
docker-compose.yml   Postgres local
drizzle.config.ts    Configuración de drizzle-kit
drizzle/             Migraciones SQL versionadas
scripts/seed.ts      Datos de prueba
src/app/             Páginas y rutas (App Router)
src/components/ui/   Componentes de shadcn/ui
src/db/              Esquema, cliente y utilidades de base de datos
```

## Cambios en la base de datos

1. Edita `src/db/schema.ts`.
2. `pnpm db:generate` crea el archivo SQL en `drizzle/`. Revísalo y súbelo al repositorio.
3. `pnpm db:migrate` lo aplica.

## Paso a la nube

Toda la configuración va en variables de entorno, así que mover la base solo requiere cambiar `DATABASE_URL`:

1. Crea la base en el proveedor (Supabase, Neon, etc.) y copia la cadena de conexión del **pooler en modo transacción** (en Supabase, puerto 6543). El cliente ya usa `prepare: false`, que ese modo necesita.
2. Aplica las migraciones contra la nueva base: `DATABASE_URL="<cadena>" pnpm db:migrate`.
3. Despliega la app (por ejemplo, en Vercel) y configura `DATABASE_URL` en sus variables de entorno.
4. Verifica con `GET /api/health`.

El seed se niega a correr contra una base que no sea local, para no mezclar datos de prueba con datos reales.

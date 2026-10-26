# perINDIO

Sistema web para administrar rifas: números disponibles, apartados y vendidos, seguimiento de pagos, liberación de apartados vencidos y listas en PDF.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Drizzle ORM · PostgreSQL 17 · Vitest.

## Requisitos

- Node.js 22 o superior y pnpm
- Docker Desktop (para el Postgres local)

## Arranque local

```bash
cp .env.example .env
pnpm install
pnpm db:up        # levanta Postgres en Docker y espera a que esté listo
pnpm db:migrate   # aplica las migraciones
pnpm db:seed      # carga los datos de demostración
pnpm test         # corre las pruebas (usan su propia base, perindio_test)
pnpm dev          # http://localhost:3000
```

La página de inicio muestra si la app llega a la base de datos; `GET /api/health` responde lo mismo en JSON.

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` / `pnpm typecheck` | ESLint y TypeScript |
| `pnpm test` / `pnpm test:watch` | Pruebas con Vitest contra la base de pruebas |
| `pnpm db:up` / `pnpm db:down` | Levanta o detiene el contenedor de Postgres (los datos se conservan) |
| `pnpm db:reset` | Borra la base local, la vuelve a crear, migra y siembra |
| `pnpm db:generate` | Genera una migración SQL a partir de `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes en `DATABASE_URL` |
| `pnpm db:seed` | **Reemplaza** los datos con los de demostración; solo corre contra una base local |
| `pnpm db:studio` | Abre Drizzle Studio para ver los datos |

`db:migrate` imprime un par de avisos (`NOTICE ... already exists, skipping`) de la tabla interna de Drizzle; son normales.

## Datos de demostración

`pnpm db:seed` crea siempre los mismos datos:

- **Rifa Pro Fondos 2026**: 2,000 números (0000–1999) a $100, plazo de 48 h, liberación manual. Tiene ventas, apartados vigentes, 18 apartados vencidos esperando que el organizador los libere y algunas liberaciones en el historial.
- **Rifa Express**: 100 números (00–99) a $50, plazo de 24 h, liberación automática, con 5 apartados vencidos que se liberan en cuanto corre la liberación automática.

## Estructura

```
docker-compose.yml   Postgres local
drizzle.config.ts    Configuración de drizzle-kit
drizzle/             Migraciones SQL versionadas
scripts/seed.ts      Datos de demostración
src/app/             Páginas y rutas (App Router)
src/components/ui/   Componentes de shadcn/ui
src/db/              Esquema, cliente y utilidades de base de datos
src/lib/             Utilidades compartidas (formato de números)
src/server/          Operaciones del negocio: crear rifas, apartar, pagar, liberar, cancelar
tests/               Pruebas de reglas, liberación y concurrencia
```

## Modelo de datos

| Tabla | Para qué |
| --- | --- |
| `organizadores` | Dueño de las rifas (hoy uno; preparado para varios) |
| `rifas` | Configuración: rango de números, dígitos, precio, plazo para pagar, liberación automática |
| `numeros` | Una fila por número; se generan todas al crear la rifa |
| `compradores` | Nombre, teléfono opcional y notas |
| `asignaciones` | Cada apartado o venta de un número: estado (`apartado`, `vendido`, `liberado`, `cancelado`), pago (`pendiente`, `confirmado`), monto, fecha límite y fecha de pago |
| `movimientos` | Historial de apartados, ventas, pagos, cancelaciones y liberaciones |

El estado de un número no se guarda: sale de su asignación vigente. La vista **`numeros_estado`** junta cada número con su estado (`disponible`, `apartado`, `vendido`), si está vencido, la etiqueta con ceros (`0042`) y los datos del comprador.

### Reglas que impone Postgres

Se cumplen aunque alguien escriba directo en la base:

- **Un número no puede tener dos asignaciones vigentes** (índice único parcial `asignaciones_vigente_por_numero`). Si dos personas apartan el mismo número al mismo tiempo, solo una lo consigue.
- Un número solo puede asignarse dentro de su propia rifa.
- Un apartado siempre tiene fecha límite y nunca tiene el pago confirmado; un número liberado nunca tuvo pago confirmado.
- El rango de números tiene que caber en los dígitos configurados.

Las operaciones de `src/server/asignaciones.ts` son **todo o nada**: si una persona aparta 5 números y uno ya estaba ocupado, no se aparta ninguno y el error dice cuál falló.

### Liberación de apartados vencidos

- **Manual**: `liberarAsignaciones()` libera los apartados que el organizador elija, siempre que sigan con pago pendiente.
- **Automática**: la función SQL `liberar_apartados_vencidos()` libera los apartados vencidos y sin pagar de las rifas con `liberacion_automatica` y los registra en el historial. Si un pago se confirma al mismo tiempo, gana uno de los dos y el otro no modifica nada. Se puede ejecutar varias veces en paralelo sin duplicar nada.

## Pruebas

`pnpm test` crea la base `perindio_test` en el mismo contenedor (si no existe), le aplica las migraciones y vacía las tablas antes de cada prueba. Por seguridad, `TEST_DATABASE_URL` tiene que ser local y terminar en `_test`.

Cubren la creación de rifas, las reglas de la base, cada operación y estos casos de concurrencia:

- 20 apartados simultáneos del mismo número
- apartados simultáneos con números en común, en distinto orden, sin interbloqueos
- confirmar un pago mientras corre la liberación automática
- varias liberaciones automáticas a la vez

## Cambios en la base de datos

1. Edita `src/db/schema.ts`.
2. `pnpm db:generate` crea el archivo SQL en `drizzle/`. Revísalo y súbelo al repositorio.
3. `pnpm db:migrate` lo aplica.

Para SQL que Drizzle no genera (vistas, funciones), usa `pnpm db:generate --custom --name=<nombre>` y escribe el SQL a mano, como en `drizzle/0001_vista_y_liberacion.sql`.

## Paso a la nube

Toda la configuración va en variables de entorno, así que mover la base solo requiere cambiar `DATABASE_URL`:

1. Crea la base en el proveedor (Supabase, Neon, etc.) y copia la cadena de conexión del **pooler en modo transacción** (en Supabase, puerto 6543). El cliente ya usa `prepare: false`, que ese modo necesita.
2. Aplica las migraciones contra la nueva base: `DATABASE_URL="<cadena>" pnpm db:migrate`.
3. Despliega la app (por ejemplo, en Vercel) y configura `DATABASE_URL` en sus variables de entorno.
4. Verifica con `GET /api/health`.
5. Programa la liberación automática. En Supabase, con pg_cron (cada 10 minutos):

   ```sql
   select cron.schedule('liberar-apartados', '*/10 * * * *', $$select liberar_apartados_vencidos()$$);
   ```

**Seguridad en Supabase:** todas las tablas tienen RLS activado sin políticas y la vista usa `security_invoker`. La app se conecta directo a Postgres como dueña de las tablas, así que no le afecta; la API pública de Supabase (anon / authenticated) no puede leer ni escribir nada.

El seed se niega a correr contra una base que no sea local, para no mezclar datos de prueba con datos reales.

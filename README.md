# perINDIO

Sistema web para administrar rifas: números disponibles, apartados y vendidos, seguimiento de pagos, liberación de apartados vencidos y listas en PDF.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Drizzle ORM · PostgreSQL 17 · jsPDF · Vitest.

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

Para presentar el proyecto hay un guion paso a paso en [docs/guion-demo.md](docs/guion-demo.md) y un comando que deja todo listo en modo producción:

```bash
pnpm demo        # Postgres + migraciones + datos de demostración + build + servidor en :3000
pnpm demo:datos  # vuelve a dejar los datos de demostración (para ensayar)
```

Entra con el administrador que crea el seed (`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` de tu `.env`). Para ver la app como operador, usa `SEED_OPERADOR_EMAIL` y `SEED_OPERADOR_PASSWORD`.

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
| `pnpm demo` / `pnpm demo:datos` | Prepara y arranca la demo en modo producción / reinicia los datos demo |
| `pnpm usuario:crear` | Crea una cuenta (no hay registro público); `--ayuda` muestra las opciones |

`db:migrate` imprime un par de avisos (`NOTICE ... already exists, skipping`) de la tabla interna de Drizzle; son normales.

## Datos de demostración

`pnpm db:seed` crea siempre los mismos datos:

- **Rifa Pro Fondos 2026**: 2,000 números (0000–1999) a $100, plazo de 48 h, liberación manual. Tiene ventas, apartados vigentes, 18 apartados vencidos esperando que el organizador los libere y algunas liberaciones en el historial.
- **Rifa Express**: 100 números (00–99) a $50, plazo de 24 h, liberación automática, con 5 apartados vencidos que se liberan en cuanto corre la liberación automática.
- Dos cuentas: un administrador y un operador.

## Estructura

```
docker-compose.yml   Postgres local
docs/                Guion de la demo
drizzle.config.ts    Configuración de drizzle-kit
drizzle/             Migraciones SQL versionadas
scripts/             Seed y creación de usuarios
src/proxy.ts         Manda al login a quien no tiene sesión
src/app/login/       Pantalla de login
src/app/(panel)/     Páginas protegidas (requieren sesión): lista de rifas, tablero, nueva rifa, configuración
src/components/ui/   Componentes de shadcn/ui
src/db/              Esquema, cliente y utilidades de base de datos
src/lib/             Utilidades compartidas (formatos, rutas, validación, cliente de auth)
src/server/          Lógica del servidor: auth, sesión, usuarios, rifas, asignaciones, consultas
tests/               Pruebas de reglas, liberación, concurrencia, autenticación, validación e historial
```

## Resumen (inicio)

La página de inicio muestra, para todas las rifas juntas:

- **Cobrado:** suma de los pagos confirmados.
- **Por cobrar:** suma de los apartados sin pagar (vigentes y vencidos).
- **Vendidos:** cuántos números y qué porcentaje del total.
- **Vencidos:** cuántos apartados vencieron sin pago y cuánto dinero representan (resaltado si hay alguno).

Y una tarjeta por rifa con lo cobrado y por cobrar, el porcentaje vendido, una barra con la proporción de vendidos, apartados, vencidos y disponibles, y accesos a sus números, su historial y (admin) su configuración. El tablero de cada rifa repite lo cobrado, lo pendiente y el avance arriba de la cuadrícula.

Los montos salen del precio guardado en cada apartado, así que un cambio de precio no altera lo ya registrado. Los colores de los estados (verde, ámbar y rojo) se eligieron para distinguirse también con daltonismo, y siempre van con su nombre.

## Rifas

Solo un administrador puede crear, configurar o eliminar rifas (botones **Nueva rifa** y **Configurar** del inicio). El operador ve la lista, y si abre esas pantallas por URL lo regresa al inicio; las acciones del servidor también revisan el rol.

- **Crear:** nombre, descripción, rango de números (primer número, cantidad y dígitos), precio, plazo para pagar un apartado, liberación automática y fecha del sorteo. Los dígitos se calculan solos a partir del número más alto, y una vista previa muestra la numeración (por ejemplo, "del 0000 al 1999"). Al crearla se generan todos sus números.
- **Configurar:** todo se puede cambiar, con dos límites:
  - El **rango y los dígitos** solo se pueden cambiar mientras la rifa no tenga ninguna asignación (ni siquiera liberada o cancelada), porque regenerar los números borraría ese historial. Después se muestran pero no se pueden editar.
  - El **precio** nuevo solo aplica a los apartados que se hagan después; cada apartado guarda el precio con el que se hizo.
- **Cerrar:** en la configuración, el estado "Cerrada" impide nuevos apartados y ventas.
- **Eliminar:** solo si la rifa nunca tuvo asignaciones, con confirmación. Si ya tuvo, se puede cerrar.
- Si alguien cambia el rango mientras otra persona aparta, Postgres los pone en fila (la rifa se bloquea durante el cambio): o el apartado entra primero y el cambio de rango se rechaza, o el rango cambia primero y el apartado se valida contra el rango nuevo.
- La validación del formulario está en `src/lib/validacion/rifa.ts` (zod, mensajes en español) y las operaciones en `src/server/rifas.ts`.

## Tablero de números

Cada rifa tiene su tablero (`/rifas/<id>`, botón **Ver números**), disponible para admin y operador:

- **Cuadrícula** con todos los números por color: disponible, apartado, vencido (apartado con el plazo vencido) y vendido.
- **Filtros** por estado, más "Pago pendiente" (apartados y vencidos), con el conteo de cada uno. **Búsqueda** por número ("195" encuentra 0195, 1195, 1950…) o por nombre del comprador, sin importar acentos ni mayúsculas.
- **Apartar o vender:** se tocan uno o varios números disponibles y se captura el comprador (nuevo, o uno que ya tiene números en la rifa), el plazo para pagar y observaciones. Con "Ya pagó" se registra como venta. Si mientras tanto otra persona tomó alguno, no se aparta ninguno y se avisa cuál.
- **Detalle de un número ocupado:** comprador, teléfono, precio, fechas y vencimiento. Desde ahí se confirma el pago, se libera (solo apartados sin pagar) o se cancela con un motivo. Si el comprador tiene varios números, se puede confirmar el pago de todos sus apartados o liberar todos sus vencidos de una vez.
- Al abrir el tablero corre la liberación automática, así que en las rifas que la tienen activada nunca se ven vencidos.
- En celular, mientras se eligen números aparece una barra con el total; el formulario se abre como hoja inferior.
- Cada operación queda en el historial con el usuario que la hizo. Las acciones del servidor verifican que la rifa sea del organizador del usuario y solo tocan asignaciones de esa rifa.

## PDF para imprimir

Desde el tablero, **Imprimir PDF** abre en otra pestaña cualquiera de estos cuatro documentos (tamaño carta, listos para imprimir o guardar):

| PDF | Contenido |
| --- | --- |
| Números disponibles | Cuadrícula ordenada solo con los números libres, sin datos de compradores, como las listas impresas tradicionales (10 columnas con 4 dígitos) |
| Lista completa | Todos los números con su estado y comprador, en dos bloques por hoja (2,000 números en 25 hojas) |
| Apartados pendientes de pago | Agrupados por comprador, con teléfono, fecha de apartado, vencimiento (vencidos en negritas) y el total por cobrar |
| Ventas confirmadas | Números pagados con comprador, fecha de pago y el total cobrado |

Cada PDF se genera en el servidor al momento de pedirlo (`/rifas/<id>/pdf/<tipo>`), así que refleja el estado registrado en ese instante; no se guarda en disco. Requiere sesión y solo entrega rifas del organizador del usuario. Usa las fuentes estándar de PDF (sin archivos de fuentes que desplegar) y pesa menos de 100 KB incluso con 2,000 números. El código está en `src/server/pdf.ts`.

## Historial

Cada rifa tiene su historial (botón **Historial** del tablero, o **Ver historial del 0042** desde el detalle de un número): apartados, ventas, pagos, cancelaciones (con su motivo) y liberaciones, con la fecha, el comprador y quién lo hizo ("Sistema" para la liberación automática). Se filtra por tipo de movimiento o por número y se pagina de 100 en 100, del más reciente al más antiguo.

## Liberación programada

Los apartados vencidos de las rifas con liberación automática se liberan:

- **Al abrir el tablero** de cualquier rifa (siempre, sin configurar nada).
- **Con un cron**, para que se liberen aunque nadie abra la app. Hay dos formas:
  - `GET /api/cron/liberar-vencidos` con el encabezado `Authorization: Bearer <CRON_SECRET>`. Responde `{"liberados": N}`, o 401 sin el secreto correcto. Sirve con Vercel Cron (que manda ese encabezado solo cuando `CRON_SECRET` está configurado) o con cualquier servicio externo. En el plan gratuito de Vercel, Vercel Cron solo puede correr una vez al día; para algo más frecuente usa pg_cron o un servicio externo.
  - **pg_cron** en Supabase, que llama directo a la función SQL (ver "Paso a la nube").

La función es segura de correr varias veces a la vez: nunca libera dos veces ni libera un apartado que se pagó mientras tanto.

Para probarla localmente:

```bash
curl -H "Authorization: Bearer $(grep ^CRON_SECRET= .env | cut -d= -f2-)" http://localhost:3000/api/cron/liberar-vencidos
```

## Fechas y zona horaria

Las fechas se guardan en UTC y se muestran en la zona de `NEXT_PUBLIC_ZONA_HORARIA` (predeterminada: `America/Mexico_City`), tanto en el servidor como en el navegador. Así no cambia la hora aunque el servidor de la nube esté en UTC.

## Usuarios y acceso

- **No hay registro público.** Las cuentas se crean con `pnpm usuario:crear` (o el seed en desarrollo); el endpoint de registro de Better Auth responde 400.
- **Roles:** `admin` y `operador`. Solo el admin crea, configura y elimina rifas; los permisos del resto de las pantallas se definen conforme lleguen.
- Cada usuario pertenece a un organizador y solo ve sus rifas.
- **Protección de páginas:** `src/proxy.ts` manda al login a quien no tiene cookie de sesión, y cada página valida la sesión con `obtenerUsuarioActual()` (`src/server/sesion.ts`). Las acciones del servidor también deben llamarla.
- **Límite de intentos:** en producción, 3 intentos de login cada 10 segundos por IP, guardados en la tabla `limites_de_solicitudes`.
- **Desactivar una cuenta** (mientras no haya pantalla de usuarios): `update usuarios set banned = true where email = '...'`; ya no puede entrar. Para cerrar sus sesiones abiertas, borra sus filas de `sesiones`.
- Lo que se aparta, paga, libera o cancela queda registrado con el usuario que lo hizo (`asignaciones.creada_por`, `movimientos.usuario_id`).

```bash
pnpm usuario:crear --email ana@ejemplo.com --nombre "Ana López" --rol operador
```

## Modelo de datos

| Tabla | Para qué |
| --- | --- |
| `organizadores` | Dueño de las rifas (hoy uno; preparado para varios) |
| `rifas` | Configuración: rango de números, dígitos, precio, plazo para pagar, liberación automática |
| `numeros` | Una fila por número; se generan todas al crear la rifa |
| `compradores` | Nombre, teléfono opcional y notas |
| `asignaciones` | Cada apartado o venta de un número: estado (`apartado`, `vendido`, `liberado`, `cancelado`), pago (`pendiente`, `confirmado`), monto, fecha límite y fecha de pago |
| `movimientos` | Historial de apartados, ventas, pagos, cancelaciones y liberaciones, con el usuario que los hizo |
| `usuarios`, `sesiones`, `cuentas`, `verificaciones`, `limites_de_solicitudes` | Tablas de Better Auth (las columnas conservan los nombres en inglés que espera la librería) |

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

Cubren la creación, configuración y eliminación de rifas, la validación del formulario, las reglas de la base, cada operación, la autenticación (registro público bloqueado, login, cuentas desactivadas, roles) y estos casos de concurrencia:

- 20 apartados simultáneos del mismo número
- apartados simultáneos con números en común, en distinto orden, sin interbloqueos
- confirmar un pago mientras corre la liberación automática
- varias liberaciones automáticas a la vez
- cambiar el rango de una rifa mientras alguien aparta

También cubren la validación del formulario de apartado, que las operaciones del tablero no puedan tocar asignaciones de otra rifa, el historial (orden, filtros y paginación), el secreto del cron, los montos del resumen y el contenido de cada PDF.

## Cambios en la base de datos

1. Edita `src/db/schema.ts`.
2. `pnpm db:generate` crea el archivo SQL en `drizzle/`. Revísalo y súbelo al repositorio.
3. `pnpm db:migrate` lo aplica.

Para SQL que Drizzle no genera (vistas, funciones), usa `pnpm db:generate --custom --name=<nombre>` y escribe el SQL a mano, como en `drizzle/0001_vista_y_liberacion.sql`.

## Paso a la nube

Toda la configuración va en variables de entorno, así que mover la base solo requiere cambiar `DATABASE_URL`:

1. Crea la base en el proveedor (Supabase, Neon, etc.) y copia la cadena de conexión del **pooler en modo transacción** (en Supabase, puerto 6543). El cliente ya usa `prepare: false`, que ese modo necesita.
2. Aplica las migraciones contra la nueva base: `DATABASE_URL="<cadena>" pnpm db:migrate`.
3. Despliega la app (por ejemplo, en Vercel) y configura sus variables de entorno:
   - `DATABASE_URL`: la cadena del paso 1
   - `BETTER_AUTH_SECRET`: uno nuevo, distinto al de desarrollo (`openssl rand -base64 32`)
   - `BETTER_AUTH_URL`: la URL pública de la app (por ejemplo `https://rifas.ejemplo.com`)
   - `BETTER_AUTH_TRUSTED_ORIGINS` (opcional): otras direcciones desde las que se puede entrar, separadas por comas (por ejemplo, el dominio de pruebas)
4. Crea el primer administrador contra la base de la nube:

   ```bash
   DATABASE_URL="<cadena>" pnpm usuario:crear --email tu@correo.com --nombre "Tu nombre" --rol admin --organizacion "Nombre del organizador"
   ```

5. Verifica con `GET /api/health` y entra con esa cuenta.
6. Programa la liberación automática (cualquiera de estas opciones; ver "Liberación programada"):
   - **pg_cron en Supabase** (cada 10 minutos, sin pasar por la app):

     ```sql
     select cron.schedule('liberar-apartados', '*/10 * * * *', $$select liberar_apartados_vencidos()$$);
     ```

   - **Un cron que llame al endpoint**: configura `CRON_SECRET` en la app y programa `GET /api/cron/liberar-vencidos` con `Authorization: Bearer <CRON_SECRET>`.
7. Configura también `CRON_SECRET` (si usas el endpoint) y `NEXT_PUBLIC_ZONA_HORARIA` si el organizador no está en la hora del centro de México.

**Seguridad en Supabase:** todas las tablas tienen RLS activado sin políticas y la vista usa `security_invoker`. La app se conecta directo a Postgres como dueña de las tablas, así que no le afecta; la API pública de Supabase (anon / authenticated) no puede leer ni escribir nada.

El seed se niega a correr contra una base que no sea local, para no mezclar datos de prueba con datos reales.

# Guion de la demo · perINDIO

Presentación de unos **18 minutos** que recorre la propuesta con la app funcionando, desde los dos lados: el **comprador** que aparta desde su celular y el **organizador** que cobra, da seguimiento y sortea. Cada paso dice qué hacer, qué decir y qué parte de la propuesta cubre. Los flujos completos y la matriz de permisos están en [flujos.md](flujos.md).

## Antes de presentar

1. Abre Docker Desktop.
2. En la carpeta del proyecto:

   ```bash
   pnpm demo
   ```

   Levanta Postgres, aplica migraciones, **reinicia los datos de demostración**, compila y arranca la app en modo producción en http://localhost:3000. Si `pnpm dev` está corriendo, deténlo antes: los dos usan el puerto 3000.
3. Ten a la mano las cuentas de `.env`:
   - Administrador: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
   - Operadores (vendedores): `SEED_OPERADOR_EMAIL` y `karla@perindio.test`, los dos con `SEED_OPERADOR_PASSWORD`
4. **No abras el tablero ni la página pública de la Rifa Express antes de presentar:** al abrirlos se liberan sus apartados vencidos, y eso se muestra en vivo en el paso 10.
5. **Celular** (recomendado para los pasos 6 y 7), conectado a la misma red Wi‑Fi:
   - Obtén la IP de la computadora con `ipconfig getifaddr en0` (por ejemplo `192.168.1.161`).
   - En `.env` pon `BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.1.161:3000` **antes** de correr `pnpm demo` (solo hace falta para entrar con cuenta desde el celular; la página pública no pide cuenta).
   - Si macOS pregunta si permite conexiones entrantes a Node, acepta.
   - Para que el QR del PDF y los enlaces de WhatsApp lleven esa IP, abre el panel en la computadora también con `http://192.168.1.161:3000`.
6. Para ensayar varias veces, `pnpm demo:datos` vuelve a dejar los datos como al principio (cierra las sesiones abiertas).

Datos que encontrarás:

| Rifa | Números | Estado inicial |
| --- | --- | --- |
| Rifa Pro Fondos 2026 | 0000–1999, $100, plazo 48 h, liberación **manual**, 3 premios | 380 vendidos, 140 apartados, **18 vencidos**, pedidos de los 3 vendedores y de la página pública |
| Rifa Express | 00–99, $50, plazo 24 h, liberación **automática**, 2 premios | 30 vendidos, 10 apartados, **5 vencidos** |
| Rifa Navideña 2025 | 00–99, $20 | **Sorteada**, con ganadores publicados |

Las tres tienen página pública: `/r/pro-fondos-2026`, `/r/rifa-express` y `/r/navidena-2025`.

## Recorrido

### 1. El problema (30 s) · *Propuesta §2*

Hoy las rifas se llevan en listas impresas y hojas de cálculo: números duplicados, no se sabe quién no ha pagado, cada lista hay que rehacerla y el comprador tiene que preguntar por WhatsApp qué números quedan.

### 2. Acceso y roles (30 s) · *§7, cuentas autorizadas*

- Entra con el **administrador**.
- Menciona: no hay registro público; hay administradores y operadores (vendedores), y el comprador **no necesita cuenta**.

### 3. Resumen (1 min) · *§5.7 Panel de resumen*

- Indicadores: **Cobrado**, **Por cobrar**, **Vendidos** y **Vencidos**.
- Cada rifa con su avance y su estado: Activa, Ventas cerradas o **Sorteada**.

### 4. Perfil del organizador (45 s)

- **Organizador**: nombre, WhatsApp para recibir comprobantes, datos de pago y logo.
- Sube un logo (PNG o JPG): aparecerá en la página pública, en los pedidos y en los PDF.

### 5. Crear y publicar una rifa (1.5 min) · *§5.1 Creación y configuración*

- **Nueva rifa** → "Rifa de Navidad", cantidad **500**, precio **50**. Los dígitos se ajustan solos ("del 000 al 499").
- Sección **Página pública**: publicada, enlace (se genera del nombre si lo dejas vacío), plazo para pagar en línea, **máximo de números por comprador** e instrucciones de pago.
- Crea la rifa. Se usará al final para el sorteo.

### 6. Compartir y apartar como comprador (2.5 min) · *Flujo del comprador*

- Abre **Rifa Pro Fondos 2026**: arriba está su enlace público con **Copiar enlace** y **Código QR**.
- En el **celular** escanea el QR (o abre `http://<IP>:3000/r/pro-fondos-2026`):
  - Precio, premios y la cuadrícula de **libres y ocupados**, sin nombres de nadie.
  - Elige 2 números, escribe un nombre y un WhatsApp de 10 dígitos y **aparta**.
- Llega a **su pedido**: folio, números, total, plazo para pagar y datos de pago.
- Toca **Enviar comprobante por WhatsApp**: el mensaje ya trae folio, números y total. *(No hace falta enviarlo.)*
- Menciona las protecciones: máximo por comprador, límite por conexión y por teléfono, y que si alguien gana el número un instante antes no se aparta ninguno.

### 7. Cobrar desde Pedidos (1.5 min) · *§5.3 Pagos pendientes y confirmados*

- En la computadora: **Pedidos** de la rifa. Busca el **folio** que salió en el celular.
- **Confirmar pago**. En el celular, recarga el pedido: ahora dice **Pagado**.
- Muestra **Recordar por WhatsApp** en un pedido vencido: el recordatorio ya trae monto y vencimiento.

### 8. Tablero, filtros y apartar en persona (2 min) · *§5.2, §5.3, §5.5*

- Pestaña **Números**: colores (disponible, apartado, vencido, vendido), filtros y búsqueda por número o por nombre sin acentos.
- Aparta tres números para un comprador en persona: aparece su **folio** y el botón para mandarle su pedido por WhatsApp.
- **Duplicados:** selecciona un número sin apartarlo; en el celular apártalo desde la página pública; vuelve y presiona **Apartar**: *"El número … ya no está disponible."* Lo garantiza la base de datos.

### 9. Ventas por vendedor (1 min)

- Pestaña **Vendedores**: pedidos, números, pagados, cobrado y por cobrar de cada vendedor, y la fila **Página pública**.
- **Cobros registrados por usuario**: quién confirmó cada pago, para cuadrar el dinero de cada quien.

### 10. Liberación por falta de pago (1.5 min) · *§5.4 Liberación de números*

- **Manual** (Pro Fondos): filtro **Vencidos** → un número → **Liberar**.
- **Automática** (Rifa Express): abre su tablero; los 5 vencidos ya no están. En su **Historial** aparecen como *Liberación automática* por **Sistema**. En la nube corre sola con un cron.

### 11. PDF para imprimir (1 min) · *§5.6 Documentos PDF*

- **Imprimir PDF → Números disponibles**: logo, cuadrícula de libres y el **QR "Aparta en línea"** para pegar la hoja en la tienda.
- Menciona los otros: lista completa, apartados pendientes y ventas confirmadas.

### 12. Historial (30 s) · *§5.8 Historial de movimientos*

- Cada apartado, pago, cancelación y liberación con fecha y quién lo hizo, incluidos los del comprador y los del sistema.

### 13. Usuarios y permisos (1.5 min)

- **Usuarios** → agrega un vendedor: la **contraseña temporal** se muestra una sola vez, con botón para copiar el acceso.
- Muestra **Desactivar** y que siempre debe quedar un administrador.
- Entra como operador (o en el celular): opera tablero y pedidos, pero no ve Configurar, Sorteo, Usuarios ni Organizador, y **no puede cancelar una venta pagada**.

### 14. Sorteo y resultados (2 min)

- Abre **Rifa Navideña 2025 → Sorteo**: ganadores con nombre, teléfono, folio y **Avisar por WhatsApp**.
- Abre `/r/navidena-2025`: los resultados publicados con el nombre abreviado ("María G.").
- Con la **Rifa de Navidad** del paso 5, muestra los tres pasos: premios → **Cerrar ventas** → **Registrar resultado**. Como nadie compró, el sistema avisa que el número no tiene comprador y pide confirmar; al registrar, la rifa queda en solo lectura.

### 15. Cierre (1 min) · *§10 Mejoras futuras*

- Lista para la nube: la base pasa a Supabase o Neon cambiando una variable y la app se despliega en Vercel.
- Siguientes pasos posibles: pagos en línea, varios organizadores con cuentas independientes (el modelo ya lo contempla), notificaciones automáticas y exportar a Excel.

## Preguntas para el cliente

Decisiones tomadas con un supuesto que conviene confirmar:

1. ¿Puede existir un número **vendido con el pago pendiente** (fiado)? Hoy "vendido" siempre es pagado.
2. ¿Se aceptan **abonos** o pagos parciales por número? Hoy cada número se paga completo (un pedido sí puede quedar pagado en parte).
3. ¿Los límites de la página pública están bien? Predeterminados: **10 números** sin pagar por teléfono, **24 h** para pagar y 5 pedidos por hora por conexión.
4. ¿El comprador debe poder **cancelar** su propio apartado? Hoy sí, mientras no esté pagado.
5. ¿Se publica el **nombre del ganador** abreviado o completo? Hoy, nombre e inicial del apellido.
6. ¿En qué **zona horaria** están los organizadores? (Hoy, hora del centro de México.)

## Si algo sale mal

| Problema | Solución |
| --- | --- |
| "No se pudo conectar" o la página no carga | Revisa que Docker Desktop esté abierto y vuelve a correr `pnpm demo` |
| El puerto 3000 está ocupado | Detén `pnpm dev` u otro servidor y vuelve a intentar |
| El celular no abre la página | Misma red Wi‑Fi, la IP correcta y permitir conexiones entrantes a Node |
| El login desde el celular se rechaza | Falta la IP en `BETTER_AUTH_TRUSTED_ORIGINS`; corrígela y vuelve a correr `pnpm demo` |
| "Se hicieron muchos apartados desde esta conexión" | Límite de 5 pedidos por hora; `pnpm demo:datos` lo reinicia |
| Ya no hay vencidos para mostrar | `pnpm demo:datos` (luego vuelve a entrar) |
| "Demasiados intentos" al entrar | Espera 10 segundos: en producción hay límite de 3 intentos |

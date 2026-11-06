# Guion de la demo · perINDIO

Presentación de unos **12 minutos** que recorre la propuesta sección por sección con la app funcionando. Cada paso dice qué hacer, qué decir y qué parte de la propuesta cubre.

## Antes de presentar

1. Abre Docker Desktop.
2. En la carpeta del proyecto:

   ```bash
   pnpm demo
   ```

   Levanta Postgres, aplica migraciones, **reinicia los datos de demostración**, compila y arranca la app en modo producción en http://localhost:3000 (más rápida que `pnpm dev` y sin el ícono de desarrollo de Next.js). Si `pnpm dev` está corriendo, deténlo antes: los dos usan el puerto 3000.
3. Ten a la mano las cuentas de `.env`:
   - Administrador: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
   - Operador: `SEED_OPERADOR_EMAIL` / `SEED_OPERADOR_PASSWORD`
4. **No abras el tablero de la Rifa Express antes de presentar:** al abrirlo se liberan sus apartados vencidos, y eso se muestra en vivo en el paso 8.
5. Opcional, para el paso 6: usa también el celular, conectado a la misma red Wi‑Fi.
   - Obtén la IP de la computadora con `ipconfig getifaddr en0` (por ejemplo `192.168.1.161`).
   - En `.env` pon `BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.1.161:3000` **antes** de correr `pnpm demo`. Sin esto, el login desde el celular se rechaza.
   - En el celular abre `http://192.168.1.161:3000` y entra con la cuenta del operador. Si macOS pregunta si permite conexiones entrantes a Node, acepta.
6. Para ensayar varias veces, `pnpm demo:datos` vuelve a dejar los datos como al principio (cierra las sesiones abiertas).

Datos que encontrarás:

| Rifa | Números | Estado inicial |
| --- | --- | --- |
| Rifa Pro Fondos 2026 | 0000–1999, $100, plazo 48 h, liberación **manual** | 380 vendidos, 140 apartados, **18 vencidos**, historial de 3 semanas |
| Rifa Express | 00–99, $50, plazo 24 h, liberación **automática** | 30 vendidos, 10 apartados, **5 vencidos** |

## Recorrido

### 1. El problema (30 s) · *Propuesta §2*

Sin abrir nada todavía: hoy las rifas se llevan en listas impresas y hojas de cálculo; hay números duplicados, no se sabe quién no ha pagado y cada lista impresa hay que rehacerla a mano.

### 2. Acceso con cuenta (30 s) · *§7, acceso mediante cuentas autorizadas*

- Entra con el **administrador**.
- Menciona: no hay registro público, las cuentas las crea el administrador; hay roles (administrador y operador) y límite de intentos de acceso.

### 3. Resumen (1 min) · *§5.7 Panel de resumen*

- Señala los cuatro indicadores: **Cobrado**, **Por cobrar**, **Vendidos** (porcentaje) y **Vencidos** (resaltado en rojo).
- En cada rifa: lo cobrado, lo pendiente y la barra de avance con vendidos, apartados, vencidos y disponibles.
- Nota que la **Rifa Express tiene 5 vencidos**: se retoma en el paso 8.

### 4. Crear una rifa (1.5 min) · *§5.1 Creación y configuración*

- **Nueva rifa** → nombre "Rifa de Navidad", cantidad **500**, precio **50**.
- Muestra que los dígitos se ajustan solos y la vista previa dice **"Números del 000 al 499"** (conserva los ceros iniciales).
- Activa **Liberar solos los apartados vencidos** y crea la rifa: se generan los 500 números al instante.
- De regreso al resumen, la rifa nueva aparece con 500 disponibles.

### 5. Tablero, filtros y búsqueda (1.5 min) · *§5.3 Control de estados, §5.5 Filtros y búsqueda*

- Abre **Rifa Pro Fondos 2026 → Ver números**.
- Explica los colores: blanco disponible, ámbar apartado, rojo vencido, verde vendido.
- Filtra por **Vencidos** (18) y por **Pago pendiente**.
- Busca un comprador por nombre (sin importar acentos) y un número, por ejemplo **195**.

### 6. Apartar y evitar duplicados (2 min) · *§5.2 Registro de compradores, objetivo "evitar asignaciones simultáneas"*

- Toca tres números disponibles, captura un comprador y **Aparta**. Muestra el total ($300) y el aviso de confirmación.
- **Duplicados:** en la computadora selecciona un número disponible sin apartarlo todavía. En el celular (operador) aparta ese mismo número. Vuelve a la computadora y presiona **Apartar**: aparece *"El número … ya no está disponible."* y la cuadrícula se actualiza. Explica que lo garantiza la base de datos, no solo la pantalla.
  - Sin celular: explica el caso y menciona que está cubierto por pruebas automáticas (20 personas apartando el mismo número a la vez: solo una lo consigue).

### 7. Confirmar pagos (1 min) · *§5.3 Pagos pendientes y confirmados*

- Toca uno de los números recién apartados: detalle con comprador, teléfono, fecha y vencimiento.
- Usa **Confirmar pago de sus 3 apartados**: pasan a vendidos y el resumen suma $300 a lo cobrado.

### 8. Liberación por falta de pago (1.5 min) · *§5.4 Liberación de números*

- **Manual** (Rifa Pro Fondos): filtro **Vencidos** → toca uno → **Liberar** → confirma. El número vuelve a estar disponible.
- **Automática** (Rifa Express): abre su tablero. Los 5 vencidos ya no están: se liberaron solos. Abre su **Historial** y muestra las 5 *Liberación automática* hechas por **Sistema**.
- Menciona que en la nube la liberación corre sola cada pocos minutos (cron), aunque nadie abra la app.

### 9. PDF para imprimir (1.5 min) · *§5.6 Generación de documentos PDF*

- En el tablero: **Imprimir PDF → Números disponibles**. Cuadrícula ordenada, solo números libres, sin datos de compradores, con "Actualizado al …".
- **Apartados pendientes de pago**: agrupados por comprador, vencidos en negritas y total por cobrar.
- Menciona los otros dos: lista completa y ventas confirmadas.

### 10. Historial (45 s) · *§5.8 Historial de movimientos*

- **Historial** de Rifa Pro Fondos: cada apartado, pago, cancelación y liberación con fecha y quién lo hizo.
- Desde el detalle de un número, **Ver historial del 0000**.

### 11. Roles y celular (45 s) · *§1, uso desde computadora o celular*

- En el celular con el operador: ve el resumen y opera el tablero, pero no puede crear ni configurar rifas.
- En celular, al elegir números aparece una barra con el total y el formulario se abre desde abajo.

### 12. Cierre (1 min) · *§10 Mejoras futuras*

- Ya listo para la nube: la base pasa a Supabase o Neon cambiando una variable, y la app se despliega en Vercel.
- Siguientes pasos posibles: varios organizadores con cuentas independientes (el modelo ya lo contempla), notificaciones y recordatorios de vencimiento, exportar a Excel y consulta pública de números disponibles.

## Preguntas para el cliente

Decisiones que tomamos con un supuesto y conviene confirmar:

1. ¿Puede existir un número **vendido con el pago pendiente** (fiado)? Hoy "vendido" siempre es pagado.
2. ¿Se aceptan **abonos** o pagos parciales? Hoy el pago es completo.
3. ¿Qué puede hacer cada **rol**? Hoy el operador puede apartar, cobrar, liberar y **cancelar ventas pagadas**; solo el administrador crea y configura rifas.
4. ¿El **plazo para pagar** es uno por rifa (hoy, con opción de cambiarlo en cada apartado)?
5. ¿En qué **zona horaria** están los organizadores? (Hoy, hora del centro de México.)

## Si algo sale mal

| Problema | Solución |
| --- | --- |
| "No se pudo conectar" o la página no carga | Revisa que Docker Desktop esté abierto y vuelve a correr `pnpm demo` |
| El puerto 3000 está ocupado | Detén `pnpm dev` u otro servidor y vuelve a intentar |
| Ya no hay vencidos para mostrar | `pnpm demo:datos` (luego vuelve a entrar) |
| "Demasiados intentos" al entrar | Espera 10 segundos: en modo producción hay límite de 3 intentos |

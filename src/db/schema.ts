import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  pgView,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Todas las tablas tienen RLS activado y sin políticas: la app se conecta como dueña
// de las tablas (no le afecta), pero si la base se aloja en Supabase, su API pública
// (anon / authenticated) no puede leer ni escribir nada.

export const estadoRifa = pgEnum("estado_rifa", ["activa", "cerrada"]);

// "apartado" y "vendido" son vigentes: ocupan el número. "liberado" y "cancelado" lo devuelven.
export const estadoAsignacion = pgEnum("estado_asignacion", [
  "apartado",
  "vendido",
  "liberado",
  "cancelado",
]);

export const estadoPago = pgEnum("estado_pago", ["pendiente", "confirmado"]);

export const tipoMovimiento = pgEnum("tipo_movimiento", [
  "apartado",
  "venta",
  "pago_confirmado",
  "cancelacion",
  "liberacion_manual",
  "liberacion_automatica",
]);

const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const actualizadoEn = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`);

// Dueño de las rifas. Hoy hay uno; existe para soportar varios organizadores después.
export const organizadores = pgTable("organizadores", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  creadoEn: creadoEn(),
}).enableRLS();

// --- Autenticación (Better Auth) ---
// Los nombres de las propiedades son los que espera Better Auth; src/server/auth-config.ts
// le indica qué tabla usar para cada modelo. Los ids los genera Better Auth (texto).

export const ROLES = ["admin", "operador"] as const;
export type Rol = (typeof ROLES)[number];

export const usuarios = pgTable(
  "usuarios",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    // Campos del plugin admin de Better Auth.
    role: text().notNull().default("operador"),
    banned: boolean().notNull().default(false),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true }),
    organizadorId: uuid()
      .notNull()
      .references(() => organizadores.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    index().on(t.organizadorId),
    check("usuarios_role", sql`${t.role} in ('admin', 'operador')`),
  ],
).enableRLS();

export const sesiones = pgTable(
  "sesiones",
  {
    id: text().primaryKey(),
    token: text().notNull().unique(),
    userId: text()
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

// Credenciales: con correo y contraseña hay una fila con providerId "credential" y el hash.
export const cuentas = pgTable(
  "cuentas",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

export const verificaciones = pgTable(
  "verificaciones",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index().on(t.identifier)],
).enableRLS();

// Límite de intentos de login guardado en la base, para que funcione con varias
// instancias serverless (en memoria cada instancia llevaría su propia cuenta).
export const limitesDeSolicitudes = pgTable("limites_de_solicitudes", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
}).enableRLS();

// --- Rifas ---

export const rifas = pgTable(
  "rifas",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizadorId: uuid()
      .notNull()
      .references(() => organizadores.id),
    nombre: text().notNull(),
    descripcion: text(),
    numeroInicial: integer().notNull().default(0),
    cantidadNumeros: integer().notNull(),
    // Ancho con ceros a la izquierda: con 4, el 42 se muestra como "0042".
    digitos: smallint().notNull(),
    precioNumero: numeric({ precision: 10, scale: 2 }).notNull(),
    plazoApartadoHoras: integer().notNull().default(48),
    liberacionAutomatica: boolean().notNull().default(false),
    fechaSorteo: timestamp({ withTimezone: true }),
    estado: estadoRifa().notNull().default("activa"),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    index().on(t.organizadorId),
    check("rifas_cantidad_numeros", sql`${t.cantidadNumeros} between 1 and 100000`),
    check("rifas_numero_inicial", sql`${t.numeroInicial} >= 0`),
    check("rifas_digitos", sql`${t.digitos} between 1 and 6`),
    // El último número tiene que caber en los dígitos configurados.
    check(
      "rifas_rango_cabe_en_digitos",
      sql`${t.numeroInicial} + ${t.cantidadNumeros} <= power(10, ${t.digitos})`,
    ),
    check("rifas_precio_numero", sql`${t.precioNumero} >= 0`),
    check("rifas_plazo_apartado", sql`${t.plazoApartadoHoras} > 0`),
  ],
).enableRLS();

// Una fila por número de la rifa; se generan todas al crearla.
// El estado no se guarda aquí: se deriva de la asignación vigente (vista numeros_estado).
export const numeros = pgTable(
  "numeros",
  {
    id: uuid().primaryKey().defaultRandom(),
    rifaId: uuid()
      .notNull()
      .references(() => rifas.id, { onDelete: "cascade" }),
    numero: integer().notNull(),
  },
  (t) => [
    unique("numeros_rifa_numero").on(t.rifaId, t.numero),
    // Permite que asignaciones verifique que el número pertenece a la misma rifa.
    unique("numeros_rifa_id").on(t.rifaId, t.id),
  ],
).enableRLS();

export const compradores = pgTable(
  "compradores",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizadorId: uuid()
      .notNull()
      .references(() => organizadores.id),
    nombre: text().notNull(),
    telefono: text(),
    notas: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.organizadorId), check("compradores_nombre", sql`btrim(${t.nombre}) <> ''`)],
).enableRLS();

// Cada vez que un número se aparta o se vende se crea una asignación. Al liberarla o
// cancelarla no se borra: queda como historial y el número vuelve a estar disponible.
export const asignaciones = pgTable(
  "asignaciones",
  {
    id: uuid().primaryKey().defaultRandom(),
    rifaId: uuid()
      .notNull()
      .references(() => rifas.id, { onDelete: "cascade" }),
    numeroId: uuid().notNull(),
    compradorId: uuid()
      .notNull()
      .references(() => compradores.id),
    estado: estadoAsignacion().notNull(),
    estadoPago: estadoPago().notNull().default("pendiente"),
    // Precio al momento de asignar; no cambia si después se modifica el de la rifa.
    monto: numeric({ precision: 10, scale: 2 }).notNull(),
    fechaLimite: timestamp({ withTimezone: true }),
    fechaPago: timestamp({ withTimezone: true }),
    finalizadaEn: timestamp({ withTimezone: true }),
    observaciones: text(),
    creadaPor: text().references(() => usuarios.id),
    creadoEn: creadoEn(),
  },
  (t) => [
    foreignKey({
      name: "asignaciones_numero_de_la_rifa",
      columns: [t.rifaId, t.numeroId],
      foreignColumns: [numeros.rifaId, numeros.id],
    }).onDelete("cascade"),
    // La regla principal: un número solo puede tener una asignación vigente.
    uniqueIndex("asignaciones_vigente_por_numero")
      .on(t.numeroId)
      .where(sql`estado in ('apartado', 'vendido')`),
    index().on(t.rifaId, t.estado),
    index().on(t.compradorId),
    // Para encontrar rápido los apartados vencidos.
    index("asignaciones_apartados_pendientes")
      .on(t.fechaLimite)
      .where(sql`estado = 'apartado' and estado_pago = 'pendiente'`),
    check("asignaciones_monto", sql`${t.monto} >= 0`),
    check(
      "asignaciones_apartado_con_fecha_limite",
      sql`${t.estado} <> 'apartado' or ${t.fechaLimite} is not null`,
    ),
    check(
      "asignaciones_apartado_sin_pago",
      sql`${t.estado} <> 'apartado' or ${t.estadoPago} = 'pendiente'`,
    ),
    check(
      "asignaciones_liberado_sin_pago",
      sql`${t.estado} <> 'liberado' or ${t.estadoPago} = 'pendiente'`,
    ),
    check(
      "asignaciones_pago_con_fecha",
      sql`(${t.estadoPago} = 'confirmado') = (${t.fechaPago} is not null)`,
    ),
    check(
      "asignaciones_finalizada_con_fecha",
      sql`(${t.estado} in ('liberado', 'cancelado')) = (${t.finalizadaEn} is not null)`,
    ),
  ],
).enableRLS();

// Historial de operaciones. Solo se agregan filas.
export const movimientos = pgTable(
  "movimientos",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    rifaId: uuid()
      .notNull()
      .references(() => rifas.id, { onDelete: "cascade" }),
    numeroId: uuid()
      .notNull()
      .references(() => numeros.id, { onDelete: "cascade" }),
    asignacionId: uuid()
      .notNull()
      .references(() => asignaciones.id, { onDelete: "cascade" }),
    tipo: tipoMovimiento().notNull(),
    // null cuando lo hizo el sistema (liberación automática).
    usuarioId: text().references(() => usuarios.id),
    detalle: jsonb().$type<Record<string, unknown>>(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.rifaId, t.creadoEn), index().on(t.numeroId), index().on(t.asignacionId)],
).enableRLS();

// Vista definida en SQL (drizzle/0001_*.sql): cada número con su estado actual y,
// si está ocupado, los datos de su asignación vigente y del comprador.
export const numerosEstado = pgView("numeros_estado", {
  numeroId: uuid("numero_id").notNull(),
  rifaId: uuid("rifa_id").notNull(),
  numero: integer("numero").notNull(),
  etiqueta: text("etiqueta").notNull(),
  estado: text("estado", { enum: ["disponible", "apartado", "vendido"] }).notNull(),
  estadoPago: estadoPago("estado_pago"),
  vencido: boolean("vencido").notNull(),
  asignacionId: uuid("asignacion_id"),
  compradorId: uuid("comprador_id"),
  compradorNombre: text("comprador_nombre"),
  compradorTelefono: text("comprador_telefono"),
  monto: numeric("monto", { precision: 10, scale: 2 }),
  fechaLimite: timestamp("fecha_limite", { withTimezone: true }),
  fechaPago: timestamp("fecha_pago", { withTimezone: true }),
  asignadoEn: timestamp("asignado_en", { withTimezone: true }),
}).existing();

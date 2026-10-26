CREATE TYPE "public"."estado_asignacion" AS ENUM('apartado', 'vendido', 'liberado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('pendiente', 'confirmado');--> statement-breakpoint
CREATE TYPE "public"."estado_rifa" AS ENUM('activa', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('apartado', 'venta', 'pago_confirmado', 'cancelacion', 'liberacion_manual', 'liberacion_automatica');--> statement-breakpoint
CREATE TABLE "asignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rifa_id" uuid NOT NULL,
	"numero_id" uuid NOT NULL,
	"comprador_id" uuid NOT NULL,
	"estado" "estado_asignacion" NOT NULL,
	"estado_pago" "estado_pago" DEFAULT 'pendiente' NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha_limite" timestamp with time zone,
	"fecha_pago" timestamp with time zone,
	"finalizada_en" timestamp with time zone,
	"observaciones" text,
	"creada_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asignaciones_monto" CHECK ("asignaciones"."monto" >= 0),
	CONSTRAINT "asignaciones_apartado_con_fecha_limite" CHECK ("asignaciones"."estado" <> 'apartado' or "asignaciones"."fecha_limite" is not null),
	CONSTRAINT "asignaciones_apartado_sin_pago" CHECK ("asignaciones"."estado" <> 'apartado' or "asignaciones"."estado_pago" = 'pendiente'),
	CONSTRAINT "asignaciones_liberado_sin_pago" CHECK ("asignaciones"."estado" <> 'liberado' or "asignaciones"."estado_pago" = 'pendiente'),
	CONSTRAINT "asignaciones_pago_con_fecha" CHECK (("asignaciones"."estado_pago" = 'confirmado') = ("asignaciones"."fecha_pago" is not null)),
	CONSTRAINT "asignaciones_finalizada_con_fecha" CHECK (("asignaciones"."estado" in ('liberado', 'cancelado')) = ("asignaciones"."finalizada_en" is not null))
);
--> statement-breakpoint
ALTER TABLE "asignaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizador_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compradores_nombre" CHECK (btrim("compradores"."nombre") <> '')
);
--> statement-breakpoint
ALTER TABLE "compradores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rifa_id" uuid NOT NULL,
	"numero_id" uuid NOT NULL,
	"asignacion_id" uuid NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"usuario_id" text,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "numeros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rifa_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	CONSTRAINT "numeros_rifa_numero" UNIQUE("rifa_id","numero"),
	CONSTRAINT "numeros_rifa_id" UNIQUE("rifa_id","id")
);
--> statement-breakpoint
ALTER TABLE "numeros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rifas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizador_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"numero_inicial" integer DEFAULT 0 NOT NULL,
	"cantidad_numeros" integer NOT NULL,
	"digitos" smallint NOT NULL,
	"precio_numero" numeric(10, 2) NOT NULL,
	"plazo_apartado_horas" integer DEFAULT 48 NOT NULL,
	"liberacion_automatica" boolean DEFAULT false NOT NULL,
	"fecha_sorteo" timestamp with time zone,
	"estado" "estado_rifa" DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rifas_cantidad_numeros" CHECK ("rifas"."cantidad_numeros" between 1 and 100000),
	CONSTRAINT "rifas_numero_inicial" CHECK ("rifas"."numero_inicial" >= 0),
	CONSTRAINT "rifas_digitos" CHECK ("rifas"."digitos" between 1 and 6),
	CONSTRAINT "rifas_rango_cabe_en_digitos" CHECK ("rifas"."numero_inicial" + "rifas"."cantidad_numeros" <= power(10, "rifas"."digitos")),
	CONSTRAINT "rifas_precio_numero" CHECK ("rifas"."precio_numero" >= 0),
	CONSTRAINT "rifas_plazo_apartado" CHECK ("rifas"."plazo_apartado_horas" > 0)
);
--> statement-breakpoint
ALTER TABLE "rifas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_rifa_id_rifas_id_fk" FOREIGN KEY ("rifa_id") REFERENCES "public"."rifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_comprador_id_compradores_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."compradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_numero_de_la_rifa" FOREIGN KEY ("rifa_id","numero_id") REFERENCES "public"."numeros"("rifa_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compradores" ADD CONSTRAINT "compradores_organizador_id_organizadores_id_fk" FOREIGN KEY ("organizador_id") REFERENCES "public"."organizadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_rifa_id_rifas_id_fk" FOREIGN KEY ("rifa_id") REFERENCES "public"."rifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_numero_id_numeros_id_fk" FOREIGN KEY ("numero_id") REFERENCES "public"."numeros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_asignacion_id_asignaciones_id_fk" FOREIGN KEY ("asignacion_id") REFERENCES "public"."asignaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numeros" ADD CONSTRAINT "numeros_rifa_id_rifas_id_fk" FOREIGN KEY ("rifa_id") REFERENCES "public"."rifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_organizador_id_organizadores_id_fk" FOREIGN KEY ("organizador_id") REFERENCES "public"."organizadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asignaciones_vigente_por_numero" ON "asignaciones" USING btree ("numero_id") WHERE estado in ('apartado', 'vendido');--> statement-breakpoint
CREATE INDEX "asignaciones_rifa_id_estado_index" ON "asignaciones" USING btree ("rifa_id","estado");--> statement-breakpoint
CREATE INDEX "asignaciones_comprador_id_index" ON "asignaciones" USING btree ("comprador_id");--> statement-breakpoint
CREATE INDEX "asignaciones_apartados_pendientes" ON "asignaciones" USING btree ("fecha_limite") WHERE estado = 'apartado' and estado_pago = 'pendiente';--> statement-breakpoint
CREATE INDEX "compradores_organizador_id_index" ON "compradores" USING btree ("organizador_id");--> statement-breakpoint
CREATE INDEX "movimientos_rifa_id_creado_en_index" ON "movimientos" USING btree ("rifa_id","creado_en");--> statement-breakpoint
CREATE INDEX "movimientos_numero_id_index" ON "movimientos" USING btree ("numero_id");--> statement-breakpoint
CREATE INDEX "movimientos_asignacion_id_index" ON "movimientos" USING btree ("asignacion_id");--> statement-breakpoint
CREATE INDEX "rifas_organizador_id_index" ON "rifas" USING btree ("organizador_id");
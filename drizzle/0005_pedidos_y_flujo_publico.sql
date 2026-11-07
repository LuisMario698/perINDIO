CREATE TYPE "public"."origen_pedido" AS ENUM('publico', 'interno');--> statement-breakpoint
ALTER TYPE "public"."estado_rifa" ADD VALUE 'sorteada';--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'cancelacion_comprador';--> statement-breakpoint
CREATE TABLE "intentos_publicos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intentos_publicos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clave" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intentos_publicos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rifa_id" uuid NOT NULL,
	"comprador_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"token" text NOT NULL,
	"origen" "origen_pedido" NOT NULL,
	"vendedor_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_token_unique" UNIQUE("token"),
	CONSTRAINT "pedidos_rifa_folio" UNIQUE("rifa_id","folio"),
	CONSTRAINT "pedidos_vendedor_segun_origen" CHECK (("pedidos"."origen" = 'publico') = ("pedidos"."vendedor_id" is null))
);
--> statement-breakpoint
ALTER TABLE "pedidos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "premios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rifa_id" uuid NOT NULL,
	"lugar" smallint NOT NULL,
	"descripcion" text NOT NULL,
	"numero_ganador" integer,
	"asignacion_ganadora_id" uuid,
	CONSTRAINT "premios_rifa_lugar" UNIQUE("rifa_id","lugar"),
	CONSTRAINT "premios_lugar" CHECK ("premios"."lugar" >= 1),
	CONSTRAINT "premios_descripcion" CHECK (btrim("premios"."descripcion") <> '')
);
--> statement-breakpoint
ALTER TABLE "premios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "compradores_organizador_id_index";--> statement-breakpoint
ALTER TABLE "asignaciones" ADD COLUMN "pedido_id" uuid;--> statement-breakpoint
-- Asignaciones existentes: un pedido por asignación. Sin usuario que la capturara, cuenta como pública.
INSERT INTO "pedidos" ("id", "rifa_id", "comprador_id", "folio", "token", "origen", "vendedor_id", "creado_en")
SELECT a.id, a.rifa_id, a.comprador_id,
       upper(substr(md5(a.id::text), 1, 6)),
       md5(random()::text || a.id::text) || md5(clock_timestamp()::text || a.id::text),
       (CASE WHEN a.creada_por IS NULL THEN 'publico' ELSE 'interno' END)::"origen_pedido",
       a.creada_por, a.creado_en
FROM "asignaciones" a;--> statement-breakpoint
UPDATE "asignaciones" SET "pedido_id" = "id";--> statement-breakpoint
ALTER TABLE "asignaciones" ALTER COLUMN "pedido_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "compradores" ADD COLUMN "telefono_normalizado" text;--> statement-breakpoint
ALTER TABLE "organizadores" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "organizadores" ADD COLUMN "datos_pago" text;--> statement-breakpoint
ALTER TABLE "organizadores" ADD COLUMN "logo" "bytea";--> statement-breakpoint
ALTER TABLE "organizadores" ADD COLUMN "logo_tipo" text;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "publica" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "slug" text;--> statement-breakpoint
-- Rifas existentes: slug a partir del nombre más 4 caracteres para que no se repita.
UPDATE "rifas" SET "slug" =
  coalesce(nullif(trim(both '-' from regexp_replace(lower("nombre"), '[^a-z0-9]+', '-', 'g')), ''), 'rifa')
  || '-' || substr(md5("id"::text), 1, 4);--> statement-breakpoint
ALTER TABLE "rifas" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "plazo_publico_horas" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "max_numeros_publico" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "instrucciones_pago" text;--> statement-breakpoint
ALTER TABLE "rifas" ADD COLUMN "sorteada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_rifa_id_rifas_id_fk" FOREIGN KEY ("rifa_id") REFERENCES "public"."rifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comprador_id_compradores_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."compradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_id_usuarios_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premios" ADD CONSTRAINT "premios_rifa_id_rifas_id_fk" FOREIGN KEY ("rifa_id") REFERENCES "public"."rifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premios" ADD CONSTRAINT "premios_asignacion_ganadora_id_asignaciones_id_fk" FOREIGN KEY ("asignacion_ganadora_id") REFERENCES "public"."asignaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intentos_publicos_clave_creado_en_index" ON "intentos_publicos" USING btree ("clave","creado_en");--> statement-breakpoint
CREATE INDEX "pedidos_rifa_id_creado_en_index" ON "pedidos" USING btree ("rifa_id","creado_en");--> statement-breakpoint
CREATE INDEX "pedidos_comprador_id_index" ON "pedidos" USING btree ("comprador_id");--> statement-breakpoint
CREATE INDEX "pedidos_vendedor_id_index" ON "pedidos" USING btree ("vendedor_id");--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asignaciones_pedido_id_index" ON "asignaciones" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "compradores_organizador_id_telefono_normalizado_index" ON "compradores" USING btree ("organizador_id","telefono_normalizado");--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_slug" CHECK ("rifas"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_plazo_publico" CHECK ("rifas"."plazo_publico_horas" > 0);--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_max_numeros_publico" CHECK ("rifas"."max_numeros_publico" between 1 and 100);--> statement-breakpoint
ALTER TABLE "rifas" ADD CONSTRAINT "rifas_sorteada_con_fecha" CHECK (("rifas"."estado"::text = 'sorteada') = ("rifas"."sorteada_en" is not null));
-- Cada número con su estado actual. El estado sale de la asignación vigente
-- (a lo más una, por el índice asignaciones_vigente_por_numero); sin asignación está disponible.
-- security_invoker: quien consulta la vista necesita permiso sobre las tablas (respeta RLS en Supabase).
CREATE VIEW "numeros_estado" WITH (security_invoker = true) AS
SELECT
  n.id AS numero_id,
  n.rifa_id,
  n.numero,
  lpad(n.numero::text, r.digitos, '0') AS etiqueta,
  coalesce(a.estado::text, 'disponible') AS estado,
  a.estado_pago,
  coalesce(a.estado = 'apartado' AND a.fecha_limite < now(), false) AS vencido,
  a.id AS asignacion_id,
  a.comprador_id,
  c.nombre AS comprador_nombre,
  c.telefono AS comprador_telefono,
  a.monto,
  a.fecha_limite,
  a.fecha_pago,
  a.creado_en AS asignado_en
FROM numeros n
JOIN rifas r ON r.id = n.rifa_id
LEFT JOIN asignaciones a ON a.numero_id = n.id AND a.estado IN ('apartado', 'vendido')
LEFT JOIN compradores c ON c.id = a.comprador_id;
--> statement-breakpoint

-- Libera los apartados vencidos de las rifas con liberación automática y registra cada
-- liberación en el historial. Devuelve cuántos liberó.
-- Solo toca apartados que siguen vigentes y con pago pendiente: si un pago se confirma al
-- mismo tiempo, Postgres vuelve a evaluar la condición sobre la fila ya actualizada y la omite.
-- La llaman la app (al abrir el tablero), un cron o pg_cron; es seguro correrla en paralelo.
CREATE FUNCTION liberar_apartados_vencidos() RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  liberados integer;
BEGIN
  WITH vencidas AS (
    UPDATE asignaciones a
       SET estado = 'liberado', finalizada_en = now()
      FROM rifas r
     WHERE r.id = a.rifa_id
       AND r.liberacion_automatica
       AND a.estado = 'apartado'
       AND a.estado_pago = 'pendiente'
       AND a.fecha_limite < now()
    RETURNING a.id, a.rifa_id, a.numero_id, a.fecha_limite
  )
  INSERT INTO movimientos (rifa_id, numero_id, asignacion_id, tipo, detalle)
  SELECT rifa_id, numero_id, id, 'liberacion_automatica', jsonb_build_object('fecha_limite', fecha_limite)
    FROM vencidas;

  GET DIAGNOSTICS liberados = ROW_COUNT;
  RETURN liberados;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION liberar_apartados_vencidos() FROM PUBLIC;

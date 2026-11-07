-- La vista agrega el pedido y su folio a cada número ocupado.
CREATE OR REPLACE VIEW "numeros_estado" WITH (security_invoker = true) AS
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
  a.creado_en AS asignado_en,
  a.observaciones,
  a.pedido_id,
  p.folio
FROM numeros n
JOIN rifas r ON r.id = n.rifa_id
LEFT JOIN asignaciones a ON a.numero_id = n.id AND a.estado IN ('apartado', 'vendido')
LEFT JOIN compradores c ON c.id = a.comprador_id
LEFT JOIN pedidos p ON p.id = a.pedido_id;
--> statement-breakpoint

-- La liberación automática ya no toca rifas sorteadas (sus asignaciones quedan fijas).
-- estado se compara como texto por la misma razón que el CHECK rifas_sorteada_con_fecha.
CREATE OR REPLACE FUNCTION liberar_apartados_vencidos() RETURNS integer
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
       AND r.estado::text <> 'sorteada'
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

-- Una rifa sorteada es definitiva: nadie puede crear ni cambiar sus asignaciones,
-- aunque escriba directo en la base.
CREATE FUNCTION impedir_cambios_en_rifa_sorteada() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rifas WHERE id = NEW.rifa_id AND estado::text = 'sorteada') THEN
    RAISE EXCEPTION 'La rifa ya fue sorteada; sus números ya no se pueden modificar.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER asignaciones_rifa_sorteada
BEFORE INSERT OR UPDATE ON asignaciones
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_en_rifa_sorteada();
--> statement-breakpoint

REVOKE ALL ON FUNCTION impedir_cambios_en_rifa_sorteada() FROM PUBLIC;

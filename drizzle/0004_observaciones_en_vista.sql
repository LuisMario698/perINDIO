-- Agrega a numeros_estado las observaciones de la asignación vigente (para el tablero).
-- CREATE OR REPLACE solo permite agregar columnas al final.
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
  a.observaciones
FROM numeros n
JOIN rifas r ON r.id = n.rifa_id
LEFT JOIN asignaciones a ON a.numero_id = n.id AND a.estado IN ('apartado', 'vendido')
LEFT JOIN compradores c ON c.id = a.comprador_id;


-- Drop and recreate view with store_id
DROP VIEW IF EXISTS public.v_current_inventory;

CREATE VIEW public.v_current_inventory AS
SELECT
  v.id AS variant_id,
  v.name AS variant_name,
  p.name AS product_name,
  COALESCE(i.quantity, 0) AS quantity,
  c.name AS category_name,
  v.store_id
FROM variants v
JOIN products p ON v.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON i.variant_id = v.id;

-- Fix Security Definer View issue by dropping and recreating views
-- Views should use SECURITY INVOKER (default) instead of SECURITY DEFINER
-- This ensures RLS policies are applied based on the querying user, not the view creator

-- Drop existing views
DROP VIEW IF EXISTS public.v_current_inventory;
DROP VIEW IF EXISTS public.v_profit_by_date;
DROP VIEW IF EXISTS public.v_sales_summary;

-- Recreate v_current_inventory without SECURITY DEFINER
CREATE VIEW public.v_current_inventory AS
SELECT 
  v.id AS variant_id,
  v.name AS variant_name,
  p.name AS product_name,
  c.name AS category_name,
  COALESCE(i.quantity, 0) AS quantity
FROM variants v
LEFT JOIN products p ON v.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON v.id = i.variant_id;

-- Recreate v_profit_by_date without SECURITY DEFINER
CREATE VIEW public.v_profit_by_date AS
SELECT 
  date_trunc('day', s.created_at) AS day,
  sum((si.unit_price - si.cost_price - si.discount) * si.quantity) AS profit
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
GROUP BY date_trunc('day', s.created_at)
ORDER BY date_trunc('day', s.created_at) DESC;

-- Recreate v_sales_summary without SECURITY DEFINER
CREATE VIEW public.v_sales_summary AS
SELECT 
  date_trunc('day', created_at) AS day,
  count(*) AS receipts,
  sum(total) AS total_sales,
  sum(discount_total) AS total_discounts
FROM sales
GROUP BY date_trunc('day', created_at)
ORDER BY date_trunc('day', created_at) DESC;

-- Add comments explaining the security posture
COMMENT ON VIEW public.v_current_inventory IS 'View using SECURITY INVOKER - respects RLS policies of the querying user';
COMMENT ON VIEW public.v_profit_by_date IS 'View using SECURITY INVOKER - respects RLS policies of the querying user';
COMMENT ON VIEW public.v_sales_summary IS 'View using SECURITY INVOKER - respects RLS policies of the querying user';
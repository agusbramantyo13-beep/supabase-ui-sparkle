
-- 1. Indexes (skip existing)
CREATE INDEX IF NOT EXISTS idx_sales_store_created_at ON public.sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 2. View v_sale_item_profit
CREATE OR REPLACE VIEW public.v_sale_item_profit AS
SELECT
  s.id AS sale_id,
  s.created_at AS sale_created_at,
  s.receipt_number,
  s.store_id,
  s.user_id AS cashier_id,
  COALESCE(NULLIF(pr.name, ''), pr.email) AS cashier_name,
  p.id AS product_id,
  p.name AS product_name,
  si.variant_id,
  v.name AS variant_name,
  p.category_id,
  c.name AS category_name,
  si.product_snapshot,
  si.quantity,
  si.cost_price,
  si.unit_price,
  si.discount,
  si.total,
  (si.total - si.cost_price * si.quantity) AS profit,
  CASE WHEN si.total > 0
    THEN (si.total - si.cost_price * si.quantity) / si.total * 100
    ELSE 0
  END AS margin_pct
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
LEFT JOIN public.profiles pr ON pr.id = s.user_id
LEFT JOIN public.variants v ON v.id = si.variant_id
LEFT JOIN public.products p ON p.id = v.product_id
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE s.status IS DISTINCT FROM 'returned';

GRANT SELECT ON public.v_sale_item_profit TO authenticated;

-- Authorization helper (inline in each function)
-- has access = is_developer(auth.uid()) OR is_store_owner(auth.uid(), p_store_id)

-- 3. get_profit_summary
CREATE OR REPLACE FUNCTION public.get_profit_summary(
  p_store_id uuid, p_start date, p_end date
) RETURNS TABLE(
  total_revenue numeric,
  total_cost numeric,
  total_profit numeric,
  total_transactions bigint,
  avg_margin_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(x.total), 0)::numeric AS total_revenue,
    COALESCE(SUM(x.cost_price * x.quantity), 0)::numeric AS total_cost,
    COALESCE(SUM(x.profit), 0)::numeric AS total_profit,
    COUNT(DISTINCT x.sale_id)::bigint AS total_transactions,
    CASE WHEN COALESCE(SUM(x.total), 0) > 0
      THEN COALESCE(SUM(x.profit), 0) / SUM(x.total) * 100
      ELSE 0
    END::numeric AS avg_margin_pct
  FROM public.v_sale_item_profit x
  WHERE x.store_id = p_store_id
    AND x.sale_created_at >= p_start::timestamptz
    AND x.sale_created_at < (p_end + 1)::timestamptz;
END;
$$;

-- 4. get_profit_by_period
CREATE OR REPLACE FUNCTION public.get_profit_by_period(
  p_store_id uuid, p_start date, p_end date, p_group_by text
) RETURNS TABLE(
  period_start timestamptz,
  revenue numeric,
  cost numeric,
  profit numeric,
  transactions bigint,
  margin_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc text;
BEGIN
  IF NOT (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_group_by NOT IN ('day','week','month') THEN
    RAISE EXCEPTION 'p_group_by must be day/week/month';
  END IF;
  v_trunc := p_group_by;

  RETURN QUERY EXECUTE format($f$
    SELECT
      date_trunc(%L, x.sale_created_at) AS period_start,
      COALESCE(SUM(x.total), 0)::numeric AS revenue,
      COALESCE(SUM(x.cost_price * x.quantity), 0)::numeric AS cost,
      COALESCE(SUM(x.profit), 0)::numeric AS profit,
      COUNT(DISTINCT x.sale_id)::bigint AS transactions,
      CASE WHEN COALESCE(SUM(x.total), 0) > 0
        THEN COALESCE(SUM(x.profit), 0) / SUM(x.total) * 100
        ELSE 0
      END::numeric AS margin_pct
    FROM public.v_sale_item_profit x
    WHERE x.store_id = %L
      AND x.sale_created_at >= %L::timestamptz
      AND x.sale_created_at < (%L::date + 1)::timestamptz
    GROUP BY 1
    ORDER BY 1
  $f$, v_trunc, p_store_id, p_start, p_end);
END;
$$;

-- 5. get_profit_by_category
CREATE OR REPLACE FUNCTION public.get_profit_by_category(
  p_store_id uuid, p_start date, p_end date
) RETURNS TABLE(
  category_id bigint,
  category_name text,
  revenue numeric,
  cost numeric,
  profit numeric,
  margin_pct numeric,
  quantity_sold numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    x.category_id,
    x.category_name,
    COALESCE(SUM(x.total), 0)::numeric,
    COALESCE(SUM(x.cost_price * x.quantity), 0)::numeric,
    COALESCE(SUM(x.profit), 0)::numeric,
    CASE WHEN COALESCE(SUM(x.total), 0) > 0
      THEN COALESCE(SUM(x.profit), 0) / SUM(x.total) * 100
      ELSE 0
    END::numeric,
    COALESCE(SUM(x.quantity), 0)::numeric
  FROM public.v_sale_item_profit x
  WHERE x.store_id = p_store_id
    AND x.sale_created_at >= p_start::timestamptz
    AND x.sale_created_at < (p_end + 1)::timestamptz
  GROUP BY x.category_id, x.category_name
  ORDER BY 5 DESC;
END;
$$;

-- 6. get_profit_by_cashier
CREATE OR REPLACE FUNCTION public.get_profit_by_cashier(
  p_store_id uuid, p_start date, p_end date
) RETURNS TABLE(
  cashier_id uuid,
  cashier_name text,
  revenue numeric,
  cost numeric,
  profit numeric,
  margin_pct numeric,
  total_transactions bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    x.cashier_id,
    x.cashier_name,
    COALESCE(SUM(x.total), 0)::numeric,
    COALESCE(SUM(x.cost_price * x.quantity), 0)::numeric,
    COALESCE(SUM(x.profit), 0)::numeric,
    CASE WHEN COALESCE(SUM(x.total), 0) > 0
      THEN COALESCE(SUM(x.profit), 0) / SUM(x.total) * 100
      ELSE 0
    END::numeric,
    COUNT(DISTINCT x.sale_id)::bigint
  FROM public.v_sale_item_profit x
  WHERE x.store_id = p_store_id
    AND x.sale_created_at >= p_start::timestamptz
    AND x.sale_created_at < (p_end + 1)::timestamptz
  GROUP BY x.cashier_id, x.cashier_name
  ORDER BY 5 DESC;
END;
$$;

-- 7. get_top_products_profit
CREATE OR REPLACE FUNCTION public.get_top_products_profit(
  p_store_id uuid, p_start date, p_end date, p_metric text, p_limit int DEFAULT 10
) RETURNS TABLE(
  product_id bigint,
  variant_id bigint,
  product_name text,
  variant_name text,
  quantity_sold numeric,
  revenue numeric,
  cost numeric,
  profit numeric,
  margin_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_metric NOT IN ('most_profitable','highest_margin','lowest_margin','below_cost') THEN
    RAISE EXCEPTION 'invalid p_metric';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      x.product_id,
      x.variant_id,
      x.product_name,
      x.variant_name,
      SUM(x.quantity)::numeric AS quantity_sold,
      SUM(x.total)::numeric AS revenue,
      SUM(x.cost_price * x.quantity)::numeric AS cost,
      SUM(x.profit)::numeric AS profit,
      CASE WHEN SUM(x.total) > 0
        THEN SUM(x.profit) / SUM(x.total) * 100
        ELSE 0
      END::numeric AS margin_pct
    FROM public.v_sale_item_profit x
    WHERE x.store_id = p_store_id
      AND x.sale_created_at >= p_start::timestamptz
      AND x.sale_created_at < (p_end + 1)::timestamptz
    GROUP BY x.product_id, x.variant_id, x.product_name, x.variant_name
  )
  SELECT a.product_id, a.variant_id, a.product_name, a.variant_name,
         a.quantity_sold, a.revenue, a.cost, a.profit, a.margin_pct
  FROM agg a
  WHERE CASE WHEN p_metric = 'below_cost' THEN a.profit < 0 ELSE TRUE END
  ORDER BY
    CASE WHEN p_metric = 'most_profitable' THEN a.profit END DESC NULLS LAST,
    CASE WHEN p_metric = 'highest_margin' THEN a.margin_pct END DESC NULLS LAST,
    CASE WHEN p_metric = 'lowest_margin' THEN a.margin_pct END ASC NULLS LAST,
    CASE WHEN p_metric = 'below_cost' THEN a.profit END ASC NULLS LAST
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profit_summary(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profit_by_period(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profit_by_category(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profit_by_cashier(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_products_profit(uuid, date, date, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profit_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_by_period(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_by_category(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_by_cashier(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products_profit(uuid, date, date, text, int) TO authenticated;

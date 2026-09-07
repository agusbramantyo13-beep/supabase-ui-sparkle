CREATE OR REPLACE FUNCTION public.get_dashboard_sales_summary(
  p_store_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_sales numeric,
  sale_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_developer(auth.uid())
          OR EXISTS (SELECT 1 FROM public.store_members
                     WHERE user_id = auth.uid() AND store_id = p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(s.total), 0)::numeric,
    COUNT(*)
  FROM public.sales s
  WHERE s.store_id = p_store_id
    AND (p_start IS NULL OR s.created_at >= p_start)
    AND (p_end IS NULL OR s.created_at < p_end);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_sales_summary(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_store_expenses_summary(
  p_store_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_approved numeric,
  total_pending numeric,
  today_approved numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_developer(auth.uid())
          OR EXISTS (SELECT 1 FROM public.store_members
                     WHERE user_id = auth.uid() AND store_id = p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(e.amount) FILTER (
      WHERE e.status = 'approved'
        AND (p_start IS NULL OR e.approved_at >= p_start)
        AND (p_end IS NULL OR e.approved_at < p_end)
    ), 0)::numeric,
    COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'pending'), 0)::numeric,
    COALESCE(SUM(e.amount) FILTER (
      WHERE e.status = 'approved' AND e.approved_at >= date_trunc('day', now())
    ), 0)::numeric
  FROM public.store_expenses e
  WHERE e.store_id = p_store_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_store_expenses_summary(uuid, timestamptz, timestamptz) TO authenticated;

-- sales already has idx_sales_store_created_at (store_id, created_at DESC) covering date-range queries
CREATE INDEX IF NOT EXISTS idx_store_expenses_store_status_approved ON public.store_expenses(store_id, status, approved_at);
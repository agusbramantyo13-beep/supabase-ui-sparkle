CREATE INDEX IF NOT EXISTS idx_sales_store_cash_created
  ON public.sales (store_id, created_at DESC)
  WHERE payment_method IN ('cash','split');

CREATE INDEX IF NOT EXISTS idx_other_sales_store_date
  ON public.other_sales (store_id, sale_date);

CREATE INDEX IF NOT EXISTS idx_store_expenses_store_status_date
  ON public.store_expenses (store_id, status, expense_date);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_store_submitted
  ON public.cash_deposits (store_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_store_status_date
  ON public.cash_deposits (store_id, status, deposit_date);

CREATE OR REPLACE FUNCTION public.get_cash_deposit_summary(
  p_store_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE(
  total_cash_sales numeric,
  total_other_sales numeric,
  total_approved_deposits numeric,
  total_pending_deposits numeric,
  total_approved_expenses numeric,
  today_cash numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date date;
  v_end_date date;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_today_start timestamptz := (v_today::timestamp AT TIME ZONE 'Asia/Jakarta');
  v_today_end timestamptz := ((v_today + 1)::timestamp AT TIME ZONE 'Asia/Jakarta');
BEGIN
  IF NOT (public.is_developer(auth.uid())
          OR EXISTS (SELECT 1 FROM public.store_members
                     WHERE user_id = auth.uid() AND store_id = p_store_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_start_date := CASE WHEN p_start IS NULL THEN NULL
                       ELSE (p_start AT TIME ZONE 'Asia/Jakarta')::date END;
  v_end_date   := CASE WHEN p_end IS NULL THEN NULL
                       ELSE (p_end AT TIME ZONE 'Asia/Jakarta')::date END;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(
        CASE WHEN s.payment_method = 'split'
             THEN COALESCE((s.payment_details->>'cash_amount')::numeric, 0)
             ELSE COALESCE(s.total, 0) END)
      FROM public.sales s
      WHERE s.store_id = p_store_id
        AND s.payment_method IN ('cash','split')
        AND s.status IS DISTINCT FROM 'returned'
        AND (p_start IS NULL OR s.created_at >= p_start)
        AND (p_end IS NULL OR s.created_at < p_end)
    ), 0)::numeric,
    COALESCE((
      SELECT SUM(o.amount) FROM public.other_sales o
      WHERE o.store_id = p_store_id
        AND (v_start_date IS NULL OR o.sale_date >= v_start_date)
        AND (v_end_date IS NULL OR o.sale_date < v_end_date)
    ), 0)::numeric,
    COALESCE((
      SELECT SUM(d.amount) FROM public.cash_deposits d
      WHERE d.store_id = p_store_id AND d.status = 'approved'
        AND (p_start IS NULL OR d.submitted_at >= p_start)
        AND (p_end IS NULL OR d.submitted_at < p_end)
    ), 0)::numeric,
    COALESCE((
      SELECT SUM(d.amount) FROM public.cash_deposits d
      WHERE d.store_id = p_store_id AND d.status = 'pending'
        AND (p_start IS NULL OR d.submitted_at >= p_start)
        AND (p_end IS NULL OR d.submitted_at < p_end)
    ), 0)::numeric,
    COALESCE((
      SELECT SUM(e.amount) FROM public.store_expenses e
      WHERE e.store_id = p_store_id AND e.status = 'approved'
        AND (v_start_date IS NULL OR e.expense_date >= v_start_date)
        AND (v_end_date IS NULL OR e.expense_date < v_end_date)
    ), 0)::numeric,
    (
      COALESCE((
        SELECT SUM(
          CASE WHEN s.payment_method = 'split'
               THEN COALESCE((s.payment_details->>'cash_amount')::numeric, 0)
               ELSE COALESCE(s.total, 0) END)
        FROM public.sales s
        WHERE s.store_id = p_store_id
          AND s.payment_method IN ('cash','split')
          AND s.status IS DISTINCT FROM 'returned'
          AND s.created_at >= v_today_start AND s.created_at < v_today_end
      ), 0)
      +
      COALESCE((
        SELECT SUM(o.amount) FROM public.other_sales o
        WHERE o.store_id = p_store_id AND o.sale_date = v_today
      ), 0)
    )::numeric;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_cash_deposit_summary(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_deposit_summary(uuid, timestamptz, timestamptz) TO authenticated;
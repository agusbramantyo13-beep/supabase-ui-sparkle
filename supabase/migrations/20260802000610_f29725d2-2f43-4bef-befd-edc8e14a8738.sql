ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS average_cost numeric NULL;

UPDATE public.variants SET average_cost = cost_price WHERE average_cost IS NULL;

CREATE OR REPLACE FUNCTION public.apply_purchase_and_recalc_cost(
  p_variant_id bigint,
  p_quantity numeric,
  p_purchase_cost numeric,
  p_selling_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before INT := 0;
  v_store UUID;
  v_product_id BIGINT;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_user UUID := auth.uid();
  v_user_name TEXT;
  v_existed BOOLEAN := false;
  v_current_avg NUMERIC;
  v_new_avg NUMERIC;
  v_qty_add INT := GREATEST(0, FLOOR(COALESCE(p_quantity, 0)))::int;
  v_after INT;
BEGIN
  SELECT quantity, store_id INTO v_before, v_store
    FROM public.inventory WHERE variant_id = p_variant_id FOR UPDATE;
  IF FOUND THEN
    v_existed := true;
  ELSE
    v_before := 0;
    SELECT v.store_id INTO v_store FROM public.variants v WHERE v.id = p_variant_id;
  END IF;

  SELECT v.name, v.product_id, p.name, COALESCE(v.average_cost, v.cost_price)
    INTO v_variant_name, v_product_id, v_product_name, v_current_avg
    FROM public.variants v JOIN public.products p ON p.id = v.product_id
    WHERE v.id = p_variant_id;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Variant % has no store', p_variant_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.store_members WHERE user_id = v_user AND store_id = v_store) THEN
    RAISE EXCEPTION 'Not a member of this store';
  END IF;

  v_new_avg := ((v_before * COALESCE(v_current_avg, 0)) + (v_qty_add * COALESCE(p_purchase_cost, 0)))
               / NULLIF(v_before + v_qty_add, 0);
  IF v_new_avg IS NULL THEN
    v_new_avg := p_purchase_cost;
  END IF;

  UPDATE public.variants
     SET average_cost = v_new_avg,
         price = COALESCE(NULLIF(p_selling_price, 0), price)
   WHERE id = p_variant_id;

  v_after := v_before + v_qty_add;

  IF v_existed THEN
    UPDATE public.inventory SET quantity = v_after, updated_at = now() WHERE variant_id = p_variant_id;
  ELSE
    INSERT INTO public.inventory(variant_id, quantity, store_id) VALUES (p_variant_id, v_after, v_store);
  END IF;

  SELECT COALESCE(NULLIF(name,''), email) INTO v_user_name FROM public.profiles WHERE id = v_user;

  INSERT INTO public.stock_history(
    store_id, product_id, variant_id, product_name, variant_name,
    movement_type, qty_before, qty_change, qty_after, user_id, user_name, notes
  ) VALUES (
    v_store, v_product_id, p_variant_id, v_product_name, v_variant_name,
    'product_added', v_before, v_qty_add, v_after, v_user, v_user_name, p_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_purchase_and_recalc_cost(bigint, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_purchase_and_recalc_cost(bigint, numeric, numeric, numeric, text) TO authenticated, service_role;
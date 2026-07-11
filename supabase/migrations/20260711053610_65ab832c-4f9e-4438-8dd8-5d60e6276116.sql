
DO $$ BEGIN
  CREATE TYPE public.stock_history_type AS ENUM (
    'product_added','product_reduced','sale','stock_adjustment','stock_opname','product_return','initial_stock'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stock_history (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id BIGINT,
  variant_id BIGINT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  movement_type public.stock_history_type NOT NULL,
  qty_before INT NOT NULL DEFAULT 0,
  qty_change INT NOT NULL DEFAULT 0,
  qty_after INT NOT NULL DEFAULT 0,
  user_id UUID,
  user_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_store_created ON public.stock_history (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_history_variant ON public.stock_history (variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_type ON public.stock_history (movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_history_user ON public.stock_history (user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product_name ON public.stock_history USING gin (to_tsvector('simple', coalesce(product_name,'') || ' ' || coalesce(variant_name,'')));

GRANT SELECT, INSERT, DELETE ON public.stock_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.stock_history_id_seq TO authenticated;
GRANT ALL ON public.stock_history TO service_role;
GRANT ALL ON SEQUENCE public.stock_history_id_seq TO service_role;

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view store stock history" ON public.stock_history;
CREATE POLICY "Owners can view store stock history" ON public.stock_history
FOR SELECT TO authenticated USING (public.is_store_owner(auth.uid(), store_id));

DROP POLICY IF EXISTS "Store members can insert stock history" ON public.stock_history;
CREATE POLICY "Store members can insert stock history" ON public.stock_history
FOR INSERT TO authenticated WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Owners can delete stock history" ON public.stock_history;
CREATE POLICY "Owners can delete stock history" ON public.stock_history
FOR DELETE TO authenticated USING (public.is_store_owner(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.apply_inventory_change(
  p_variant_id BIGINT,
  p_new_qty INT,
  p_type public.stock_history_type,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before INT := 0;
  v_store UUID;
  v_product_id BIGINT;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_user UUID := auth.uid();
  v_user_name TEXT;
  v_existed BOOLEAN := false;
BEGIN
  SELECT quantity, store_id INTO v_before, v_store FROM public.inventory WHERE variant_id = p_variant_id;
  IF FOUND THEN
    v_existed := true;
  ELSE
    v_before := 0;
    SELECT v.store_id INTO v_store FROM public.variants v WHERE v.id = p_variant_id;
  END IF;

  SELECT v.name, v.product_id, p.name INTO v_variant_name, v_product_id, v_product_name
    FROM public.variants v JOIN public.products p ON p.id = v.product_id
    WHERE v.id = p_variant_id;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Variant % has no store', p_variant_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.store_members WHERE user_id = v_user AND store_id = v_store) THEN
    RAISE EXCEPTION 'Not a member of this store';
  END IF;

  IF v_existed THEN
    UPDATE public.inventory SET quantity = p_new_qty, updated_at = now() WHERE variant_id = p_variant_id;
  ELSE
    INSERT INTO public.inventory(variant_id, quantity, store_id) VALUES (p_variant_id, p_new_qty, v_store);
  END IF;

  SELECT COALESCE(NULLIF(name,''), email) INTO v_user_name FROM public.profiles WHERE id = v_user;

  INSERT INTO public.stock_history(
    store_id, product_id, variant_id, product_name, variant_name,
    movement_type, qty_before, qty_change, qty_after, user_id, user_name, notes
  ) VALUES (
    v_store, v_product_id, p_variant_id, v_product_name, v_variant_name,
    p_type, v_before, p_new_qty - v_before, p_new_qty, v_user, v_user_name, p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_inventory_change(BIGINT, INT, public.stock_history_type, TEXT) TO authenticated;

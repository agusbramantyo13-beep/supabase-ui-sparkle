ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS client_txn_id uuid,
  ADD COLUMN IF NOT EXISTS client_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_offline_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_review_required boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_txn_id_unique
  ON public.sales (client_txn_id)
  WHERE client_txn_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_store_client_created_at
  ON public.sales (store_id, client_created_at)
  WHERE is_offline_sync = true;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS stock_shortage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_after_sync integer;

CREATE OR REPLACE FUNCTION public.sync_offline_sale(payload jsonb)
RETURNS TABLE (
  sale_id uuid,
  receipt_number text,
  created_at timestamptz,
  member_points_after integer,
  stock_review_required boolean,
  already_synced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_client_txn_id uuid;
  v_store_id uuid;
  v_cashier_id uuid;
  v_member_id uuid;
  v_sale_id uuid;
  v_receipt_number text;
  v_client_created_at timestamptz;
  v_effective_created_at timestamptz;
  v_subtotal numeric;
  v_discount_total numeric;
  v_total numeric;
  v_tax_total numeric;
  v_payment_method text;
  v_payment_details jsonb;
  v_items jsonb;
  v_item jsonb;
  v_variant public.variants%ROWTYPE;
  v_product_name text;
  v_current_qty integer;
  v_after_qty integer;
  v_cost numeric;
  v_qty numeric;
  v_unit_price numeric;
  v_item_total numeric;
  v_computed_subtotal numeric := 0;
  v_stock_review boolean := false;
  v_points_earned integer := 0;
  v_points_redeemed integer := 0;
  v_points_before integer := 0;
  v_points_after integer;
  v_member_total numeric := 0;
  v_rule record;
  v_rule_base numeric;
  v_existing public.sales%ROWTYPE;
  v_user_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi pengguna tidak tersedia' USING ERRCODE = '28000';
  END IF;

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload transaksi tidak valid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_client_txn_id := (payload->>'client_txn_id')::uuid;
    v_store_id := (payload->>'store_id')::uuid;
    v_cashier_id := (payload->>'cashier_user_id')::uuid;
    v_member_id := NULLIF(payload->>'member_id', '')::uuid;
    v_client_created_at := (payload->>'client_created_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Identitas transaksi offline tidak valid' USING ERRCODE = '22023';
  END;

  IF v_client_txn_id IS NULL OR v_store_id IS NULL OR v_cashier_id IS NULL OR v_client_created_at IS NULL THEN
    RAISE EXCEPTION 'Identitas transaksi offline tidak lengkap' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.sales
  WHERE client_txn_id = v_client_txn_id;

  IF FOUND THEN
    IF v_existing.store_id IS DISTINCT FROM v_store_id THEN
      RAISE EXCEPTION 'Identitas transaksi sudah digunakan toko lain' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.receipt_number, v_existing.created_at,
      v_existing.member_points_after, v_existing.stock_review_required, true;
    RETURN;
  END IF;

  IF v_cashier_id <> v_user THEN
    RAISE EXCEPTION 'Kasir transaksi tidak sesuai sesi aktif' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_developer(v_user)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.user_id = v_user AND sm.store_id = v_store_id
    )
  ) THEN
    RAISE EXCEPTION 'Tidak berhak menyinkronkan transaksi toko ini' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = v_store_id) THEN
    RAISE EXCEPTION 'Toko tidak ditemukan' USING ERRCODE = '23503';
  END IF;

  IF v_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = v_member_id AND m.store_id = v_store_id
  ) THEN
    RAISE EXCEPTION 'Member tidak ditemukan pada toko aktif' USING ERRCODE = '23503';
  END IF;

  v_receipt_number := NULLIF(btrim(payload->>'receipt_number'), '');
  v_payment_method := NULLIF(btrim(payload->>'payment_method'), '');
  v_payment_details := COALESCE(payload->'payment_details', '{}'::jsonb);
  v_items := payload->'items';
  v_subtotal := COALESCE((payload->>'subtotal')::numeric, 0);
  v_discount_total := COALESCE((payload->>'discount_total')::numeric, 0);
  v_tax_total := COALESCE((payload->>'tax_total')::numeric, 0);
  v_total := COALESCE((payload->>'total')::numeric, 0);
  v_points_redeemed := GREATEST(0, COALESCE((payload->>'redeemed_points')::integer, 0));

  IF v_receipt_number IS NULL OR v_payment_method NOT IN ('cash', 'card', 'split', 'qris', 'transfer') THEN
    RAISE EXCEPTION 'Nomor nota atau metode pembayaran tidak valid' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Item transaksi tidak boleh kosong' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_unit_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_item_total := COALESCE((v_item->>'total')::numeric, 0);

    IF v_qty <= 0 OR trunc(v_qty) <> v_qty OR v_unit_price < 0 OR v_item_total < 0 THEN
      RAISE EXCEPTION 'Jumlah atau harga item tidak valid' USING ERRCODE = '22023';
    END IF;

    IF abs(v_item_total - (v_qty * v_unit_price)) > 0.01 THEN
      RAISE EXCEPTION 'Total item tidak sesuai jumlah dan harga' USING ERRCODE = '22023';
    END IF;

    SELECT v.* INTO v_variant
    FROM public.variants v
    WHERE v.id = (v_item->>'variant_id')::bigint
      AND v.store_id = v_store_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Varian % tidak ditemukan pada toko aktif', v_item->>'variant_id' USING ERRCODE = '23503';
    END IF;

    v_computed_subtotal := v_computed_subtotal + v_item_total;
  END LOOP;

  IF abs(v_subtotal - v_computed_subtotal) > 0.01
     OR v_discount_total < 0
     OR v_tax_total < 0
     OR abs(v_total - (v_subtotal - v_discount_total + v_tax_total)) > 0.01
     OR v_total < 0 THEN
    RAISE EXCEPTION 'Ringkasan total transaksi tidak konsisten' USING ERRCODE = '22023';
  END IF;

  v_effective_created_at := LEAST(v_client_created_at, now());

  INSERT INTO public.sales (
    receipt_number, user_id, subtotal, discount_total, tax_total, total,
    payment_method, payment_details, created_at, status, store_id, member_id,
    client_txn_id, client_created_at, is_offline_sync, synced_at, stock_review_required
  ) VALUES (
    v_receipt_number, v_user, v_subtotal, v_discount_total, v_tax_total, v_total,
    v_payment_method, v_payment_details, v_effective_created_at, 'completed', v_store_id, v_member_id,
    v_client_txn_id, v_client_created_at, true, now(), false
  )
  ON CONFLICT (client_txn_id) WHERE client_txn_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_sale_id;

  IF v_sale_id IS NULL THEN
    SELECT * INTO v_existing FROM public.sales WHERE client_txn_id = v_client_txn_id;
    RETURN QUERY SELECT v_existing.id, v_existing.receipt_number, v_existing.created_at,
      v_existing.member_points_after, v_existing.stock_review_required, true;
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(p.name, ''), p.email) INTO v_user_name
  FROM public.profiles p WHERE p.id = v_user;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_item_total := (v_item->>'total')::numeric;

    SELECT v.* INTO v_variant
    FROM public.variants v
    WHERE v.id = (v_item->>'variant_id')::bigint
      AND v.store_id = v_store_id;

    SELECT p.name INTO v_product_name FROM public.products p WHERE p.id = v_variant.product_id;
    v_cost := COALESCE(v_variant.average_cost, v_variant.cost_price, 0);

    SELECT i.quantity INTO v_current_qty
    FROM public.inventory i
    WHERE i.variant_id = v_variant.id AND i.store_id = v_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_current_qty := 0;
      INSERT INTO public.inventory (variant_id, quantity, store_id)
      VALUES (v_variant.id, 0, v_store_id)
      ON CONFLICT DO NOTHING;
      SELECT COALESCE(i.quantity, 0) INTO v_current_qty
      FROM public.inventory i
      WHERE i.variant_id = v_variant.id AND i.store_id = v_store_id
      FOR UPDATE;
    END IF;

    v_after_qty := COALESCE(v_current_qty, 0) - v_qty::integer;
    IF v_after_qty < 0 THEN v_stock_review := true; END IF;

    INSERT INTO public.sale_items (
      sale_id, variant_id, quantity, unit_price, cost_price, discount, total,
      product_snapshot, stock_shortage, stock_after_sync
    ) VALUES (
      v_sale_id, v_variant.id, v_qty, v_unit_price, v_cost, 0, v_item_total,
      jsonb_build_object(
        'name', COALESCE(NULLIF(v_item->>'display_name', ''), v_product_name || ' - ' || v_variant.name),
        'product_name', v_product_name,
        'variant_name', v_variant.name,
        'price', v_unit_price,
        'offline', true
      ),
      v_after_qty < 0,
      v_after_qty
    );

    UPDATE public.inventory
    SET quantity = v_after_qty, updated_at = now()
    WHERE variant_id = v_variant.id AND store_id = v_store_id;

    INSERT INTO public.stock_history (
      store_id, product_id, variant_id, product_name, variant_name,
      movement_type, qty_before, qty_change, qty_after, user_id, user_name, notes, created_at
    ) VALUES (
      v_store_id, v_variant.product_id, v_variant.id, v_product_name, v_variant.name,
      'sale', COALESCE(v_current_qty, 0), -v_qty::integer, v_after_qty,
      v_user, v_user_name, 'Sinkronisasi penjualan offline ' || v_receipt_number, v_effective_created_at
    );
  END LOOP;

  IF v_member_id IS NOT NULL THEN
    SELECT COALESCE(m.points, 0), COALESCE(m.total_purchases, 0)
      INTO v_points_before, v_member_total
    FROM public.members m
    WHERE m.id = v_member_id AND m.store_id = v_store_id
    FOR UPDATE;

    FOR v_rule IN
      SELECT r.* FROM public.loyalty_point_rules r
      WHERE r.store_id = v_store_id AND r.active = true
        AND (r.applies_to = 'global' OR r.applies_to = 'product')
    LOOP
      IF v_rule.applies_to = 'global' THEN
        v_rule_base := v_total;
      ELSE
        SELECT COALESCE(SUM((x.value->>'total')::numeric), 0)
          INTO v_rule_base
        FROM jsonb_array_elements(v_items) x
        WHERE x.value->>'variant_id' = v_rule.target_id;
      END IF;

      IF v_rule_base >= v_rule.min_purchase THEN
        IF v_rule.is_multiple AND v_rule.min_purchase > 0 THEN
          v_points_earned := v_points_earned + v_rule.points_earned * floor(v_rule_base / v_rule.min_purchase)::integer;
        ELSE
          v_points_earned := v_points_earned + v_rule.points_earned;
        END IF;
      END IF;
    END LOOP;

    v_points_redeemed := LEAST(v_points_redeemed, v_points_before);
    v_points_after := GREATEST(0, v_points_before - v_points_redeemed + v_points_earned);

    UPDATE public.members
    SET points = v_points_after,
        total_purchases = v_member_total + v_total,
        updated_at = now()
    WHERE id = v_member_id;

    UPDATE public.sales SET member_points_after = v_points_after WHERE id = v_sale_id;
  END IF;

  IF v_stock_review THEN
    UPDATE public.sales SET stock_review_required = true WHERE id = v_sale_id;
  END IF;

  RETURN QUERY
  SELECT s.id, s.receipt_number, s.created_at, s.member_points_after,
    s.stock_review_required, false
  FROM public.sales s
  WHERE s.id = v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_offline_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_offline_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_sale(jsonb) TO service_role;
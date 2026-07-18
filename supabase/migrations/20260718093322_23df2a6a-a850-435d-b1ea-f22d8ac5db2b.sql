
DROP POLICY IF EXISTS profiles_delete_by_owner ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
DROP POLICY IF EXISTS profiles_update_by_owner ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_safe ON public.profiles;
DROP POLICY IF EXISTS store_members_delete ON public.store_members;
DROP POLICY IF EXISTS store_members_insert ON public.store_members;
DROP POLICY IF EXISTS store_members_select ON public.store_members;
DROP POLICY IF EXISTS store_members_update ON public.store_members;
DROP POLICY IF EXISTS stores_delete ON public.stores;
DROP POLICY IF EXISTS stores_insert ON public.stores;
DROP POLICY IF EXISTS stores_select ON public.stores;
DROP POLICY IF EXISTS stores_select_creator ON public.stores;
DROP POLICY IF EXISTS stores_update ON public.stores;
DROP POLICY IF EXISTS "Owners can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Audit logs: read by owners" ON public.audit_logs;
DROP POLICY IF EXISTS "Bundle buy items: write by owners" ON public.bundle_promo_buy_items;
DROP POLICY IF EXISTS "Bundle free items: write by owners" ON public.bundle_promo_free_items;
DROP POLICY IF EXISTS "Bundle promos: delete by owners" ON public.bundle_promos;
DROP POLICY IF EXISTS "Bundle promos: insert by owners" ON public.bundle_promos;
DROP POLICY IF EXISTS "Bundle promos: update by owners" ON public.bundle_promos;
DROP POLICY IF EXISTS "Discounts: delete by owners" ON public.discounts;
DROP POLICY IF EXISTS "Discounts: insert by owners" ON public.discounts;
DROP POLICY IF EXISTS "Discounts: update by owners" ON public.discounts;
DROP POLICY IF EXISTS "Loyalty rules: delete by owners" ON public.loyalty_point_rules;
DROP POLICY IF EXISTS "Loyalty rules: insert by owners" ON public.loyalty_point_rules;
DROP POLICY IF EXISTS "Loyalty rules: update by owners" ON public.loyalty_point_rules;
DROP POLICY IF EXISTS "Order items: select when order accessible" ON public.order_items;
DROP POLICY IF EXISTS "Orders: select owner_or_own" ON public.orders;
DROP POLICY IF EXISTS "Point redemption rules: delete by owners" ON public.point_redemption_rules;
DROP POLICY IF EXISTS "Point redemption rules: insert by owners" ON public.point_redemption_rules;
DROP POLICY IF EXISTS "Point redemption rules: update by owners" ON public.point_redemption_rules;
DROP POLICY IF EXISTS "Sale items: delete by owners" ON public.sale_items;
DROP POLICY IF EXISTS "Sale items: update by owners" ON public.sale_items;
DROP POLICY IF EXISTS "Sales: delete by owners" ON public.sales;
DROP POLICY IF EXISTS "Sales: update by owners" ON public.sales;
DROP POLICY IF EXISTS "Stock movements: insert by owner_store_keeper" ON public.stock_movements;
DROP POLICY IF EXISTS "Stock transfer items: delete by owners" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Stock transfers: delete by owners" ON public.stock_transfers;
DROP POLICY IF EXISTS "Stock transfers: update by owners" ON public.stock_transfers;
DROP POLICY IF EXISTS "Owners can view all selfies" ON storage.objects;

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TYPE public.user_role RENAME TO user_role_old;
CREATE TYPE public.user_role AS ENUM ('developer','staff');
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.user_role
  USING (CASE WHEN role::text = 'owner' THEN 'developer' ELSE 'staff' END)::public.user_role;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'staff'::public.user_role;
DROP TYPE public.user_role_old;

UPDATE public.store_members SET role = 'cashier' WHERE role = 'store_keeper';
ALTER TABLE public.store_members ALTER COLUMN role SET DEFAULT 'cashier';
ALTER TABLE public.store_members DROP CONSTRAINT IF EXISTS store_members_role_check;
ALTER TABLE public.store_members ADD CONSTRAINT store_members_role_check CHECK (role IN ('owner','cashier'));

CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'developer'::public.user_role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.stores WHERE public.is_developer(_user_id)
  UNION
  SELECT store_id FROM public.store_members WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_store_owner(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_developer(_user_id) OR EXISTS (
    SELECT 1 FROM public.store_members WHERE user_id = _user_id AND store_id = _store_id AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_store_owner_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_developer(_user_id) OR EXISTS (
    SELECT 1 FROM public.store_members WHERE user_id = _user_id AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'staff'::public.user_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_developer(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_store_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_store_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_store_owner_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_developer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_store_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_store_owner_role(uuid) TO authenticated;

CREATE POLICY stores_select ON public.stores FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY stores_insert ON public.stores FOR INSERT TO authenticated
  WITH CHECK (public.is_developer(auth.uid()));
CREATE POLICY stores_update ON public.stores FOR UPDATE TO authenticated
  USING (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), id))
  WITH CHECK (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), id));
CREATE POLICY stores_delete ON public.stores FOR DELETE TO authenticated
  USING (public.is_developer(auth.uid()));

CREATE POLICY store_members_select ON public.store_members FOR SELECT TO authenticated
  USING (public.is_developer(auth.uid()) OR user_id = auth.uid()
         OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY store_members_insert ON public.store_members FOR INSERT TO authenticated
  WITH CHECK (public.is_developer(auth.uid())
              OR (public.is_store_owner(auth.uid(), store_id) AND role = 'cashier'));
CREATE POLICY store_members_update ON public.store_members FOR UPDATE TO authenticated
  USING (public.is_developer(auth.uid())
         OR (public.is_store_owner(auth.uid(), store_id) AND role = 'cashier'))
  WITH CHECK (public.is_developer(auth.uid())
              OR (public.is_store_owner(auth.uid(), store_id) AND role = 'cashier'));
CREATE POLICY store_members_delete ON public.store_members FOR DELETE TO authenticated
  USING (public.is_developer(auth.uid())
         OR (public.is_store_owner(auth.uid(), store_id) AND role = 'cashier'));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_developer(auth.uid()) OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.store_members sm_self
      JOIN public.store_members sm_target ON sm_self.store_id = sm_target.store_id
      WHERE sm_self.user_id = auth.uid() AND sm_self.role = 'owner'
        AND sm_target.user_id = profiles.id AND sm_target.role = 'cashier'
    )
  );
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role <> 'developer'::public.user_role);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND role <> 'developer'::public.user_role);
CREATE POLICY profiles_update_developer ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_developer(auth.uid())) WITH CHECK (public.is_developer(auth.uid()));
CREATE POLICY profiles_delete_developer ON public.profiles FOR DELETE TO authenticated
  USING (public.is_developer(auth.uid()));

CREATE POLICY "Owners can view all attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Audit logs: read by owners" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_store_owner_role(auth.uid()));

CREATE POLICY "Bundle promos: insert by owners" ON public.bundle_promos FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Bundle promos: update by owners" ON public.bundle_promos FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id)) WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Bundle promos: delete by owners" ON public.bundle_promos FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Bundle buy items: write by owners" ON public.bundle_promo_buy_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bundle_promos bp WHERE bp.id = bundle_promo_buy_items.bundle_id AND public.is_store_owner(auth.uid(), bp.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bundle_promos bp WHERE bp.id = bundle_promo_buy_items.bundle_id AND public.is_store_owner(auth.uid(), bp.store_id)));

CREATE POLICY "Bundle free items: write by owners" ON public.bundle_promo_free_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bundle_promos bp WHERE bp.id = bundle_promo_free_items.bundle_id AND public.is_store_owner(auth.uid(), bp.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bundle_promos bp WHERE bp.id = bundle_promo_free_items.bundle_id AND public.is_store_owner(auth.uid(), bp.store_id)));

CREATE POLICY "Discounts: insert by owners" ON public.discounts FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Discounts: update by owners" ON public.discounts FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id)) WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Discounts: delete by owners" ON public.discounts FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Loyalty rules: insert by owners" ON public.loyalty_point_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Loyalty rules: update by owners" ON public.loyalty_point_rules FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id)) WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Loyalty rules: delete by owners" ON public.loyalty_point_rules FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Point redemption rules: insert by owners" ON public.point_redemption_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Point redemption rules: update by owners" ON public.point_redemption_rules FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id)) WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Point redemption rules: delete by owners" ON public.point_redemption_rules FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Orders: select owner_or_own" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_any_store_owner_role(auth.uid()));
CREATE POLICY "Order items: select when order accessible" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.has_any_store_owner_role(auth.uid()))));

CREATE POLICY "Sales: update by owners" ON public.sales FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id)) WITH CHECK (public.is_store_owner(auth.uid(), store_id));
CREATE POLICY "Sales: delete by owners" ON public.sales FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Sale items: update by owners" ON public.sale_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND public.is_store_owner(auth.uid(), s.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND public.is_store_owner(auth.uid(), s.store_id)));
CREATE POLICY "Sale items: delete by owners" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND public.is_store_owner(auth.uid(), s.store_id)));

CREATE POLICY "Stock movements: insert by store members" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));

CREATE POLICY "Stock transfers: update by owners" ON public.stock_transfers FOR UPDATE TO authenticated
  USING (public.is_store_owner(auth.uid(), from_store_id) OR public.is_store_owner(auth.uid(), to_store_id))
  WITH CHECK (public.is_store_owner(auth.uid(), from_store_id) OR public.is_store_owner(auth.uid(), to_store_id));
CREATE POLICY "Stock transfers: delete by owners" ON public.stock_transfers FOR DELETE TO authenticated
  USING (public.is_store_owner(auth.uid(), from_store_id) OR public.is_store_owner(auth.uid(), to_store_id));

CREATE POLICY "Stock transfer items: delete by owners" ON public.stock_transfer_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_transfers st WHERE st.id = stock_transfer_items.transfer_id
                 AND (public.is_store_owner(auth.uid(), st.from_store_id) OR public.is_store_owner(auth.uid(), st.to_store_id))));

CREATE POLICY "Owners can view all selfies" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-selfies' AND public.has_any_store_owner_role(auth.uid()));

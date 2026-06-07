
-- categories
DROP POLICY IF EXISTS "Categories: read all" ON public.categories;
DROP POLICY IF EXISTS "Categories: insert all" ON public.categories;
DROP POLICY IF EXISTS "Categories: update all" ON public.categories;
DROP POLICY IF EXISTS "Categories: delete all" ON public.categories;
CREATE POLICY "categories_select_member" ON public.categories
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "categories_insert_member" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "categories_update_member" ON public.categories
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "categories_delete_member" ON public.categories
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- products
DROP POLICY IF EXISTS "Products: read all" ON public.products;
DROP POLICY IF EXISTS "Products: insert all" ON public.products;
DROP POLICY IF EXISTS "Products: update all" ON public.products;
DROP POLICY IF EXISTS "Products: delete all" ON public.products;
CREATE POLICY "products_select_member" ON public.products
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "products_insert_member" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "products_update_member" ON public.products
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "products_delete_member" ON public.products
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- variants
DROP POLICY IF EXISTS "Variants: read all" ON public.variants;
DROP POLICY IF EXISTS "Variants: insert all" ON public.variants;
DROP POLICY IF EXISTS "Variants: update all" ON public.variants;
DROP POLICY IF EXISTS "Variants: delete all" ON public.variants;
DROP POLICY IF EXISTS "Variants: insert by authenticated" ON public.variants;
DROP POLICY IF EXISTS "Variants: update by authenticated" ON public.variants;
DROP POLICY IF EXISTS "Variants: delete by authenticated" ON public.variants;
CREATE POLICY "variants_select_member" ON public.variants
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "variants_insert_member" ON public.variants
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "variants_update_member" ON public.variants
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "variants_delete_member" ON public.variants
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- inventory
DROP POLICY IF EXISTS "Inventory: read all" ON public.inventory;
DROP POLICY IF EXISTS "Inventory: insert all" ON public.inventory;
DROP POLICY IF EXISTS "Inventory: update all" ON public.inventory;
DROP POLICY IF EXISTS "Inventory: delete all" ON public.inventory;
CREATE POLICY "inventory_select_member" ON public.inventory
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "inventory_insert_member" ON public.inventory
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "inventory_update_member" ON public.inventory
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "inventory_delete_member" ON public.inventory
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- members (customer PII)
DROP POLICY IF EXISTS "Members: read by authenticated users" ON public.members;
DROP POLICY IF EXISTS "Members: insert all" ON public.members;
DROP POLICY IF EXISTS "Members: update all" ON public.members;
DROP POLICY IF EXISTS "Members: delete all" ON public.members;
CREATE POLICY "members_select_member" ON public.members
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "members_insert_member" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "members_update_member" ON public.members
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "members_delete_member" ON public.members
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- profiles (staff)
DROP POLICY IF EXISTS "Profiles: read by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: insert all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: delete all" ON public.profiles;
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role <> 'owner'::user_role);
CREATE POLICY "profiles_update_self_safe" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role <> 'owner'::user_role);
CREATE POLICY "profiles_update_by_owner" ON public.profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner'));
CREATE POLICY "profiles_delete_by_owner" ON public.profiles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner'));

-- users (legacy table) — drop public write/read; keep authenticated read only
DROP POLICY IF EXISTS "Enable delete for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.users;
DROP POLICY IF EXISTS "Users: read by authenticated users" ON public.users;
CREATE POLICY "users_select_auth" ON public.users
  FOR SELECT TO authenticated USING (true);

-- shifts
DROP POLICY IF EXISTS "Shifts: read all" ON public.shifts;
DROP POLICY IF EXISTS "Shifts: insert by authenticated" ON public.shifts;
DROP POLICY IF EXISTS "Shifts: update by authenticated" ON public.shifts;
DROP POLICY IF EXISTS "Shifts: delete by authenticated" ON public.shifts;
CREATE POLICY "shifts_select_member" ON public.shifts
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "shifts_insert_member" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "shifts_update_member" ON public.shifts
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  WITH CHECK (store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "shifts_delete_member" ON public.shifts
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- stock_movements
DROP POLICY IF EXISTS "Stock movements: read all" ON public.stock_movements;
CREATE POLICY "stock_movements_select_member" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- stock_opname_sessions / items (no store_id; restrict to authenticated)
DROP POLICY IF EXISTS "Stock opname sessions: read all" ON public.stock_opname_sessions;
DROP POLICY IF EXISTS "Stock opname sessions: insert by authenticated" ON public.stock_opname_sessions;
DROP POLICY IF EXISTS "Stock opname sessions: update by authenticated" ON public.stock_opname_sessions;
DROP POLICY IF EXISTS "Stock opname sessions: delete by authenticated" ON public.stock_opname_sessions;
CREATE POLICY "stock_opname_sessions_select_auth" ON public.stock_opname_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_opname_sessions_insert_auth" ON public.stock_opname_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stock_opname_sessions_update_auth" ON public.stock_opname_sessions
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_opname_sessions_delete_auth" ON public.stock_opname_sessions
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Stock opname items: read all" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Stock opname items: insert by authenticated" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Stock opname items: update by authenticated" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Stock opname items: delete by authenticated" ON public.stock_opname_items;
CREATE POLICY "stock_opname_items_select_auth" ON public.stock_opname_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_opname_items_insert_auth" ON public.stock_opname_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stock_opname_items_update_auth" ON public.stock_opname_items
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_opname_items_delete_auth" ON public.stock_opname_items
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- purchase_items: scope via purchase_sessions.store_id
DROP POLICY IF EXISTS "Purchase items: read by authenticated" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items: insert by authenticated" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items: update by authenticated" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items: delete by authenticated" ON public.purchase_items;
CREATE POLICY "purchase_items_select_member" ON public.purchase_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_sessions ps WHERE ps.id = session_id
    AND (ps.store_id IS NULL OR ps.store_id IN (SELECT public.get_user_store_ids(auth.uid())))));
CREATE POLICY "purchase_items_insert_member" ON public.purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_sessions ps WHERE ps.id = session_id
    AND ps.store_id IN (SELECT public.get_user_store_ids(auth.uid()))));
CREATE POLICY "purchase_items_update_member" ON public.purchase_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_sessions ps WHERE ps.id = session_id
    AND ps.store_id IN (SELECT public.get_user_store_ids(auth.uid()))));
CREATE POLICY "purchase_items_delete_member" ON public.purchase_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_sessions ps WHERE ps.id = session_id
    AND ps.store_id IN (SELECT public.get_user_store_ids(auth.uid()))));

-- sales / sale_items insert lockdown
DROP POLICY IF EXISTS "Sales: insert all" ON public.sales;
DROP POLICY IF EXISTS "Sale items: insert all" ON public.sale_items;
CREATE POLICY "sales_insert_member" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (store_id IS NULL OR store_id IN (SELECT public.get_user_store_ids(auth.uid())));
CREATE POLICY "sale_items_insert_member" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (s.store_id IS NULL OR s.store_id IN (SELECT public.get_user_store_ids(auth.uid())))));

-- store_members: prevent bootstrap privilege escalation
DROP POLICY IF EXISTS store_members_insert ON public.store_members;
CREATE POLICY store_members_insert ON public.store_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_store_owner(auth.uid(), store_id)
    OR (
      auth.uid() = user_id
      AND NOT public.store_has_members(store_id)
      AND role = 'store_keeper'
    )
  );

-- Views: switch to security invoker
ALTER VIEW public.v_profit_by_date    SET (security_invoker = true);
ALTER VIEW public.v_sales_summary     SET (security_invoker = true);
ALTER VIEW public.v_current_inventory SET (security_invoker = true);

-- SECURITY DEFINER functions: tighten EXECUTE
REVOKE EXECUTE ON FUNCTION public.get_user_store_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_store_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_has_members(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_member_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_store_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_has_members(uuid) TO authenticated;

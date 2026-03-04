
-- 1. Create stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- 2. Create store_members table (links users to stores)
CREATE TABLE public.store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'store_keeper',
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, user_id)
);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- 3. Add store_id to all relevant tables (nullable first for existing data)
ALTER TABLE public.categories ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.variants ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.members ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.discounts ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_point_rules ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.point_redemption_rules ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_sessions ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.stock_adjustment_sessions ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.shifts ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- 4. RLS for stores: users can see stores they belong to
CREATE POLICY "Users can view their stores"
ON public.stores FOR SELECT
USING (
  id IN (SELECT store_id FROM public.store_members WHERE user_id = auth.uid())
);

CREATE POLICY "Owners can create stores"
ON public.stores FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Store owners can update their stores"
ON public.stores FOR UPDATE
USING (
  id IN (SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Store owners can delete their stores"
ON public.stores FOR DELETE
USING (
  id IN (SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- 5. RLS for store_members
CREATE POLICY "Users can view members of their stores"
ON public.store_members FOR SELECT
USING (
  store_id IN (SELECT store_id FROM public.store_members sm WHERE sm.user_id = auth.uid())
);

CREATE POLICY "Store owners can manage members"
ON public.store_members FOR INSERT
WITH CHECK (
  store_id IN (SELECT store_id FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner')
  OR NOT EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.store_id = store_members.store_id)
);

CREATE POLICY "Store owners can update members"
ON public.store_members FOR UPDATE
USING (
  store_id IN (SELECT store_id FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner')
);

CREATE POLICY "Store owners can delete members"
ON public.store_members FOR DELETE
USING (
  store_id IN (SELECT store_id FROM public.store_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner')
);

-- 6. Create indexes for store_id on all tables
CREATE INDEX idx_categories_store ON public.categories(store_id);
CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_variants_store ON public.variants(store_id);
CREATE INDEX idx_inventory_store ON public.inventory(store_id);
CREATE INDEX idx_stock_movements_store ON public.stock_movements(store_id);
CREATE INDEX idx_sales_store ON public.sales(store_id);
CREATE INDEX idx_orders_store ON public.orders(store_id);
CREATE INDEX idx_members_store ON public.members(store_id);
CREATE INDEX idx_discounts_store ON public.discounts(store_id);
CREATE INDEX idx_loyalty_point_rules_store ON public.loyalty_point_rules(store_id);
CREATE INDEX idx_point_redemption_rules_store ON public.point_redemption_rules(store_id);
CREATE INDEX idx_purchase_sessions_store ON public.purchase_sessions(store_id);
CREATE INDEX idx_stock_adjustment_sessions_store ON public.stock_adjustment_sessions(store_id);
CREATE INDEX idx_shifts_store ON public.shifts(store_id);
CREATE INDEX idx_attendance_store ON public.attendance(store_id);
CREATE INDEX idx_store_members_user ON public.store_members(user_id);
CREATE INDEX idx_store_members_store ON public.store_members(store_id);

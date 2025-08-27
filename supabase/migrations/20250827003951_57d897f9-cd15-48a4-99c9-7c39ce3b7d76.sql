-- Security Fixes for Database
-- 1. Fix SECURITY DEFINER function missing search_path
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta->>'full_name', 'shopkeeper', now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2. Enable RLS on tables that are missing it
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for core business tables

-- Categories (readable by all authenticated users, manageable by owners)
CREATE POLICY "Categories: read all" ON public.categories
FOR SELECT USING (true);

CREATE POLICY "Categories: manage by owner" ON public.categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Products (readable by all authenticated users, manageable by owners/managers)
CREATE POLICY "Products: read all" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Products: manage by owner" ON public.products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

-- Product Variants (same as products)
CREATE POLICY "Product variants: read all" ON public.product_variants
FOR SELECT USING (true);

CREATE POLICY "Product variants: manage by owner" ON public.product_variants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

-- Variants (legacy table - same as products)
CREATE POLICY "Variants: read all" ON public.variants
FOR SELECT USING (true);

CREATE POLICY "Variants: manage by authorized" ON public.variants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

-- Sales (readable by owners, insertable by cashiers/shopkeepers)
CREATE POLICY "Sales: read by owner" ON public.sales
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

CREATE POLICY "Sales: create by cashier" ON public.sales
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper', 'cashier')
  )
);

-- Sale Items (same access as sales)
CREATE POLICY "Sale items: read by owner" ON public.sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

CREATE POLICY "Sale items: create by cashier" ON public.sale_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper', 'cashier')
  )
);

-- Discounts (manageable by owners/shopkeepers only)
CREATE POLICY "Discounts: read all" ON public.discounts
FOR SELECT USING (true);

CREATE POLICY "Discounts: manage by authorized" ON public.discounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

-- Shifts (manageable by cashiers and above)
CREATE POLICY "Shifts: read own or manage by owner" ON public.shifts
FOR SELECT USING (
  opened_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

CREATE POLICY "Shifts: create by cashier" ON public.shifts
FOR INSERT WITH CHECK (
  opened_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper', 'cashier')
  )
);

CREATE POLICY "Shifts: update own or by owner" ON public.shifts
FOR UPDATE USING (
  opened_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'shopkeeper')
  )
);

-- Stock Opname Sessions (warehouse operations)
CREATE POLICY "Stock opname sessions: read by warehouse staff" ON public.stock_opname_sessions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'shopkeeper')
  )
);

CREATE POLICY "Stock opname sessions: manage by warehouse staff" ON public.stock_opname_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'shopkeeper')
  )
);

-- Stock Opname Items (same as sessions)
CREATE POLICY "Stock opname items: read by warehouse staff" ON public.stock_opname_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'shopkeeper')
  )
);

CREATE POLICY "Stock opname items: manage by warehouse staff" ON public.stock_opname_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'shopkeeper')
  )
);

-- Audit Logs (read-only for owners, system insertable only)
CREATE POLICY "Audit logs: read by owner" ON public.audit_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Note: Audit logs should only be inserted by system triggers, not user applications
-- Security Fixes for Database
-- 1. Fix SECURITY DEFINER functions to use correct enum values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'cashier'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta->>'full_name', 'cashier', now())
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

-- Products (readable by all, manageable by owners)
CREATE POLICY "Products: read all" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Products: manage by owner" ON public.products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Product Variants (same as products)
CREATE POLICY "Product variants: read all" ON public.product_variants
FOR SELECT USING (true);

CREATE POLICY "Product variants: manage by owner" ON public.product_variants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Variants (legacy table - same as products)
CREATE POLICY "Variants: read all" ON public.variants
FOR SELECT USING (true);

CREATE POLICY "Variants: manage by owner" ON public.variants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Sales (readable by owners/warehouse_admin, insertable by all staff)
CREATE POLICY "Sales: read by management" ON public.sales
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

CREATE POLICY "Sales: create by staff" ON public.sales
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'cashier')
  )
);

-- Sale Items (same access as sales)
CREATE POLICY "Sale items: read by management" ON public.sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

CREATE POLICY "Sale items: create by staff" ON public.sale_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'cashier')
  )
);

-- Discounts (manageable by owners only)
CREATE POLICY "Discounts: read all" ON public.discounts
FOR SELECT USING (true);

CREATE POLICY "Discounts: manage by owner" ON public.discounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Shifts (manageable by all staff, readable by management)
CREATE POLICY "Shifts: read own or by management" ON public.shifts
FOR SELECT USING (
  opened_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

CREATE POLICY "Shifts: create by staff" ON public.shifts
FOR INSERT WITH CHECK (
  opened_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin', 'cashier')
  )
);

CREATE POLICY "Shifts: update own or by management" ON public.shifts
FOR UPDATE USING (
  opened_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

-- Stock Opname Sessions (warehouse operations)
CREATE POLICY "Stock opname sessions: read by warehouse staff" ON public.stock_opname_sessions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

CREATE POLICY "Stock opname sessions: manage by warehouse staff" ON public.stock_opname_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

-- Stock Opname Items (same as sessions)
CREATE POLICY "Stock opname items: read by warehouse staff" ON public.stock_opname_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

CREATE POLICY "Stock opname items: manage by warehouse staff" ON public.stock_opname_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'warehouse_admin')
  )
);

-- Audit Logs (read-only for owners)
CREATE POLICY "Audit logs: read by owner" ON public.audit_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);
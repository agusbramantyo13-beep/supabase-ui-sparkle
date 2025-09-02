-- Simplify RLS policies to allow operations without authentication for testing
-- This is for development/testing purposes

-- Update inventory policies to allow operations without strict role requirements
DROP POLICY IF EXISTS "Inventory: insert by owner_warehouse" ON public.inventory;
DROP POLICY IF EXISTS "Inventory: update by owner_warehouse" ON public.inventory;
DROP POLICY IF EXISTS "Inventory: delete by owner_warehouse" ON public.inventory;

CREATE POLICY "Inventory: insert all" 
ON public.inventory 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Inventory: update all" 
ON public.inventory 
FOR UPDATE 
USING (true);

CREATE POLICY "Inventory: delete all" 
ON public.inventory 
FOR DELETE 
USING (true);

-- Allow basic operations on products and categories without authentication for testing
DROP POLICY IF EXISTS "Products: insert by authenticated" ON public.products;
DROP POLICY IF EXISTS "Products: update by authenticated" ON public.products;
DROP POLICY IF EXISTS "Products: delete by authenticated" ON public.products;

CREATE POLICY "Products: insert all" 
ON public.products 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Products: update all" 
ON public.products 
FOR UPDATE 
USING (true);

CREATE POLICY "Products: delete all" 
ON public.products 
FOR DELETE 
USING (true);

-- Update categories policies
DROP POLICY IF EXISTS "Categories: insert by authenticated" ON public.categories;
DROP POLICY IF EXISTS "Categories: update by authenticated" ON public.categories;
DROP POLICY IF EXISTS "Categories: delete by authenticated" ON public.categories;

CREATE POLICY "Categories: insert all" 
ON public.categories 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Categories: update all" 
ON public.categories 
FOR UPDATE 
USING (true);

CREATE POLICY "Categories: delete all" 
ON public.categories 
FOR DELETE 
USING (true);
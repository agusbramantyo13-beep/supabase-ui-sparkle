-- Drop overly permissive policies on sales table
DROP POLICY IF EXISTS "Sales: delete all" ON public.sales;
DROP POLICY IF EXISTS "Sales: update all" ON public.sales;

-- Create restrictive policies - only owners can update/delete sales records
-- This protects financial records from being tampered with by regular employees

-- Owners can update sales (e.g., for returns processing)
CREATE POLICY "Sales: update by owners" 
ON public.sales 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'owner'::user_role
));

-- Owners can delete sales (rarely needed, but available for data corrections)
CREATE POLICY "Sales: delete by owners" 
ON public.sales 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'owner'::user_role
));

-- Also fix sale_items table to match - only owners can update/delete
DROP POLICY IF EXISTS "Sale items: delete by authenticated" ON public.sale_items;
DROP POLICY IF EXISTS "Sale items: update by authenticated" ON public.sale_items;

-- Owners can update sale items
CREATE POLICY "Sale items: update by owners" 
ON public.sale_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'owner'::user_role
));

-- Owners can delete sale items
CREATE POLICY "Sale items: delete by owners" 
ON public.sale_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'owner'::user_role
));
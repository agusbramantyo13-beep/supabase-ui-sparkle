-- Drop existing policies that might conflict and recreate them
DROP POLICY IF EXISTS "Products: read all" ON public.products;
DROP POLICY IF EXISTS "Products: insert by authenticated" ON public.products;
DROP POLICY IF EXISTS "Products: update by authenticated" ON public.products;
DROP POLICY IF EXISTS "Products: delete by authenticated" ON public.products;

-- Enable RLS and add policies for products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products: read all" 
ON public.products 
FOR SELECT 
USING (true);

CREATE POLICY "Products: insert by authenticated" 
ON public.products 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Products: update by authenticated" 
ON public.products 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Products: delete by authenticated" 
ON public.products 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories: read all" 
ON public.categories 
FOR SELECT 
USING (true);

CREATE POLICY "Categories: insert by authenticated" 
ON public.categories 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Categories: update by authenticated" 
ON public.categories 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Categories: delete by authenticated" 
ON public.categories 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add missing RLS policies for product_variants table
CREATE POLICY "Product variants: insert by authenticated" 
ON public.product_variants 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Product variants: update by authenticated" 
ON public.product_variants 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product variants: delete by authenticated" 
ON public.product_variants 
FOR DELETE 
USING (auth.uid() IS NOT NULL);
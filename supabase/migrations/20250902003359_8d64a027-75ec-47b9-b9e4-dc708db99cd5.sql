-- Add remaining missing policies for full functionality
-- Update sales policies to allow operations without authentication for testing
DROP POLICY IF EXISTS "Sales: insert by authenticated" ON public.sales;
DROP POLICY IF EXISTS "Sales: update by authenticated" ON public.sales;
DROP POLICY IF EXISTS "Sales: delete by authenticated" ON public.sales;

CREATE POLICY "Sales: insert all" 
ON public.sales 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Sales: update all" 
ON public.sales 
FOR UPDATE 
USING (true);

CREATE POLICY "Sales: delete all" 
ON public.sales 
FOR DELETE 
USING (true);

-- Add policies for variants table
CREATE POLICY "Variants: insert all" 
ON public.variants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Variants: update all" 
ON public.variants 
FOR UPDATE 
USING (true);

CREATE POLICY "Variants: delete all" 
ON public.variants 
FOR DELETE 
USING (true);

-- Add policies for product_variants table
CREATE POLICY "Product variants: insert all" 
ON public.product_variants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Product variants: update all" 
ON public.product_variants 
FOR UPDATE 
USING (true);

CREATE POLICY "Product variants: delete all" 
ON public.product_variants 
FOR DELETE 
USING (true);
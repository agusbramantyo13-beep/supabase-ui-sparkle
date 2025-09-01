-- Add RLS policies for products table
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

-- Add RLS policies for variants table
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variants: read all" 
ON public.variants 
FOR SELECT 
USING (true);

CREATE POLICY "Variants: insert by authenticated" 
ON public.variants 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Variants: update by authenticated" 
ON public.variants 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Variants: delete by authenticated" 
ON public.variants 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for sales table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales: read all" 
ON public.sales 
FOR SELECT 
USING (true);

CREATE POLICY "Sales: insert by authenticated" 
ON public.sales 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Sales: update by authenticated" 
ON public.sales 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales: delete by authenticated" 
ON public.sales 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for sale_items table
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sale items: read all" 
ON public.sale_items 
FOR SELECT 
USING (true);

CREATE POLICY "Sale items: insert by authenticated" 
ON public.sale_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Sale items: update by authenticated" 
ON public.sale_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sale items: delete by authenticated" 
ON public.sale_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for shifts table
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shifts: read all" 
ON public.shifts 
FOR SELECT 
USING (true);

CREATE POLICY "Shifts: insert by authenticated" 
ON public.shifts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Shifts: update by authenticated" 
ON public.shifts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Shifts: delete by authenticated" 
ON public.shifts 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for stock_opname_sessions table
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock opname sessions: read all" 
ON public.stock_opname_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Stock opname sessions: insert by authenticated" 
ON public.stock_opname_sessions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stock opname sessions: update by authenticated" 
ON public.stock_opname_sessions 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stock opname sessions: delete by authenticated" 
ON public.stock_opname_sessions 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add RLS policies for stock_opname_items table
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock opname items: read all" 
ON public.stock_opname_items 
FOR SELECT 
USING (true);

CREATE POLICY "Stock opname items: insert by authenticated" 
ON public.stock_opname_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stock opname items: update by authenticated" 
ON public.stock_opname_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stock opname items: delete by authenticated" 
ON public.stock_opname_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);
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

-- Add remaining policies for variants table
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
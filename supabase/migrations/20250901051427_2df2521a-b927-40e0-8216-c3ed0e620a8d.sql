-- Add RLS policies for sales table (critical - shows in error logs)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales: read all" ON public.sales;
DROP POLICY IF EXISTS "Sales: insert by authenticated" ON public.sales;
DROP POLICY IF EXISTS "Sales: update by authenticated" ON public.sales;
DROP POLICY IF EXISTS "Sales: delete by authenticated" ON public.sales;

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
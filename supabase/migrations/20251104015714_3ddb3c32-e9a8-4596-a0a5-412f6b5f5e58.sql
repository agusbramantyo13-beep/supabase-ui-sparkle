-- Fix discounts table RLS policies and target_id column type

-- 1. Drop existing policies if any
DROP POLICY IF EXISTS "Discounts: read by authenticated users" ON public.discounts;

-- 2. Change target_id from uuid to text to support product IDs (bigint)
ALTER TABLE public.discounts 
ALTER COLUMN target_id TYPE text USING target_id::text;

-- 3. Create comprehensive RLS policies for discounts table

-- Allow owners to insert discounts
CREATE POLICY "Discounts: insert by owners"
ON public.discounts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- Allow owners to update discounts
CREATE POLICY "Discounts: update by owners"
ON public.discounts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- Allow owners to delete discounts
CREATE POLICY "Discounts: delete by owners"
ON public.discounts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- Allow authenticated users to read discounts (for applying them in sales)
CREATE POLICY "Discounts: read by authenticated"
ON public.discounts
FOR SELECT
TO authenticated
USING (true);

-- Add helpful comment
COMMENT ON TABLE public.discounts IS 'Discount management with owner-only write access';
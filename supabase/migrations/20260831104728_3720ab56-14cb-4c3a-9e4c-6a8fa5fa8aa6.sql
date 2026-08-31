ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS receipt_footer text;

DROP POLICY IF EXISTS "stores_update" ON public.stores;
CREATE POLICY "stores_update"
ON public.stores FOR UPDATE
TO authenticated
USING (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), id))
WITH CHECK (public.is_developer(auth.uid()) OR public.is_store_owner(auth.uid(), id));
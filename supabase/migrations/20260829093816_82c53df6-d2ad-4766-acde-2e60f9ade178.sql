DROP POLICY IF EXISTS "Users can view their stores" ON public.stores;
DROP POLICY IF EXISTS stores_select ON public.stores;

CREATE POLICY stores_select ON public.stores
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.get_user_store_ids(auth.uid()))
    OR created_by = auth.uid()
  );
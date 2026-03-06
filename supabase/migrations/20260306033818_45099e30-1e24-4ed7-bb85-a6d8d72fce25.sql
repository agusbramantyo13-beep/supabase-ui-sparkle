
-- Allow store creator to see the store they just created
CREATE POLICY "stores_select_creator" ON public.stores
AS PERMISSIVE FOR SELECT TO authenticated
USING (created_by = auth.uid());


-- Drop all existing RESTRICTIVE policies on stores
DROP POLICY IF EXISTS "Owners can create stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can delete their stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can update their stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view their stores" ON public.stores;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Owners can create stores" ON public.stores
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their stores" ON public.stores
FOR SELECT TO authenticated
USING (id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "Store owners can update their stores" ON public.stores
FOR UPDATE TO authenticated
USING (is_store_owner(auth.uid(), id));

CREATE POLICY "Store owners can delete their stores" ON public.stores
FOR DELETE TO authenticated
USING (is_store_owner(auth.uid(), id));

-- Also fix store_members INSERT policy to allow first store creation
DROP POLICY IF EXISTS "Store owners can manage members" ON public.store_members;

CREATE POLICY "Store owners can manage members" ON public.store_members
FOR INSERT TO authenticated
WITH CHECK (
  is_store_owner(auth.uid(), store_id)
  OR (auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM store_members sm WHERE sm.store_id = store_members.store_id))
);

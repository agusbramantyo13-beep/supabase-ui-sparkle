
-- Drop ALL existing policies on stores (both old and new names)
DROP POLICY IF EXISTS "Owners can create stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can delete their stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can update their stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view their stores" ON public.stores;
DROP POLICY IF EXISTS "Allow authenticated users to create stores" ON public.stores;
DROP POLICY IF EXISTS "Allow users to view their own stores" ON public.stores;
DROP POLICY IF EXISTS "Allow owners to update their stores" ON public.stores;
DROP POLICY IF EXISTS "Allow owners to delete their stores" ON public.stores;

-- Recreate as PERMISSIVE (default) policies
CREATE POLICY "stores_insert" ON public.stores
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "stores_select" ON public.stores
FOR SELECT TO authenticated
USING (id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "stores_update" ON public.stores
FOR UPDATE TO authenticated
USING (is_store_owner(auth.uid(), id));

CREATE POLICY "stores_delete" ON public.stores
FOR DELETE TO authenticated
USING (is_store_owner(auth.uid(), id));

-- Fix store_members policies too
DROP POLICY IF EXISTS "Store owners can manage members" ON public.store_members;
DROP POLICY IF EXISTS "Store owners can delete members" ON public.store_members;
DROP POLICY IF EXISTS "Store owners can update members" ON public.store_members;
DROP POLICY IF EXISTS "Users can view members of their stores" ON public.store_members;

CREATE POLICY "store_members_insert" ON public.store_members
FOR INSERT TO authenticated
WITH CHECK (
  is_store_owner(auth.uid(), store_id)
  OR (auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM store_members sm WHERE sm.store_id = store_members.store_id))
);

CREATE POLICY "store_members_select" ON public.store_members
FOR SELECT TO authenticated
USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "store_members_update" ON public.store_members
FOR UPDATE TO authenticated
USING (is_store_owner(auth.uid(), store_id));

CREATE POLICY "store_members_delete" ON public.store_members
FOR DELETE TO authenticated
USING (is_store_owner(auth.uid(), store_id));

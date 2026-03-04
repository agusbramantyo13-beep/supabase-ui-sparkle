
-- Fix recursive RLS on store_members with security definer function
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.store_members WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_store_owner(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE user_id = _user_id AND store_id = _store_id AND role = 'owner'
  );
$$;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view members of their stores" ON public.store_members;
DROP POLICY IF EXISTS "Store owners can manage members" ON public.store_members;
DROP POLICY IF EXISTS "Store owners can update members" ON public.store_members;
DROP POLICY IF EXISTS "Store owners can delete members" ON public.store_members;
DROP POLICY IF EXISTS "Users can view their stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can update their stores" ON public.stores;
DROP POLICY IF EXISTS "Store owners can delete their stores" ON public.stores;

-- Recreate with security definer functions
CREATE POLICY "Users can view their stores"
ON public.stores FOR SELECT
USING (id IN (SELECT public.get_user_store_ids(auth.uid())));

CREATE POLICY "Store owners can update their stores"
ON public.stores FOR UPDATE
USING (public.is_store_owner(auth.uid(), id));

CREATE POLICY "Store owners can delete their stores"
ON public.stores FOR DELETE
USING (public.is_store_owner(auth.uid(), id));

CREATE POLICY "Users can view members of their stores"
ON public.store_members FOR SELECT
USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

CREATE POLICY "Store owners can manage members"
ON public.store_members FOR INSERT
WITH CHECK (
  public.is_store_owner(auth.uid(), store_id)
  OR NOT EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.store_id = store_members.store_id)
);

CREATE POLICY "Store owners can update members"
ON public.store_members FOR UPDATE
USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Store owners can delete members"
ON public.store_members FOR DELETE
USING (public.is_store_owner(auth.uid(), store_id));

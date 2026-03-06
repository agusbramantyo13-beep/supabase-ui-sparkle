
-- Create security definer function to check if store has any members
CREATE OR REPLACE FUNCTION public.store_has_members(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members WHERE store_id = _store_id
  );
$$;

-- Drop old insert policy
DROP POLICY IF EXISTS "store_members_insert" ON public.store_members;

-- Recreate without direct subquery on store_members
CREATE POLICY "store_members_insert" ON public.store_members
FOR INSERT TO authenticated
WITH CHECK (
  is_store_owner(auth.uid(), store_id)
  OR (auth.uid() = user_id AND NOT store_has_members(store_id))
);

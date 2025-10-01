-- Drop ALL policies that might depend on the role column
DROP POLICY IF EXISTS "Stock movements: insert by owner_warehouse" ON public.stock_movements;
DROP POLICY IF EXISTS "Orders: select owner_or_own" ON public.orders;
DROP POLICY IF EXISTS "Order items: select when order accessible" ON public.order_items;

-- Update existing data to match new roles
UPDATE public.profiles 
SET role = 'owner'::text::user_role 
WHERE role IN ('cashier'::user_role, 'warehouse_admin'::user_role);

-- Drop the old enum and create new one with correct values
ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM ('owner', 'store_keeper');

-- Update the profiles table to use the new enum
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING role::text::user_role,
  ALTER COLUMN role SET DEFAULT 'store_keeper'::user_role;

-- Drop the old enum type
DROP TYPE user_role_old;

-- Recreate policies with new role values
CREATE POLICY "Stock movements: insert by owner_store_keeper"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY['owner'::user_role, 'store_keeper'::user_role])
  )
);

CREATE POLICY "Orders: select owner_or_own"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'owner'::user_role
  )) OR (auth.uid() = user_id)
);

CREATE POLICY "Order items: select when order accessible"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'owner'::user_role
        )
      )
  )
);

-- Update the handle_new_user function to set default role as store_keeper
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email,
    'store_keeper'::user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = COALESCE(profiles.role, EXCLUDED.role);
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$;
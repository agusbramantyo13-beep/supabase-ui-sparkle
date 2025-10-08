-- Fix critical data exposure issues by restricting public access
-- This fixes 3 ERROR-level security findings

-- 1. Fix profiles table - restrict to authenticated users only
DROP POLICY IF EXISTS "Profiles: read all" ON public.profiles;

CREATE POLICY "Profiles: read by authenticated users"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Fix members table - restrict to authenticated users only (staff access)
DROP POLICY IF EXISTS "Members: read all" ON public.members;

CREATE POLICY "Members: read by authenticated users"
ON public.members
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Fix sales table - restrict to authenticated users only
DROP POLICY IF EXISTS "Sales: read all" ON public.sales;

CREATE POLICY "Sales: read by authenticated users"
ON public.sales
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. Fix sale_items table - restrict to authenticated users only
DROP POLICY IF EXISTS "Sale items: read all" ON public.sale_items;

CREATE POLICY "Sale items: read by authenticated users"
ON public.sale_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 5. Fix discounts table - restrict to authenticated users only
DROP POLICY IF EXISTS "Discounts: read all" ON public.discounts;

CREATE POLICY "Discounts: read by authenticated users"
ON public.discounts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 6. Add audit_logs policies for owners only
CREATE POLICY "Audit logs: read by owners"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- Comments explaining the security posture
COMMENT ON POLICY "Profiles: read by authenticated users" ON public.profiles IS 'Protects employee email addresses from public access';
COMMENT ON POLICY "Members: read by authenticated users" ON public.members IS 'Protects customer PII (names, emails, phone numbers, addresses, DOB) from public access';
COMMENT ON POLICY "Sales: read by authenticated users" ON public.sales IS 'Protects sales transaction history and revenue data from competitors';
COMMENT ON POLICY "Sale items: read by authenticated users" ON public.sale_items IS 'Protects detailed transaction items from public access';
COMMENT ON POLICY "Discounts: read by authenticated users" ON public.discounts IS 'Protects discount strategy from competitors';
COMMENT ON POLICY "Audit logs: read by owners" ON public.audit_logs IS 'Audit logs accessible only to owners for security monitoring';
-- Fix audit_logs security issue by adding RLS policies for owner-only access

-- Create policy to allow only owners to read audit logs
CREATE POLICY "Audit logs: read by owner only" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'owner'::user_role
  )
);

-- Create policy to allow only owners to insert audit logs (if needed by system)
CREATE POLICY "Audit logs: insert by owner only" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'owner'::user_role
  )
);
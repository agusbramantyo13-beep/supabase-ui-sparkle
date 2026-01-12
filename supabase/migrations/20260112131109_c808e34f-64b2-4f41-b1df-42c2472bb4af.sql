-- Drop the overly permissive read policy on users table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

-- Create a new policy that requires authentication to read user data
CREATE POLICY "Users: read by authenticated users" 
ON public.users 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
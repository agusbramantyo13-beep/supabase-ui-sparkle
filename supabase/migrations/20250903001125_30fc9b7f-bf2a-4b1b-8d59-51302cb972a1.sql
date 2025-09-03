-- Update RLS policies for profiles table to allow administrative access
-- This enables the Users page to work without authentication

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Profiles: read own" ON profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON profiles;

-- Create new policies that allow all access for administrative purposes
CREATE POLICY "Profiles: read all" 
ON profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Profiles: update all" 
ON profiles 
FOR UPDATE 
USING (true);

CREATE POLICY "Profiles: insert all" 
ON profiles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Profiles: delete all" 
ON profiles 
FOR DELETE 
USING (true);
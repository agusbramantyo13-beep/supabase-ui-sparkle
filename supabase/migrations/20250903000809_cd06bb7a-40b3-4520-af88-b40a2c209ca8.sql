-- Fix RLS policy for sale_items to allow unauthenticated inserts
-- This matches the behavior of the sales table for POS functionality

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Sale items: insert by authenticated" ON sale_items;

-- Create a new policy that allows all inserts (matching sales table)
CREATE POLICY "Sale items: insert all" 
ON sale_items 
FOR INSERT 
WITH CHECK (true);
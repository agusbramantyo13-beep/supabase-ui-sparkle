-- Fix the data type mismatch between variants.id (bigint) and sale_items.variant_id (uuid)
-- Change sale_items.variant_id to bigint to match variants.id
ALTER TABLE public.sale_items 
ALTER COLUMN variant_id TYPE bigint USING variant_id::text::bigint;
-- Fix the data type mismatch for sale_items.variant_id
-- Change from uuid to bigint to match variants.id

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_variant_id_fkey;

-- Change the column type from uuid to bigint
ALTER TABLE sale_items ALTER COLUMN variant_id TYPE bigint USING variant_id::text::bigint;

-- Re-add the foreign key constraint
ALTER TABLE sale_items 
ADD CONSTRAINT sale_items_variant_id_fkey 
FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL;
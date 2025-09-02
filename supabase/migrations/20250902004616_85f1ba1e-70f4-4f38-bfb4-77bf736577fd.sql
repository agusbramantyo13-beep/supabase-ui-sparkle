-- Clean up database relationships and add proper foreign key constraints

-- First, let's add proper foreign key constraints that may be missing
-- Add foreign key from products to categories
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'products_category_id_fkey' 
        AND table_name = 'products'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key from variants to products
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'variants_product_id_fkey' 
        AND table_name = 'variants'
    ) THEN
        ALTER TABLE variants 
        ADD CONSTRAINT variants_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key from sale_items to variants
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sale_items_variant_id_fkey' 
        AND table_name = 'sale_items'
    ) THEN
        ALTER TABLE sale_items 
        ADD CONSTRAINT sale_items_variant_id_fkey 
        FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key from sales to profiles (users)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_user_id_fkey' 
        AND table_name = 'sales'
    ) THEN
        ALTER TABLE sales 
        ADD CONSTRAINT sales_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Drop the product_variants table as it's redundant with variants table
DROP TABLE IF EXISTS product_variants CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id ON sale_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
-- Add cost_price column to variants table
ALTER TABLE public.variants 
ADD COLUMN cost_price numeric DEFAULT 0 NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.variants.cost_price IS 'Cost price (modal) per unit for calculating inventory capital value';
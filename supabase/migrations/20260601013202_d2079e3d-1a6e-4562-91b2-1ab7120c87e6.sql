ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_purchase numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

UPDATE public.products p
SET has_variants = true
WHERE (SELECT COUNT(*) FROM public.variants v WHERE v.product_id = p.id) > 1
  AND has_variants = false;
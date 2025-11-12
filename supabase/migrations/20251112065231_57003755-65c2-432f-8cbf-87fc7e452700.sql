-- Merge duplicate inventory rows per variant_id and enforce uniqueness so upserts add quantity instead of creating new rows

-- 1) Consolidate duplicate rows: sum quantities into the oldest row, delete the rest
WITH d AS (
  SELECT
    variant_id,
    MIN(id) AS keep_id,
    SUM(quantity) AS total_qty,
    COUNT(*) AS dup_count
  FROM public.inventory
  WHERE variant_id IS NOT NULL
  GROUP BY variant_id
  HAVING COUNT(*) > 1
)
UPDATE public.inventory i
SET quantity = d.total_qty,
    updated_at = now()
FROM d
WHERE i.id = d.keep_id;

DELETE FROM public.inventory i
USING (
  SELECT id
  FROM (
    SELECT id, variant_id,
           ROW_NUMBER() OVER (PARTITION BY variant_id ORDER BY id) AS rn
    FROM public.inventory
    WHERE variant_id IS NOT NULL
  ) t
  WHERE t.rn > 1
) del
WHERE i.id = del.id;

-- 2) Enforce uniqueness on variant_id (unique index is sufficient for ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS inventory_variant_id_unique_idx
  ON public.inventory (variant_id);

-- 3) Ensure updated_at auto-updates on changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_updated_at'
  ) THEN
    CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;

DROP POLICY IF EXISTS "store_logos_select" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_write" ON storage.objects;

CREATE POLICY "store_logos_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (
    public.is_developer(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.store_id = ((storage.foldername(name))[1])::uuid
    )
  )
);

CREATE POLICY "store_logos_write"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (
    public.is_developer(auth.uid())
    OR public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'store-logos'
  AND (
    public.is_developer(auth.uid())
    OR public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
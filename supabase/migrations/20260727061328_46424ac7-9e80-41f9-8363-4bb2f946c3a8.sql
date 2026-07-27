
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for bucket 'product-images'
DROP POLICY IF EXISTS "product_images_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

CREATE POLICY "product_images_read"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_developer(auth.uid())
    OR public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "product_images_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.is_developer(auth.uid())
    OR public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "product_images_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.is_developer(auth.uid())
    OR public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

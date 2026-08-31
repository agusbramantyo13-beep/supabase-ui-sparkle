ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS receipt_logo text,
  ADD COLUMN IF NOT EXISTS receipt_phone text,
  ADD COLUMN IF NOT EXISTS receipt_whatsapp text,
  ADD COLUMN IF NOT EXISTS receipt_instagram text,
  ADD COLUMN IF NOT EXISTS receipt_custom_text text;
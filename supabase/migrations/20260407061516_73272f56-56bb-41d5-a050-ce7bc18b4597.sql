
-- Stock transfer sessions
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text,
  from_store_id uuid NOT NULL REFERENCES public.stores(id),
  to_store_id uuid NOT NULL REFERENCES public.stores(id),
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Stock transfer items
CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  variant_id bigint REFERENCES public.variants(id),
  product_name text NOT NULL,
  variant_name text NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_transfers
CREATE POLICY "Stock transfers: read by authenticated" ON public.stock_transfers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stock transfers: insert by authenticated" ON public.stock_transfers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stock transfers: update by owners" ON public.stock_transfers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role)
  );

CREATE POLICY "Stock transfers: delete by owners" ON public.stock_transfers
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role)
  );

-- RLS policies for stock_transfer_items
CREATE POLICY "Stock transfer items: read by authenticated" ON public.stock_transfer_items
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stock transfer items: insert by authenticated" ON public.stock_transfer_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stock transfer items: delete by owners" ON public.stock_transfer_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role)
  );

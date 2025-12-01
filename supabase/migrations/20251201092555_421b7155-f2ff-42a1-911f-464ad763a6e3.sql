-- Create table for purchase sessions
CREATE TABLE IF NOT EXISTS public.purchase_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  notes TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for purchase items
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.purchase_sessions(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES public.variants(id) ON DELETE SET NULL,
  product_snapshot JSONB NOT NULL,
  quantity NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_sessions
CREATE POLICY "Purchase sessions: read by authenticated"
  ON public.purchase_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Purchase sessions: insert by authenticated"
  ON public.purchase_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Purchase sessions: update by authenticated"
  ON public.purchase_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Purchase sessions: delete by authenticated"
  ON public.purchase_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for purchase_items
CREATE POLICY "Purchase items: read by authenticated"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Purchase items: insert by authenticated"
  ON public.purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Purchase items: update by authenticated"
  ON public.purchase_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Purchase items: delete by authenticated"
  ON public.purchase_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_purchase_sessions_created_by ON public.purchase_sessions(created_by);
CREATE INDEX idx_purchase_sessions_purchase_date ON public.purchase_sessions(purchase_date);
CREATE INDEX idx_purchase_items_session_id ON public.purchase_items(session_id);
CREATE INDEX idx_purchase_items_variant_id ON public.purchase_items(variant_id);
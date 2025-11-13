-- Create stock adjustment sessions table
CREATE TABLE public.stock_adjustment_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  note TEXT,
  total_value_difference NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed'))
);

-- Create stock adjustment items table
CREATE TABLE public.stock_adjustment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.stock_adjustment_sessions(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES public.variants(id),
  old_quantity NUMERIC NOT NULL DEFAULT 0,
  new_quantity NUMERIC NOT NULL DEFAULT 0,
  quantity_difference NUMERIC NOT NULL DEFAULT 0,
  unit_value NUMERIC NOT NULL DEFAULT 0,
  total_value_difference NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_adjustment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for sessions
CREATE POLICY "Adjustment sessions: read by authenticated"
  ON public.stock_adjustment_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment sessions: insert by authenticated"
  ON public.stock_adjustment_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment sessions: update by authenticated"
  ON public.stock_adjustment_sessions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment sessions: delete by authenticated"
  ON public.stock_adjustment_sessions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS policies for items
CREATE POLICY "Adjustment items: read by authenticated"
  ON public.stock_adjustment_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment items: insert by authenticated"
  ON public.stock_adjustment_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment items: update by authenticated"
  ON public.stock_adjustment_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Adjustment items: delete by authenticated"
  ON public.stock_adjustment_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
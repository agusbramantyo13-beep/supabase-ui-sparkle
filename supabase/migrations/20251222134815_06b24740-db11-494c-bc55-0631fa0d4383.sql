-- Create table for point redemption rules
CREATE TABLE public.point_redemption_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points_required INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT 'discount_percentage', -- discount_percentage, discount_fixed, free_product
  reward_value NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC, -- optional cap for percentage discounts
  min_purchase NUMERIC DEFAULT 0, -- minimum purchase to use this redemption
  active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_redemption_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same pattern as loyalty_point_rules - owner only for CUD)
CREATE POLICY "Point redemption rules: read by authenticated"
ON public.point_redemption_rules
FOR SELECT
USING (true);

CREATE POLICY "Point redemption rules: insert by owners"
ON public.point_redemption_rules
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'owner'::user_role
));

CREATE POLICY "Point redemption rules: update by owners"
ON public.point_redemption_rules
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'owner'::user_role
));

CREATE POLICY "Point redemption rules: delete by owners"
ON public.point_redemption_rules
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'owner'::user_role
));

-- Add trigger for updated_at
CREATE TRIGGER update_point_redemption_rules_updated_at
BEFORE UPDATE ON public.point_redemption_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
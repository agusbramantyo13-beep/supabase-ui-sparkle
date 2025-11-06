-- Create loyalty point rules table
CREATE TABLE public.loyalty_point_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  min_purchase numeric NOT NULL DEFAULT 0,
  points_earned integer NOT NULL DEFAULT 0,
  applies_to applies_to NOT NULL DEFAULT 'global',
  target_id text,
  active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_point_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_point_rules
CREATE POLICY "Loyalty rules: read by authenticated"
ON public.loyalty_point_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Loyalty rules: insert by owners"
ON public.loyalty_point_rules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'::user_role
  )
);

CREATE POLICY "Loyalty rules: update by owners"
ON public.loyalty_point_rules
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'::user_role
  )
);

CREATE POLICY "Loyalty rules: delete by owners"
ON public.loyalty_point_rules
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'owner'::user_role
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_loyalty_point_rules_updated_at
BEFORE UPDATE ON public.loyalty_point_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
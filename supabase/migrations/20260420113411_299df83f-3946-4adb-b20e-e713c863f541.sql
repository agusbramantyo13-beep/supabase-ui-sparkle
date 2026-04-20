-- Create cash_deposits table
CREATE TABLE public.cash_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by uuid,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cash_deposits_store ON public.cash_deposits(store_id);
CREATE INDEX idx_cash_deposits_status ON public.cash_deposits(status);
CREATE INDEX idx_cash_deposits_date ON public.cash_deposits(deposit_date);
CREATE INDEX idx_cash_deposits_submitted_by ON public.cash_deposits(submitted_by);

-- Enable RLS
ALTER TABLE public.cash_deposits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Cash deposits: read by store members"
ON public.cash_deposits
FOR SELECT
TO authenticated
USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

CREATE POLICY "Cash deposits: insert by store members"
ON public.cash_deposits
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND submitted_by = auth.uid()
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Cash deposits: update by owners"
ON public.cash_deposits
FOR UPDATE
TO authenticated
USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Cash deposits: delete by owners"
ON public.cash_deposits
FOR DELETE
TO authenticated
USING (public.is_store_owner(auth.uid(), store_id));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_cash_deposits_updated_at
BEFORE UPDATE ON public.cash_deposits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
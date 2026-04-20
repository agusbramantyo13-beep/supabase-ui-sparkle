-- Create store_expenses table for shopping/expense management
CREATE TABLE public.store_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by UUID,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store expenses: read by store members"
ON public.store_expenses FOR SELECT
TO authenticated
USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "Store expenses: insert by store members"
ON public.store_expenses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND submitted_by = auth.uid() 
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store expenses: update by owners"
ON public.store_expenses FOR UPDATE
TO authenticated
USING (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Store expenses: delete by owners"
ON public.store_expenses FOR DELETE
TO authenticated
USING (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_store_expenses_updated_at
BEFORE UPDATE ON public.store_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
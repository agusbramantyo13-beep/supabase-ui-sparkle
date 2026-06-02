CREATE TABLE public.other_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_sales TO authenticated;
GRANT ALL ON public.other_sales TO service_role;

ALTER TABLE public.other_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Other sales: read by store members"
ON public.other_sales FOR SELECT TO authenticated
USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "Other sales: insert by store members"
ON public.other_sales FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND store_id IN (SELECT get_user_store_ids(auth.uid())));

CREATE POLICY "Other sales: update by owners"
ON public.other_sales FOR UPDATE TO authenticated
USING (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Other sales: delete by owners"
ON public.other_sales FOR DELETE TO authenticated
USING (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_other_sales_updated_at
BEFORE UPDATE ON public.other_sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
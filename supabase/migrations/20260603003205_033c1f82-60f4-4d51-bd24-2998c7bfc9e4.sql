
-- Bundle promo: buy specific items, get specific items free
CREATE TABLE public.bundle_promos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_promos TO authenticated;
GRANT ALL ON public.bundle_promos TO service_role;

ALTER TABLE public.bundle_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bundle promos: read by authenticated"
  ON public.bundle_promos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Bundle promos: insert by owners"
  ON public.bundle_promos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role));

CREATE POLICY "Bundle promos: update by owners"
  ON public.bundle_promos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role));

CREATE POLICY "Bundle promos: delete by owners"
  ON public.bundle_promos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role));

-- Items required to buy (trigger)
CREATE TABLE public.bundle_promo_buy_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundle_promos(id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_promo_buy_items TO authenticated;
GRANT ALL ON public.bundle_promo_buy_items TO service_role;

ALTER TABLE public.bundle_promo_buy_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bundle buy items: read by authenticated"
  ON public.bundle_promo_buy_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bundle buy items: write by owners"
  ON public.bundle_promo_buy_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role));

-- Items given free as reward
CREATE TABLE public.bundle_promo_free_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundle_promos(id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_promo_free_items TO authenticated;
GRANT ALL ON public.bundle_promo_free_items TO service_role;

ALTER TABLE public.bundle_promo_free_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bundle free items: read by authenticated"
  ON public.bundle_promo_free_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bundle free items: write by owners"
  ON public.bundle_promo_free_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'::user_role));

CREATE TRIGGER update_bundle_promos_updated_at
  BEFORE UPDATE ON public.bundle_promos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

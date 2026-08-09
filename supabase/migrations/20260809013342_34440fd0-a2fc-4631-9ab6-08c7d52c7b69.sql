CREATE OR REPLACE FUNCTION public.enforce_price_not_below_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Lewati validasi saat proses Moving Average Cost (average_cost berubah)
  IF TG_OP = 'UPDATE' AND NEW.average_cost IS DISTINCT FROM OLD.average_cost THEN
    RETURN NEW;
  END IF;

  -- Jangan blokir baris lama yang sudah tidak valid selama harga tidak diturunkan lagi
  IF TG_OP = 'UPDATE'
     AND NEW.price = OLD.price
     AND NEW.cost_price = OLD.cost_price THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.cost_price, 0) > 0 AND COALESCE(NEW.price, 0) < NEW.cost_price THEN
    RAISE EXCEPTION 'Harga jual tidak boleh lebih rendah dari harga beli (% < %)', NEW.price, NEW.cost_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variants_price_not_below_cost ON public.variants;
CREATE TRIGGER trg_variants_price_not_below_cost
BEFORE INSERT OR UPDATE ON public.variants
FOR EACH ROW EXECUTE FUNCTION public.enforce_price_not_below_cost();
-- Fix Function Search Path Mutable warnings
-- This ensures functions cannot be exploited through search_path manipulation

-- 1. Fix generate_member_code function
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code text;
  counter int := 1;
BEGIN
  LOOP
    new_code := 'MBR' || LPAD(counter::text, 6, '0');
    
    -- Check if this code already exists
    IF NOT EXISTS (SELECT 1 FROM public.members WHERE member_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
  END LOOP;
END;
$function$;

-- 2. Fix set_member_code function  
CREATE OR REPLACE FUNCTION public.set_member_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.member_code IS NULL OR NEW.member_code = '' THEN
    NEW.member_code := public.generate_member_code();
  END IF;
  RETURN NEW;
END;
$function$;

-- Comments explaining the security posture
COMMENT ON FUNCTION public.generate_member_code() IS 'Fixed search_path to prevent SQL injection attacks';
COMMENT ON FUNCTION public.set_member_code() IS 'Fixed search_path to prevent SQL injection attacks';
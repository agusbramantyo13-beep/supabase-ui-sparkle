BEGIN;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS member_points_earned integer;
DO $migration$
DECLARE
  original_definition text;
  updated_definition text;
  original_acl text;
  original_owner oid;
  target_statement constant text := 'UPDATE public.sales SET member_points_after = v_points_after WHERE id = v_sale_id;';
  replacement_statement constant text := 'UPDATE public.sales SET member_points_after = v_points_after, member_points_earned = v_points_earned WHERE id = v_sale_id;';
BEGIN
  SELECT pg_get_functiondef(oid), proacl::text, proowner
    INTO original_definition, original_acl, original_owner
    FROM pg_proc WHERE oid = 'public.sync_offline_sale(jsonb)'::regprocedure;
  IF md5(original_definition) <> 'e1e77a3897b81c8fd8923919acf34f8c' THEN
    RAISE EXCEPTION 'Live sync_offline_sale definition changed; stop rather than replace newer logic';
  END IF;
  IF (length(original_definition) - length(replace(original_definition, target_statement, ''))) / length(target_statement) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one member snapshot statement';
  END IF;
  updated_definition := replace(original_definition, target_statement, replacement_statement);
  EXECUTE updated_definition;
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = 'public.sync_offline_sale(jsonb)'::regprocedure
      AND (proacl::text IS DISTINCT FROM original_acl OR proowner IS DISTINCT FROM original_owner
        OR pg_get_functiondef(oid) IS DISTINCT FROM updated_definition)
  ) THEN
    RAISE EXCEPTION 'Unexpected function, owner, or ACL change';
  END IF;
END;
$migration$;
COMMIT;
DO $migration$
DECLARE
  r record; src text; candidate text; old_acl aclitem[]; opt text; own text; aclrow record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('v_sale_item_profit','835430e5863e97d584812e8a49a5d1cb'),
    ('get_profit_summary','213f7e0e0586dea2e2a5022c4a3cbd79'),
    ('get_profit_by_period','edc7eba9d317433f625def7ce7a0c5ee'),
    ('get_profit_by_category','86dc254c75f850539f63c13da6074bac'),
    ('get_profit_by_cashier','59c8fba05cc38497b073abcf8323def7'),
    ('get_top_products_profit','c76fbb196187ab308d43224ab2c35488')) t(name,hash)
  LOOP
    IF r.name='v_sale_item_profit' THEN
      IF md5(pg_get_viewdef('public.v_sale_item_profit'::regclass,true))<>r.hash THEN RAISE EXCEPTION 'Legacy hash changed: %',r.name; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname=r.name AND md5(pg_get_functiondef(pr.oid))=r.hash) THEN RAISE EXCEPTION 'Legacy hash changed: %',r.name; END IF;
    END IF;
  END LOOP;
  src:=pg_get_viewdef('public.v_sale_item_profit'::regclass,true);
  IF position('FROM sale_items si' in src)=0 OR position('JOIN sales s ON s.id = si.sale_id' in src)=0 OR position('END AS margin_pct' in src)=0 THEN RAISE EXCEPTION 'Production view pattern mismatch'; END IF;
  candidate:=replace(src,'FROM sale_items si','FROM sales s
 CROSS JOIN LATERAL (
   SELECT array_agg(raw.id ORDER BY raw.total DESC, raw.id ASC) AS ids,
          array_agg(raw.total ORDER BY raw.total DESC, raw.id ASC) AS totals
   FROM public.sale_items raw WHERE raw.sale_id=s.id
 ) st
 CROSS JOIN LATERAL (
   SELECT public.profit_allocate_sale(s.total-s.tax_total,st.totals) AS amounts
   OFFSET 0
 ) al
 CROSS JOIN LATERAL (
   SELECT raw.id,raw.sale_id,raw.variant_id,raw.product_snapshot,raw.quantity,
          raw.cost_price,raw.unit_price,raw.discount,
          COALESCE(al.amounts[u.ord::integer],raw.total) AS total,
          raw.total AS gross_total,
          raw.total-COALESCE(al.amounts[u.ord::integer],raw.total) AS allocated_discount,
          al.amounts IS NULL AS anomaly
   FROM unnest(st.ids) WITH ORDINALITY u(id,ord)
   JOIN public.sale_items raw ON raw.id=u.id
 ) si');
  candidate:=replace(candidate,'JOIN sales s ON s.id = si.sale_id','');
  candidate:=replace(candidate,'END AS margin_pct','END AS margin_pct, si.gross_total, si.allocated_discount, si.anomaly');
  IF candidate=src OR position('MATERIALIZED' in candidate)>0 OR position('profit_allocate_sale' in candidate)=0 THEN RAISE EXCEPTION 'Candidate replacement failed'; END IF;
  SELECT relacl,pg_get_userbyid(relowner),array_to_string(reloptions,',') INTO old_acl,own,opt FROM pg_class WHERE oid='public.v_sale_item_profit_v2'::regclass;
  IF opt<>'security_invoker=true' THEN RAISE EXCEPTION 'Unexpected v2 security options'; END IF;
  EXECUTE 'CREATE VIEW public.v_sale_item_profit_v2b WITH ('||opt||') AS '||candidate;
  EXECUTE format('ALTER VIEW public.v_sale_item_profit_v2b OWNER TO %I',own);
  FOR aclrow IN SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS role_name FROM pg_class cl CROSS JOIN LATERAL aclexplode(cl.relacl) a WHERE cl.oid='public.v_sale_item_profit_v2b'::regclass LOOP
    EXECUTE format('REVOKE ALL ON public.v_sale_item_profit_v2b FROM %s',CASE WHEN aclrow.role_name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(aclrow.role_name) END);
  END LOOP;
  FOR aclrow IN SELECT * FROM aclexplode(old_acl) LOOP
    EXECUTE format('GRANT %s ON public.v_sale_item_profit_v2b TO %s%s',aclrow.privilege_type,CASE WHEN aclrow.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(aclrow.grantee)) END,CASE WHEN aclrow.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
  IF EXISTS (
    (SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid='public.v_sale_item_profit_v2'::regclass AND attnum>0 AND NOT attisdropped
     EXCEPT SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid='public.v_sale_item_profit_v2b'::regclass AND attnum>0 AND NOT attisdropped)
    UNION ALL
    (SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid='public.v_sale_item_profit_v2b'::regclass AND attnum>0 AND NOT attisdropped
     EXCEPT SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid='public.v_sale_item_profit_v2'::regclass AND attnum>0 AND NOT attisdropped)
  ) THEN RAISE EXCEPTION 'Candidate column contract differs'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class a JOIN pg_class b ON b.oid='public.v_sale_item_profit_v2b'::regclass WHERE a.oid='public.v_sale_item_profit_v2'::regclass AND a.relowner=b.relowner AND a.reloptions=b.reloptions AND a.relacl @> b.relacl AND b.relacl @> a.relacl) THEN RAISE EXCEPTION 'Candidate owner/security/ACL differs'; END IF;
END;
$migration$;
/* ROLLBACK candidate only (no legacy/v2 objects or data altered):
DROP VIEW public.v_sale_item_profit_v2b;
Full v2 cleanup, only if separately approved:
DROP FUNCTION public.get_profit_summary_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_period_v2(uuid,date,date,text);
DROP FUNCTION public.get_profit_by_category_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_cashier_v2(uuid,date,date);
DROP FUNCTION public.get_top_products_profit_v2(uuid,date,date,text,integer);
DROP VIEW public.v_sale_item_profit_v2;
DROP FUNCTION public.profit_period_bounds(date,date);
DROP FUNCTION public.profit_period_bucket(text,timestamptz);
DROP FUNCTION public.profit_allocate_sale(numeric,numeric[]);
*/
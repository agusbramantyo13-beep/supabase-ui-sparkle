-- Additive Profit v2; production definitions are copied directly from pg_catalog.
DO $guard$
DECLARE check_row record; actual_hash text;
BEGIN
 FOR check_row IN SELECT * FROM (VALUES ('get_profit_summary','213f7e0e0586dea2e2a5022c4a3cbd79'),('get_profit_by_period','edc7eba9d317433f625def7ce7a0c5ee'),('get_profit_by_category','86dc254c75f850539f63c13da6074bac'),('get_profit_by_cashier','59c8fba05cc38497b073abcf8323def7'),('get_top_products_profit','c76fbb196187ab308d43224ab2c35488')) t(name,hash) LOOP
 SELECT md5(pg_get_functiondef(pr.oid)) INTO actual_hash FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname=check_row.name;
 IF actual_hash IS DISTINCT FROM check_row.hash THEN RAISE EXCEPTION 'Legacy changed: %',check_row.name; END IF;
 END LOOP;
 IF md5(pg_get_viewdef('public.v_sale_item_profit'::regclass,true))<>'835430e5863e97d584812e8a49a5d1cb' THEN RAISE EXCEPTION 'Legacy view changed'; END IF;
 IF to_regclass('public.v_sale_item_profit_v2') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname IN ('profit_allocate_sale','profit_period_bounds','profit_period_bucket','get_profit_summary_v2','get_profit_by_period_v2','get_profit_by_category_v2','get_profit_by_cashier_v2','get_top_products_profit_v2')) THEN RAISE EXCEPTION 'Target already exists'; END IF;
END $guard$;

CREATE FUNCTION public.profit_allocate_sale(n numeric, totals numeric[])
RETURNS numeric[] LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'public'
AS $allocate$
WITH elements AS (SELECT t,ord FROM unnest(totals) WITH ORDINALITY u(t,ord)),
stats AS (SELECT count(*) cnt,sum(t) i,coalesce(bool_or(t IS NULL OR t<0 OR t::text IN ('NaN','Infinity','-Infinity')),false) bad,coalesce(bool_or(round(t,2)<>t),false) subcent FROM elements),
policy AS (SELECT *,CASE
 WHEN totals IS NULL OR cnt=0 OR array_ndims(totals)<>1 OR n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR bad OR i=0 OR n<0 OR n>i+0.01 THEN 'anomaly'
 WHEN abs(n-i)<=0.005 OR (i<n AND n<=i+0.01) THEN 'identity'
 WHEN round(n,2)<>n OR subcent THEN 'anomaly'
 ELSE 'allocate' END mode FROM stats),
rounded AS (SELECT e.ord,e.t,CASE WHEN p.mode='allocate' THEN round(e.t*n/NULLIF(p.i,0),2) ELSE e.t END amount FROM elements e CROSS JOIN policy p),
final AS (SELECT ord,t,CASE WHEN ord=1 THEN amount+n-sum(amount) OVER() ELSE amount END amount FROM rounded)
SELECT CASE WHEN p.mode='anomaly' THEN NULL::numeric[] WHEN p.mode='identity' THEN totals
 WHEN EXISTS(SELECT 1 FROM final WHERE amount<0 OR (t=0 AND amount<>0)) THEN NULL::numeric[]
 ELSE (SELECT array_agg(amount ORDER BY ord) FROM final) END FROM policy p;
$allocate$;
-- No data access: public execution permits security-invoker views and synthetic audit.
REVOKE ALL ON FUNCTION public.profit_allocate_sale(numeric,numeric[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.profit_allocate_sale(numeric,numeric[]) TO PUBLIC;
CREATE FUNCTION public.profit_period_bounds(p_start date,p_end date)
RETURNS TABLE(start_ts timestamptz,end_ts_exclusive timestamptz)
LANGUAGE sql STABLE PARALLEL SAFE SET search_path TO 'public' SET timezone TO 'UTC'
AS $bounds$ SELECT p_start::timestamptz,(p_end+1)::timestamptz; $bounds$;
REVOKE ALL ON FUNCTION public.profit_period_bounds(date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.profit_period_bounds(date,date) TO PUBLIC;
CREATE FUNCTION public.profit_period_bucket(p_group_by text,p_created_at timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE PARALLEL SAFE SET search_path TO 'public' SET timezone TO 'UTC'
AS $bucket$ SELECT date_trunc(p_group_by,p_created_at); $bucket$;
REVOKE ALL ON FUNCTION public.profit_period_bucket(text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.profit_period_bucket(text,timestamptz) TO PUBLIC;

DO $view$
DECLARE source_def text; new_def text; item_columns text; options_text text; owner_name text; acl_row record; grantee_sql text;
BEGIN
 SELECT pg_get_viewdef(cl.oid,true),array_to_string(cl.reloptions,', '),pg_get_userbyid(cl.relowner) INTO source_def,options_text,owner_name FROM pg_class cl WHERE cl.oid='public.v_sale_item_profit'::regclass;
 SELECT string_agg(CASE WHEN at.attname='total' THEN 'COALESCE(al.amounts[u.ord::int], raw.total) AS total' ELSE format('raw.%I',at.attname) END,', ' ORDER BY at.attnum) INTO item_columns FROM pg_attribute at WHERE at.attrelid='public.sale_items'::regclass AND at.attnum>0 AND NOT at.attisdropped;
 IF position('FROM sale_items si' in source_def)=0 THEN RAISE EXCEPTION 'View source pattern missing'; END IF;
 new_def:=replace(source_def,'FROM sale_items si',', si.gross_total, si.allocated_discount, si.anomaly FROM allocated_items si');
 new_def:=format($sql$
 WITH sale_totals AS MATERIALIZED (
 SELECT raw.sale_id,array_agg(raw.id ORDER BY raw.total DESC,raw.id ASC) ids,array_agg(raw.total ORDER BY raw.total DESC,raw.id ASC) totals,s.total-s.tax_total n
 FROM public.sale_items raw JOIN public.sales s ON s.id=raw.sale_id WHERE s.status IS DISTINCT FROM 'returned' GROUP BY raw.sale_id,s.total,s.tax_total
 ), allocations AS MATERIALIZED (SELECT st.*,public.profit_allocate_sale(st.n,st.totals) amounts FROM sale_totals st),
 allocated_items AS (SELECT %s,raw.total gross_total,raw.total-COALESCE(al.amounts[u.ord::int],raw.total) allocated_discount,al.amounts IS NULL anomaly
 FROM allocations al CROSS JOIN LATERAL unnest(al.ids) WITH ORDINALITY u(id,ord) JOIN public.sale_items raw ON raw.id=u.id) %s
 $sql$,item_columns,new_def);
 IF position('allocated_items' in new_def)=0 OR position('profit_allocate_sale' in new_def)=0 THEN RAISE EXCEPTION 'Allocation view pattern missing'; END IF;
 EXECUTE 'CREATE VIEW public.v_sale_item_profit_v2'||CASE WHEN options_text IS NULL THEN '' ELSE ' WITH ('||options_text||')' END||' AS '||new_def;
 EXECUTE format('ALTER VIEW public.v_sale_item_profit_v2 OWNER TO %I',owner_name);
 REVOKE ALL ON public.v_sale_item_profit_v2 FROM PUBLIC,anon,authenticated,service_role;
 FOR acl_row IN SELECT ax.* FROM pg_class cl CROSS JOIN LATERAL aclexplode(coalesce(cl.relacl,acldefault('r',cl.relowner))) ax WHERE cl.oid='public.v_sale_item_profit'::regclass LOOP
 grantee_sql:=CASE WHEN acl_row.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl_row.grantee)) END;
 EXECUTE format('GRANT %s ON public.v_sale_item_profit_v2 TO %s%s',acl_row.privilege_type,grantee_sql,CASE WHEN acl_row.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute old_at LEFT JOIN pg_attribute new_at ON new_at.attrelid='public.v_sale_item_profit_v2'::regclass AND new_at.attnum=old_at.attnum AND NOT new_at.attisdropped WHERE old_at.attrelid='public.v_sale_item_profit'::regclass AND old_at.attnum>0 AND NOT old_at.attisdropped AND (new_at.attname IS DISTINCT FROM old_at.attname OR new_at.atttypid IS DISTINCT FROM old_at.atttypid)) THEN RAISE EXCEPTION 'Legacy view column prefix mismatch'; END IF;
 IF (SELECT count(*) FROM pg_attribute at WHERE at.attrelid='public.v_sale_item_profit_v2'::regclass AND at.attname IN ('gross_total','allocated_discount','anomaly') AND NOT at.attisdropped)<>3 THEN RAISE EXCEPTION 'V2 extra columns missing'; END IF;
END $view$;

DO $rpc$
DECLARE proc record; new_def text; target_name text; signature_sql text; acl_row record; grantee_sql text;
BEGIN
 FOR proc IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname IN ('get_profit_summary','get_profit_by_period','get_profit_by_category','get_profit_by_cashier','get_top_products_profit') LOOP
 target_name:=proc.proname||'_v2'; new_def:=pg_get_functiondef(proc.oid);
 new_def:=replace(new_def,'CREATE OR REPLACE FUNCTION public.'||proc.proname||'(','CREATE FUNCTION public.'||target_name||'(');
 new_def:=replace(new_def,'public.v_sale_item_profit x','public.v_sale_item_profit_v2 x');
 IF proc.proname='get_profit_by_period' THEN
 new_def:=replace(new_def,'date_trunc(%L, x.sale_created_at)','public.profit_period_bucket(%L, x.sale_created_at)');
 new_def:=replace(new_def,'x.sale_created_at >= %L::timestamptz','x.sale_created_at >= (SELECT start_ts FROM public.profit_period_bounds(%L::date, %L::date))');
 new_def:=replace(new_def,'x.sale_created_at < (%L::date + 1)::timestamptz','x.sale_created_at < (SELECT end_ts_exclusive FROM public.profit_period_bounds(%L::date, %L::date))');
 new_def:=replace(new_def,'v_trunc, p_store_id, p_start, p_end);','v_trunc, p_store_id, p_start, p_end, p_start, p_end);');
 IF position('date_trunc(' in new_def)>0 OR position('%L::timestamptz' in new_def)>0 OR (length(new_def)-length(replace(new_def,'%L','')))/2<>6 OR position('v_trunc, p_store_id, p_start, p_end, p_start, p_end);' in new_def)=0 THEN RAISE EXCEPTION 'Period format/bucket replacement failed'; END IF;
 ELSE
 new_def:=replace(new_def,'x.sale_created_at >= p_start::timestamptz','x.sale_created_at >= (SELECT start_ts FROM public.profit_period_bounds(p_start, p_end))');
 new_def:=replace(new_def,'x.sale_created_at < (p_end + 1)::timestamptz','x.sale_created_at < (SELECT end_ts_exclusive FROM public.profit_period_bounds(p_start, p_end))');
 END IF;
 IF position('v_sale_item_profit_v2' in new_def)=0 OR position('v_sale_item_profit x' in new_def)>0 OR position('v_sale_item_profit ' in new_def)>0 OR position('profit_period_bounds' in new_def)=0 OR position('p_start::timestamptz' in new_def)>0 OR position('(p_end + 1)::timestamptz' in new_def)>0 OR position('CREATE FUNCTION public.'||target_name||'(' in new_def)=0 THEN RAISE EXCEPTION 'RPC replacement assertion failed: %',target_name; END IF;
 EXECUTE new_def;
 signature_sql:=format('public.%I(%s)',target_name,pg_get_function_identity_arguments(proc.oid));
 EXECUTE format('ALTER FUNCTION %s OWNER TO %I',signature_sql,pg_get_userbyid(proc.proowner));
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',signature_sql);
 FOR acl_row IN SELECT ax.* FROM aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) ax LOOP
 grantee_sql:=CASE WHEN acl_row.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl_row.grantee)) END;
 EXECUTE format('GRANT %s ON FUNCTION %s TO %s%s',acl_row.privilege_type,signature_sql,grantee_sql,CASE WHEN acl_row.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
 END LOOP;
END $rpc$;

DO $tests$
DECLARE test_row record; got numeric[];
BEGIN
 FOR test_row IN SELECT * FROM (VALUES
 ('negative_residual',0.02::numeric,ARRAY[0.01,0.01,0.01,0.01]::numeric[],NULL::numeric[]),
 ('subcent_identity',0.012,ARRAY[0.006,0.006],ARRAY[0.006,0.006]),('tolerance_above',1.005,ARRAY[1],ARRAY[1]),
 ('free_item',70,ARRAY[100,0],ARRAY[70,0]),('three_round',100,ARRAY[100,100,100],ARRAY[33.34,33.33,33.33]),
 ('zero_net',0,ARRAY[100,50,0],ARRAY[0,0,0]),('zero_sum',0,ARRAY[0,0],NULL::numeric[]),
 ('identity',150,ARRAY[100,50],ARRAY[100,50]),('above_limit',100.02,ARRAY[100],NULL::numeric[]),
 ('null_item',1,ARRAY[1,NULL],NULL::numeric[]),('negative_item',1,ARRAY[2,-1],NULL::numeric[]),
 ('nan_item',1,ARRAY['NaN'::numeric],NULL::numeric[]),('infinite_item',1,ARRAY['Infinity'::numeric],NULL::numeric[]),
 ('negative_net',-1,ARRAY[100],NULL::numeric[]),('null_net',NULL::numeric,ARRAY[100],NULL::numeric[]),
 ('nan_net','NaN'::numeric,ARRAY[100],NULL::numeric[]),('empty_array',0,ARRAY[]::numeric[],NULL::numeric[]),
 ('subcent_discount',0.013,ARRAY[0.02],NULL::numeric[]),('subcent_items_discount',0,ARRAY[0.006,0.006],NULL::numeric[])
 ) t(name,n,totals,expected) LOOP
 got:=public.profit_allocate_sale(test_row.n,test_row.totals);
 IF got IS DISTINCT FROM test_row.expected THEN RAISE EXCEPTION 'Allocation test failed %: % expected %',test_row.name,got,test_row.expected; END IF;
 END LOOP;
END $tests$;

DO $final_guard$
DECLARE check_row record; actual_hash text;
BEGIN
 FOR check_row IN SELECT * FROM (VALUES ('get_profit_summary','213f7e0e0586dea2e2a5022c4a3cbd79'),('get_profit_by_period','edc7eba9d317433f625def7ce7a0c5ee'),('get_profit_by_category','86dc254c75f850539f63c13da6074bac'),('get_profit_by_cashier','59c8fba05cc38497b073abcf8323def7'),('get_top_products_profit','c76fbb196187ab308d43224ab2c35488')) t(name,hash) LOOP
 SELECT md5(pg_get_functiondef(pr.oid)) INTO actual_hash FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname=check_row.name;
 IF actual_hash IS DISTINCT FROM check_row.hash THEN RAISE EXCEPTION 'Legacy changed after creation: %',check_row.name; END IF;
 END LOOP;
 IF md5(pg_get_viewdef('public.v_sale_item_profit'::regclass,true))<>'835430e5863e97d584812e8a49a5d1cb' THEN RAISE EXCEPTION 'Legacy view changed after creation'; END IF;
END $final_guard$;
/* ROLLBACK -- new objects only, no legacy or transaction changes.
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
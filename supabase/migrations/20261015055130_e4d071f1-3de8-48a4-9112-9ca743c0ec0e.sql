BEGIN;
-- ROLLBACK only after separate approval: BEGIN; DROP VIEW public.v_sale_item_profit_v2c; DROP FUNCTION public.profit_period_bounds_u(date,date); DROP FUNCTION public.profit_period_bucket_u(text,timestamptz); COMMIT;
DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM (VALUES ('v_sale_item_profit','835430e5863e97d584812e8a49a5d1cb'),('get_profit_summary','213f7e0e0586dea2e2a5022c4a3cbd79'),('get_profit_by_period','edc7eba9d317433f625def7ce7a0c5ee'),('get_profit_by_category','86dc254c75f850539f63c13da6074bac'),('get_profit_by_cashier','59c8fba05cc38497b073abcf8323def7'),('get_top_products_profit','c76fbb196187ab308d43224ab2c35488'),('profit_allocate_sale','29c0be76bc75fcd1dfa3bd74c8a038c0'),('profit_period_bounds','0554370e03819474fe10c13b8192786e'),('profit_period_bucket','2984dc0fe9ce0658a3eb77ce4fea881e'),('get_profit_summary_v2','2971b94bbdb424f8f8c3db6a964252f3'),('get_profit_by_period_v2','5d0a5265596486aab318ed36a9bf444b'),('get_profit_by_category_v2','e30536f74fc9c84491f0d7a2d487f1f9'),('get_profit_by_cashier_v2','0f13447ddaac608c7a6251b0ffd415c2'),('get_top_products_profit_v2','57b631000f0d29417ab7bb73570f420f'),('v_sale_item_profit_v2','3774a73bbe091248c017d9564158aac9'),('v_sale_item_profit_v2b','3af9c4adf6a6531f63e4868b1968d0c7')) b(name,hash) LEFT JOIN (SELECT c.relname name,md5(pg_get_viewdef(c.oid,true)) hash FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='v' UNION ALL SELECT p.proname,md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public') a USING(name) WHERE a.hash IS DISTINCT FROM b.hash) THEN RAISE EXCEPTION 'Protected 16-object hash mismatch'; END IF; END $guard$;
CREATE FUNCTION public.profit_period_bounds_u(p_start date,p_end date) RETURNS TABLE(start_ts timestamptz,end_ts_exclusive timestamptz) LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$ SELECT p_start::timestamp AT TIME ZONE 'UTC',(p_end+1)::timestamp AT TIME ZONE 'UTC'; $f$;
CREATE FUNCTION public.profit_period_bucket_u(p_group_by text,p_created_at timestamptz) RETURNS timestamptz LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$ SELECT date_trunc(p_group_by,p_created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; $f$;
DO $build$
DECLARE olddef text; tail text; expr text := $window$WITH input_rows AS (%SOURCE%),
stats AS (SELECT r.*,sum(gross_total) OVER w AS i,
 bool_or(gross_total IS NULL OR gross_total<0 OR gross_total::text IN ('NaN','Infinity','-Infinity')) OVER w AS bad,
 bool_or(round(gross_total,2)<>gross_total) OVER w AS subcent,
 row_number() OVER (PARTITION BY store_id,sale_created_at,cashier_id,sale_id ORDER BY gross_total DESC,id) AS ord
 FROM input_rows r WINDOW w AS (PARTITION BY store_id,sale_created_at,cashier_id,sale_id)),
policy AS (SELECT r.*,CASE
 WHEN n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR bad OR i=0 OR n<0 OR n>i+0.01 THEN 'anomaly'
 WHEN abs(n-i)<=0.005 OR (i<n AND n<=i+0.01) THEN 'identity'
 WHEN round(n,2)<>n OR subcent THEN 'anomaly' ELSE 'allocate' END AS mode FROM stats r),
rounded AS (SELECT r.*,CASE WHEN mode='allocate' THEN round(gross_total*n/NULLIF(i,0),2) ELSE gross_total END AS amount FROM policy r),
residual AS (SELECT r.*,CASE WHEN ord=1 THEN amount+n-sum(amount) OVER (PARTITION BY store_id,sale_created_at,cashier_id,sale_id) ELSE amount END AS candidate FROM rounded r),
checked AS (SELECT r.*,bool_or(candidate<0 OR (gross_total=0 AND candidate<>0)) OVER (PARTITION BY store_id,sale_created_at,cashier_id,sale_id) AS invalid_result FROM residual r),
allocated_items AS (SELECT r.*,CASE WHEN mode='identity' OR mode='anomaly' OR invalid_result THEN gross_total ELSE candidate END AS total,
 gross_total-CASE WHEN mode='identity' OR mode='anomaly' OR invalid_result THEN gross_total ELSE candidate END AS allocated_discount,
 (mode='anomaly' OR (mode='allocate' AND invalid_result)) AS anomaly FROM checked r)
$window$; src text := $source$SELECT raw.id,raw.sale_id,raw.variant_id,raw.product_snapshot,raw.quantity,raw.unit_price,raw.cost_price,raw.discount,raw.total AS gross_total,s.created_at AS sale_created_at,s.store_id,s.user_id AS cashier_id,s.receipt_number,s.total-s.tax_total AS n FROM public.sale_items raw JOIN public.sales s ON s.id=raw.sale_id WHERE s.status IS DISTINCT FROM 'returned'::text$source$;
 oldoid oid := 'public.v_sale_item_profit_v2'::regclass; newoid oid; obj record; grantrow record; oldowner text; oldacl aclitem[]; newacl aclitem[];
BEGIN
 olddef := pg_get_viewdef(oldoid,true);
 IF position(' SELECT s.id AS sale_id,' IN olddef)=0 OR position('FROM allocated_items si' IN olddef)=0 OR position('JOIN sales s ON s.id = si.sale_id' IN olddef)=0 THEN RAISE EXCEPTION 'Production v2 projection pattern mismatch'; END IF;
 tail := substring(olddef FROM position(' SELECT s.id AS sale_id,' IN olddef));
 tail := replace(tail,'JOIN sales s ON s.id = si.sale_id','');
 tail := replace(tail,'s.id AS sale_id','si.sale_id AS sale_id');
 tail := replace(tail,'s.created_at','si.sale_created_at');
 tail := replace(tail,'s.receipt_number','si.receipt_number');
 tail := replace(tail,'s.store_id','si.store_id');
 tail := replace(tail,'s.user_id','si.cashier_id');
 tail := replace(tail,'WHERE s.status IS DISTINCT FROM ''returned''::text','');
 IF tail ~ '\ms\.' THEN RAISE EXCEPTION 'Unmapped sale projection'; END IF;
 EXECUTE 'CREATE VIEW public.v_sale_item_profit_v2c WITH (security_invoker=true) AS '||replace(expr,'%SOURCE%',src)||tail;
 newoid := 'public.v_sale_item_profit_v2c'::regclass;
 FOR obj IN SELECT 'view' kind,oldoid oldid,newoid newid,'public.v_sale_item_profit_v2c' identity
 UNION ALL SELECT 'function','public.profit_period_bounds(date,date)'::regprocedure::oid,'public.profit_period_bounds_u(date,date)'::regprocedure::oid,'public.profit_period_bounds_u(date,date)'
 UNION ALL SELECT 'function','public.profit_period_bucket(text,timestamptz)'::regprocedure::oid,'public.profit_period_bucket_u(text,timestamptz)'::regprocedure::oid,'public.profit_period_bucket_u(text,timestamptz)'
 LOOP
  IF obj.kind='view' THEN SELECT pg_get_userbyid(relowner),coalesce(relacl,acldefault('r',relowner)) INTO oldowner,oldacl FROM pg_class WHERE oid=obj.oldid;
  ELSE SELECT pg_get_userbyid(proowner),coalesce(proacl,acldefault('f',proowner)) INTO oldowner,oldacl FROM pg_proc WHERE oid=obj.oldid; END IF;
  EXECUTE format('ALTER %s %s OWNER TO %I',obj.kind,obj.identity,oldowner);
  FOR grantrow IN SELECT DISTINCT grantee FROM aclexplode(CASE WHEN obj.kind='view' THEN (SELECT coalesce(relacl,acldefault('r',relowner)) FROM pg_class WHERE oid=obj.newid) ELSE (SELECT coalesce(proacl,acldefault('f',proowner)) FROM pg_proc WHERE oid=obj.newid) END)
  LOOP EXECUTE format('REVOKE ALL ON %s %s FROM %s',CASE WHEN obj.kind='view' THEN 'TABLE' ELSE 'FUNCTION' END,obj.identity,CASE WHEN grantrow.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantrow.grantee)) END); END LOOP;
  FOR grantrow IN SELECT * FROM aclexplode(oldacl) LOOP
   IF pg_get_userbyid(grantrow.grantor)<>oldowner THEN RAISE EXCEPTION 'Non-owner grantor needs exact ACL implementation'; END IF;
   EXECUTE format('GRANT %s ON %s %s TO %s%s',grantrow.privilege_type,CASE WHEN obj.kind='view' THEN 'TABLE' ELSE 'FUNCTION' END,obj.identity,CASE WHEN grantrow.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantrow.grantee)) END,CASE WHEN grantrow.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
  IF obj.kind='view' THEN SELECT coalesce(relacl,acldefault('r',relowner)) INTO newacl FROM pg_class WHERE oid=obj.newid;
  ELSE SELECT coalesce(proacl,acldefault('f',proowner)) INTO newacl FROM pg_proc WHERE oid=obj.newid; END IF;
  IF EXISTS ((SELECT * FROM aclexplode(oldacl) EXCEPT ALL SELECT * FROM aclexplode(newacl)) UNION ALL (SELECT * FROM aclexplode(newacl) EXCEPT ALL SELECT * FROM aclexplode(oldacl))) THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
 END LOOP;
 IF EXISTS ((SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid=oldoid AND attnum>0 AND NOT attisdropped EXCEPT ALL SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid=newoid AND attnum>0 AND NOT attisdropped) UNION ALL (SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid=newoid AND attnum>0 AND NOT attisdropped EXCEPT ALL SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute WHERE attrelid=oldoid AND attnum>0 AND NOT attisdropped)) THEN RAISE EXCEPTION 'Column contract mismatch'; END IF;
 IF EXISTS ((SELECT * FROM public.v_sale_item_profit_v2 EXCEPT ALL SELECT * FROM public.v_sale_item_profit_v2c) UNION ALL (SELECT * FROM public.v_sale_item_profit_v2c EXCEPT ALL SELECT * FROM public.v_sale_item_profit_v2)) THEN RAISE EXCEPTION 'Full-row equivalence failure; STOP'; END IF;
END $build$;
DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM (VALUES ('v_sale_item_profit','835430e5863e97d584812e8a49a5d1cb'),('get_profit_summary','213f7e0e0586dea2e2a5022c4a3cbd79'),('get_profit_by_period','edc7eba9d317433f625def7ce7a0c5ee'),('get_profit_by_category','86dc254c75f850539f63c13da6074bac'),('get_profit_by_cashier','59c8fba05cc38497b073abcf8323def7'),('get_top_products_profit','c76fbb196187ab308d43224ab2c35488'),('profit_allocate_sale','29c0be76bc75fcd1dfa3bd74c8a038c0'),('profit_period_bounds','0554370e03819474fe10c13b8192786e'),('profit_period_bucket','2984dc0fe9ce0658a3eb77ce4fea881e'),('get_profit_summary_v2','2971b94bbdb424f8f8c3db6a964252f3'),('get_profit_by_period_v2','5d0a5265596486aab318ed36a9bf444b'),('get_profit_by_category_v2','e30536f74fc9c84491f0d7a2d487f1f9'),('get_profit_by_cashier_v2','0f13447ddaac608c7a6251b0ffd415c2'),('get_top_products_profit_v2','57b631000f0d29417ab7bb73570f420f'),('v_sale_item_profit_v2','3774a73bbe091248c017d9564158aac9'),('v_sale_item_profit_v2b','3af9c4adf6a6531f63e4868b1968d0c7')) b(name,hash) LEFT JOIN (SELECT c.relname name,md5(pg_get_viewdef(c.oid,true)) hash FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='v' UNION ALL SELECT p.proname,md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public') a USING(name) WHERE a.hash IS DISTINCT FROM b.hash) THEN RAISE EXCEPTION 'Protected 16-object hash mismatch'; END IF; END $guard$;
COMMIT;
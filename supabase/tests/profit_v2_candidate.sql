-- Read-only regression checks; run with an authorized SQL reader. Never writes transaction data.
WITH cases(name,n,totals,expected) AS (VALUES
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
 ) SELECT name, public.profit_allocate_sale(n,totals) AS actual, expected, public.profit_allocate_sale(n,totals) IS NOT DISTINCT FROM expected AS passed FROM cases;

WITH a AS MATERIALIZED (SELECT * FROM public.v_sale_item_profit_v2), b AS MATERIALIZED (SELECT * FROM public.v_sale_item_profit_v2b) SELECT (SELECT count(*) FROM (SELECT * FROM a EXCEPT ALL SELECT * FROM b) d) v2_minus_candidate, (SELECT count(*) FROM (SELECT * FROM b EXCEPT ALL SELECT * FROM a) d) candidate_minus_v2;

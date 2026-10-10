import { supabase } from '@/integrations/supabase/client';
import { discountAmount, profitDiscountBounds, sumDisplayedDiscounts } from './discountReporting';

// Additive reads only. Any failure discards partial results, not the existing report.
export async function fetchProfitPeriodDiscount(storeId: string, start: string, end: string): Promise<number> {
  try {
    const bounds = profitDiscountBounds(start, end);
    let total = 0;
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('sales')
        .select('id, discount_total, sale_items!inner(sale_id)')
        .eq('store_id', storeId)
        .or('status.is.null,status.neq.returned')
        .gte('created_at', bounds.start)
        .lt('created_at', bounds.endExclusive)
        .order('id')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      total += sumDisplayedDiscounts(data ?? []);
      if (!data || data.length < pageSize) return total;
    }
  } catch (error) {
    console.error('Error fetching profit period discounts:', error);
    return 0;
  }
}

export async function fetchSaleDiscounts(storeId: string, saleIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(saleIds)];
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase.from('sales')
      .select('id, discount_total')
      .eq('store_id', storeId)
      .in('id', ids);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(sale => [sale.id, discountAmount(sale.discount_total)]));
  } catch (error) {
    console.error('Error fetching transaction discounts:', error);
    return {};
  }
}
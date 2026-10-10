// Display-only helpers: never feed these values back into financial totals.
type DiscountSale = { discount_total?: number | null; status?: string | null; type?: string };

export const discountAmount = (value: number | null | undefined): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export const sumDisplayedDiscounts = (sales: readonly DiscountSale[], activeSalesOnly = false): number =>
  sales.reduce((sum, sale) => {
    if (activeSalesOnly && (sale.status === 'returned' || sale.type === 'expense')) return sum;
    return sum + discountAmount(sale.discount_total);
  }, 0);

// get_profit_summary casts dates to timestamptz in the database session (UTC).
// End is exclusive, matching its `(p_end + 1)::timestamptz` bound.
export const profitDiscountBounds = (start: string, end: string) => {
  const endExclusive = new Date(`${end}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start: `${start}T00:00:00.000Z`, endExclusive: endExclusive.toISOString() };
};
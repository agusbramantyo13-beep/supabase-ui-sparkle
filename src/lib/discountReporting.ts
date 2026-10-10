// Display-only helpers: never feed these values back into financial totals.
type DiscountSale = {
  subtotal?: number | null; total?: number | null; tax_total?: number | null;
  discount_total?: number | null; status?: string | null; type?: string;
};

export const discountAmount = (value: number | null | undefined): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

// Actual reduction is display-only; stored discounts and receipt payloads stay intact.
export const actualDiscount = (sale: DiscountSale): number => {
  const subtotal = discountAmount(sale.subtotal);
  const amount = subtotal > 0
    ? subtotal - discountAmount(sale.total) + discountAmount(sale.tax_total)
    : discountAmount(sale.discount_total);
  return Math.max(0, discountAmount(amount));
};

export const sumDisplayedDiscounts = (sales: readonly DiscountSale[], activeSalesOnly = false): number =>
  sales.reduce((sum, sale) => {
    if (activeSalesOnly && (sale.status === 'returned' || sale.type === 'expense')) return sum;
    return sum + actualDiscount(sale);
  }, 0);

// get_profit_summary casts dates to timestamptz in the database session (UTC).
// End is exclusive, matching its `(p_end + 1)::timestamptz` bound.
export const profitDiscountBounds = (start: string, end: string) => {
  const endExclusive = new Date(`${end}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start: `${start}T00:00:00.000Z`, endExclusive: endExclusive.toISOString() };
};
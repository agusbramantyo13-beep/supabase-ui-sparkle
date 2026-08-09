export const PRICE_BELOW_COST_MESSAGE =
  "Harga jual tidak boleh lebih rendah dari harga beli";

/**
 * Returns true when the selling price is valid (>= cost price).
 * Equal values are allowed. Missing/zero cost is always valid.
 */
export function isSellingPriceValid(
  sellingPrice: number | null | undefined,
  costPrice: number | null | undefined
): boolean {
  const price = Number(sellingPrice) || 0;
  const cost = Number(costPrice) || 0;
  if (cost <= 0) return true;
  return price >= cost;
}

/** Error message when invalid, otherwise null. */
export function validateSellingPrice(
  sellingPrice: number | null | undefined,
  costPrice: number | null | undefined,
  label?: string
): string | null {
  if (isSellingPriceValid(sellingPrice, costPrice)) return null;
  const cost = Number(costPrice) || 0;
  const price = Number(sellingPrice) || 0;
  const detail = `(Rp ${price.toLocaleString("id-ID")} < Rp ${cost.toLocaleString("id-ID")})`;
  return label
    ? `${label}: ${PRICE_BELOW_COST_MESSAGE} ${detail}`
    : `${PRICE_BELOW_COST_MESSAGE} ${detail}`;
}

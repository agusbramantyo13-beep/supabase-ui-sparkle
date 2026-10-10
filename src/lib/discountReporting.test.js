import { describe, expect, test } from 'bun:test';
import { discountAmount, profitDiscountBounds, sumDisplayedDiscounts } from './discountReporting';

describe('display-only discount reporting', () => {
  test('history excludes returned sales and expenses', () => {
    expect(sumDisplayedDiscounts([
      { type: 'sale', status: 'completed', discount_total: 10000 },
      { type: 'sale', status: 'returned', discount_total: 5000 },
      { type: 'expense', discount_total: 2000 },
      { type: 'sale', status: null, discount_total: 3000 },
    ], true)).toBe(13000);
  });
  test('overview includes the same records as its existing sales total', () => {
    expect(sumDisplayedDiscounts([
      { status: 'completed', discount_total: 10000 },
      { status: 'returned', discount_total: 5000 },
    ])).toBe(15000);
  });
  test('missing and nonfinite discounts safely resolve to zero', () => {
    expect(discountAmount(null)).toBe(0);
    expect(discountAmount(undefined)).toBe(0);
    expect(discountAmount(NaN)).toBe(0);
    expect(sumDisplayedDiscounts([{ discount_total: null }, {}])).toBe(0);
  });
  test('profit bounds match verified UTC RPC dates and exclusive next-day end', () => {
    expect(profitDiscountBounds('2026-10-01', '2026-10-10')).toEqual({
      start: '2026-10-01T00:00:00.000Z', endExclusive: '2026-10-11T00:00:00.000Z',
    });
    expect(profitDiscountBounds('2026-12-31', '2026-12-31').endExclusive).toBe('2027-01-01T00:00:00.000Z');
  });
});
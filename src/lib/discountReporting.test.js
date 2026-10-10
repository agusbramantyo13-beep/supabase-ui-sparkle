import { describe, expect, test } from 'bun:test';
import { actualDiscount, discountAmount, profitDiscountBounds, sumDisplayedDiscounts } from './discountReporting';

describe('display-only discount reporting', () => {
  test('ordinary note discount is the actual net reduction', () => {
    expect(actualDiscount({ subtotal: 155000, total: 150000, tax_total: 0, discount_total: 5000 })).toBe(5000);
  });
  test('online redemption is included even when stored discount is zero', () => {
    expect(actualDiscount({ subtotal: 155000, total: 55000, discount_total: 0, tax_total: 0 })).toBe(100000);
    expect(sumDisplayedDiscounts([{ subtotal: 155000, total: 55000, discount_total: 0 }])).toBe(100000);
  });
  test('offline discount is counted once, not added to the actual reduction', () => {
    expect(actualDiscount({ subtotal: 155000, total: 145000, discount_total: 10000, tax_total: 0 })).toBe(10000);
  });
  test('tax is added back when calculating the reduction', () => {
    expect(actualDiscount({ subtotal: 100000, total: 95000, tax_total: 5000, discount_total: 10000 })).toBe(10000);
  });
  test('absent or zero subtotal falls back to stored discount', () => {
    expect(actualDiscount({ discount_total: 5000 })).toBe(5000);
    expect(actualDiscount({ subtotal: 0, total: 10000, discount_total: 2000 })).toBe(2000);
    expect(actualDiscount({ subtotal: null, discount_total: 3000 })).toBe(3000);
  });
  test('null and nonfinite values never produce NaN', () => {
    expect(actualDiscount({ subtotal: null, total: null, tax_total: null, discount_total: null })).toBe(0);
    expect(actualDiscount({ subtotal: NaN, total: NaN, tax_total: NaN, discount_total: NaN })).toBe(0);
    expect(actualDiscount({ subtotal: 155000, total: NaN, tax_total: NaN })).toBe(155000);
    expect(actualDiscount({ subtotal: Infinity, discount_total: Infinity })).toBe(0);
  });
  test('negative fallback or total above subtotal never produces a negative discount', () => {
    expect(actualDiscount({ subtotal: 10000, total: 15000 })).toBe(0);
    expect(actualDiscount({ subtotal: -10000, discount_total: -5000 })).toBe(0);
  });
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
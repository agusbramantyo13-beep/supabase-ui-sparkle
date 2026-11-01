import { expect, test } from 'bun:test';
import { memberPointSnapshot } from './memberPointSnapshot';

test('online sale insert contains both receipt snapshots without a later sales update', () => {
  expect(memberPointSnapshot('m1', { id: 'm1', points: 2 }, 1, 1)).toEqual({
    member_points_after: 3, member_points_earned: 1,
  });
});
test('redemption changes balance but not points earned in this transaction', () => {
  expect(memberPointSnapshot('m1', { id: 'm1', points: 10 }, -3, 2)).toEqual({
    member_points_after: 7, member_points_earned: 2,
  });
});
test('zero change still records zero earned and the existing balance', () => {
  expect(memberPointSnapshot('m1', { id: 'm1', points: 3 }, 0, 0)).toEqual({
    member_points_after: 3, member_points_earned: 0,
  });
});
test('none and unavailable members do not fabricate point snapshots', () => {
  const empty = { member_points_after: null, member_points_earned: null };
  expect(memberPointSnapshot('none', undefined, 1, 1)).toEqual(empty);
  expect(memberPointSnapshot('', undefined, 1, 1)).toEqual(empty);
  expect(memberPointSnapshot('m1', undefined, 1, 1)).toEqual(empty);
  expect(memberPointSnapshot('m1', { id: 'm2', points: 3 }, 1, 1)).toEqual(empty);
});
test('existing balance floor and null balance behavior are preserved', () => {
  expect(memberPointSnapshot('m1', { id: 'm1', points: null }, 1, 1).member_points_after).toBe(1);
  expect(memberPointSnapshot('m1', { id: 'm1', points: 2 }, -5, 0).member_points_after).toBe(0);
});
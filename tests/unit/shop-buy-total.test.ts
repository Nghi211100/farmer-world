import { describe, expect, it } from 'vitest';
import { shopDetailCoinRowTotal } from '../../src/ui/shopDetailPrice';

describe('shopDetailCoinRowTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(shopDetailCoinRowTotal(5, 1)).toBe(5);
    expect(shopDetailCoinRowTotal(5, 2)).toBe(10);
    expect(shopDetailCoinRowTotal(8, 3)).toBe(24);
  });

  it('clamps quantity to at least 1', () => {
    expect(shopDetailCoinRowTotal(5, 0)).toBe(5);
    expect(shopDetailCoinRowTotal(5, -2)).toBe(5);
  });
});

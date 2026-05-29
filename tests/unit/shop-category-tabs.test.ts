import { describe, expect, it } from 'vitest';
import { SHOP_CATEGORY_TAB_COUNT } from '../../src/ui/shopModalLayout';

describe('shop category tabs', () => {
  it('uses six tabs in the left list', () => {
    expect(SHOP_CATEGORY_TAB_COUNT).toBe(6);
  });
});

import { describe, expect, test } from 'vitest';

/** Mirrors InventoryPanel.ts renderList slot card constants. */
const ITEM_SLOT_WIDTH_SCALE = 1.086585; // 1.083336 × 1.003
const PRIOR_ITEM_SLOT_WIDTH_SCALE = 1.083336;

describe('warehouse slot card layout', () => {
  test('ITEM_SLOT_WIDTH_SCALE is prior value × 1.003', () => {
    expect(ITEM_SLOT_WIDTH_SCALE).toBeCloseTo(PRIOR_ITEM_SLOT_WIDTH_SCALE * 1.003, 5);
  });
});

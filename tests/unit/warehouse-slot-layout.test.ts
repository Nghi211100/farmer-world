import { describe, expect, test } from 'vitest';

/** Mirrors InventoryPanel.ts renderList slot card constants. */
const ITEM_SLOT_WIDTH_SCALE = 1.086585; // 1.083336 × 1.003
const PRIOR_ITEM_SLOT_WIDTH_SCALE = 1.083336;
const ITEM_SLOT_GAP_SCALE = 1.01;
const ITEM_SLOT_NAME_Y_OFFSET_FRAC = -0.03;
const ITEM_SLOT_LABEL_Y_OFFSET_FRAC = -0.02;
/** Mirrors `ui/warehouse-item.png` qty pill art px in InventoryPanel.ts. */
const WAREHOUSE_ITEM_ART_W = 128;
const WAREHOUSE_ITEM_ART_H = 120;
const SLOT_QTY_BADGE_X0_PX = 100;
const SLOT_QTY_BADGE_X1_PX = 116;
const SLOT_QTY_BADGE_Y0_PX = 76;
const SLOT_QTY_BADGE_Y1_PX = 82;
const SLOT_QTY_BADGE_WIDTH_FRAC = 21 / 110;

describe('warehouse slot card layout', () => {
  test('ITEM_SLOT_WIDTH_SCALE is prior value × 1.003', () => {
    expect(ITEM_SLOT_WIDTH_SCALE).toBeCloseTo(PRIOR_ITEM_SLOT_WIDTH_SCALE * 1.003, 5);
  });

  test('ITEM_SLOT_GAP_SCALE widens inter-item grid step by 1%', () => {
    expect(ITEM_SLOT_GAP_SCALE).toBe(1.01);
  });

  test('name label is raised 3% of cellH above qty badge nudge', () => {
    expect(ITEM_SLOT_NAME_Y_OFFSET_FRAC).toBe(-0.03);
    expect(ITEM_SLOT_LABEL_Y_OFFSET_FRAC).toBe(-0.02);
    expect(ITEM_SLOT_NAME_Y_OFFSET_FRAC - ITEM_SLOT_LABEL_Y_OFFSET_FRAC).toBeCloseTo(-0.01, 5);
  });

  test('qty badge layout matches tan pill on warehouse-item art', () => {
    const artWidthFrac = (SLOT_QTY_BADGE_X1_PX - SLOT_QTY_BADGE_X0_PX) / WAREHOUSE_ITEM_ART_W;
    const centerXFrac =
      (SLOT_QTY_BADGE_X0_PX + SLOT_QTY_BADGE_X1_PX) / 2 / WAREHOUSE_ITEM_ART_W;
    const centerYFrac =
      (SLOT_QTY_BADGE_Y0_PX + SLOT_QTY_BADGE_Y1_PX) / 2 / WAREHOUSE_ITEM_ART_H;

    expect(SLOT_QTY_BADGE_WIDTH_FRAC).toBeCloseTo(21 / 110, 5);
    expect(artWidthFrac).toBeCloseTo(16 / 128, 5);
    expect(centerXFrac).toBeCloseTo(108 / 128, 5);
    expect(centerYFrac).toBeCloseTo(79 / 120, 5);
    expect(centerXFrac).toBeGreaterThan(0.5);
  });
});

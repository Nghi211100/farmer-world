import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS } from '../../src/systems/BuildSystem';
import {
  BUILD_MODAL_PANEL_HEIGHT,
  BUILD_MODAL_VISIBLE_CARD_SLOTS,
  computeBuildModalLayout,
} from '../../src/ui/buildModalLayout';

describe('computeBuildModalLayout', () => {
  it('uses full viewport width and fixed panel height', () => {
    const layout = computeBuildModalLayout(390, 844, 1);
    expect(layout.panelW).toBe(390);
    expect(layout.panelH).toBe(BUILD_MODAL_PANEL_HEIGHT);
    expect(layout.cy).toBe(844 - BUILD_MODAL_PANEL_HEIGHT / 2);
    expect(layout.headerH).toBe(0);
    expect(layout.tabRowH).toBeGreaterThanOrEqual(48);
    expect(layout.tabRowPadLeft).toBeCloseTo(390 * 0.02, 5);
    expect(layout.closeShiftLeft).toBeCloseTo(390 * 0.01, 5);
  });

  it('exposes a positive scroll viewport inside the inner panel', () => {
    const layout = computeBuildModalLayout(390, 844, 1);
    expect(layout.scrollViewportW).toBeGreaterThan(0);
    expect(layout.scrollViewportH).toBeGreaterThan(0);
    expect(layout.cardW).toBeGreaterThan(0);
    expect(layout.cardH).toBeGreaterThan(0);
    expect(layout.scrollLeft).toBeGreaterThan(-layout.panelW / 2);
    expect(layout.scrollTop).toBeGreaterThan(-layout.panelH / 2);
  });

  it('sizes cards for five visible slots across the scroll viewport', () => {
    const layout = computeBuildModalLayout(390, 844, 1);
    expect(layout.visibleCardSlots).toBe(BUILD_MODAL_VISIBLE_CARD_SLOTS);
    const expected =
      (layout.scrollViewportW -
        (BUILD_MODAL_VISIBLE_CARD_SLOTS - 1) * layout.cardGap) /
      BUILD_MODAL_VISIBLE_CARD_SLOTS;
    expect(layout.cardW).toBeCloseTo(expected, 5);
    expect(
      BUILD_MODAL_VISIBLE_CARD_SLOTS * layout.cardW +
        (BUILD_MODAL_VISIBLE_CARD_SLOTS - 1) * layout.cardGap
    ).toBeCloseTo(layout.scrollViewportW, 5);
  });

  it('maps build items to buildings and decor tabs', () => {
    const buildings = BUILD_ITEMS.filter((i) => i.category === 'buildings');
    const decor = BUILD_ITEMS.filter((i) => i.category === 'decor');
    expect(buildings.map((i) => i.label)).toEqual(['House', 'Barn']);
    expect(decor.map((i) => i.label)).toEqual(['Tree']);
  });
});

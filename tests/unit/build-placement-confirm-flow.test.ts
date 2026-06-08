import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS } from '../../src/systems/BuildSystem';
import { LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import {
  buildPanelPlacingItemKey,
  canShowPlacementConfirm,
} from '../../src/utils/buildPlacementFlow';

describe('build placement confirm flow', () => {
  it('canShowPlacementConfirm requires active locked preview with a selected item', () => {
    const item = BUILD_ITEMS[0];
    expect(
      canShowPlacementConfirm({ active: true, selectedItem: item, previewLocked: true })
    ).toBe(true);
    expect(
      canShowPlacementConfirm({ active: true, selectedItem: item, previewLocked: false })
    ).toBe(false);
    expect(
      canShowPlacementConfirm({ active: false, selectedItem: item, previewLocked: true })
    ).toBe(false);
    expect(
      canShowPlacementConfirm({ active: true, selectedItem: null, previewLocked: true })
    ).toBe(false);
  });

  it('buildPanelPlacingItemKey is stable per decor/building card', () => {
    const path = BUILD_ITEMS.find((i) => i.label === 'Path')!;
    const corner = BUILD_ITEMS.find((i) => i.label === 'Road corner')!;
    expect(buildPanelPlacingItemKey(path)).not.toBe(buildPanelPlacingItemKey(corner));
    expect(buildPanelPlacingItemKey(path)).toBe(buildPanelPlacingItemKey(path));
  });

  it('buildPanelPlacingItemKey distinguishes livestock pen cards', () => {
    const pen = LIVESTOCK_PEN_PLACE_ITEMS[0];
    expect(buildPanelPlacingItemKey(pen)).toContain('pen:');
  });

  it('placement confirm shows while preview is locked after panel dismiss', () => {
    const item = BUILD_ITEMS.find((i) => i.label === 'House')!;
    expect(
      canShowPlacementConfirm({ active: true, selectedItem: item, previewLocked: true })
    ).toBe(true);
    expect(
      canShowPlacementConfirm({ active: true, selectedItem: item, previewLocked: false })
    ).toBe(false);
  });
});

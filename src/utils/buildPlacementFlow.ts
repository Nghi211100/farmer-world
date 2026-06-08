import type { BuildItemDef } from '../systems/BuildSystem';
import type { LivestockPenPlaceItemDef } from '../systems/LivestockSystem';

export type BuildPanelPlacingItem = BuildItemDef | LivestockPenPlaceItemDef;

/** Stable key for highlighting a build-panel card during placement. */
export function buildPanelPlacingItemKey(item: BuildPanelPlacingItem): string {
  if ('placeTarget' in item) {
    return `pen:${item.placeTarget}:${item.textureKey}`;
  }
  return `build:${item.type}:${item.textureKey}:${item.label}:${item.placement}`;
}

/** Confirm bar only applies while the preview is snapped to a tile. */
export function canShowPlacementConfirm(opts: {
  active: boolean;
  selectedItem: unknown;
  previewLocked: boolean;
}): boolean {
  return opts.active && opts.selectedItem != null && opts.previewLocked;
}

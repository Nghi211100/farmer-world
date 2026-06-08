import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import { shouldApplyFootGhostOverwrite } from '../../src/utils/ghostSpriteAnchor';
import { TILE_HEIGHT } from '../../src/utils/iso';

describe('iso-tile decor ghost anchor', () => {
  it('field_border keeps top anchor (same as placed Decoration and confirm popup)', () => {
    expect(shouldApplyFootGhostOverwrite(false, 'field_border')).toBe(false);
    expect(shouldApplyFootGhostOverwrite(true, 'grass')).toBe(false);
  });

  it('trees and rocks still use foot anchor for move/build ghosts', () => {
    expect(shouldApplyFootGhostOverwrite(false, 'rock_01')).toBe(true);
    expect(shouldApplyFootGhostOverwrite(false, 'tree_01')).toBe(true);
    expect(shouldApplyFootGhostOverwrite(false, 'house_lv1')).toBe(true);
  });

  it('foot anchor is TILE_HEIGHT below top anchor on the map layer', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const gx = 3;
    const gy = 5;
    const top = grid.gridToMapScreen(gx, gy);
    const foot = grid.gridToTileBottom(gx, gy);
    expect(foot.y - top.y).toBeCloseTo(TILE_HEIGHT, 0.01);
    expect(shouldApplyFootGhostOverwrite(false, 'field_border')).toBe(false);
  });
});

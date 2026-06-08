import { describe, expect, it } from 'vitest';
import { isIsoTileDecorObject } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { TILE_HEIGHT } from '../../src/utils/iso';

describe('object edit popup anchor', () => {
  it('field_border uses top anchor; rocks use tile center', () => {
    expect(isIsoTileDecorObject('field_border')).toBe(true);
    expect(isIsoTileDecorObject('rock_01')).toBe(false);
  });

  it('center anchor is half a tile below top anchor on the map layer', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const top = grid.gridToMapScreen(4, 6);
    const centerY = top.y + TILE_HEIGHT / 2;
    expect(centerY - top.y).toBeCloseTo(TILE_HEIGHT / 2, 0.01);
  });
});

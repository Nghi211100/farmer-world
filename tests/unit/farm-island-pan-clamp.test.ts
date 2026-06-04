import { describe, expect, it } from 'vitest';
import {
  FARM_ISLAND_PAN_CLAMP_INSET_LEFT_FRAC,
  FARM_ISLAND_PAN_CLAMP_INSET_RIGHT_FRAC,
  getFarmIslandPanClampBounds,
  insetFarmFootprintBounds,
} from '../../src/farmIslandLayout';

describe('farm island pan clamp insets', () => {
  it('trims more from the right/southeast than from the left', () => {
    expect(FARM_ISLAND_PAN_CLAMP_INSET_RIGHT_FRAC).toBeGreaterThan(
      FARM_ISLAND_PAN_CLAMP_INSET_LEFT_FRAC
    );
  });

  it('insetFarmFootprintBounds shrinks width on both sides', () => {
    const raw = { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
    const inset = insetFarmFootprintBounds(raw, { left: 0.1, right: 0.2 });
    expect(inset.minX).toBe(100);
    expect(inset.maxX).toBe(800);
    expect(inset.minY).toBe(0);
    expect(inset.maxY).toBe(500);
  });

  it('getFarmIslandPanClampBounds is strictly inside the island AABB', () => {
    const island = { minX: 10, minY: 20, maxX: 1010, maxY: 520 };
    const clamp = getFarmIslandPanClampBounds(island);
    expect(clamp.minX).toBeGreaterThan(island.minX);
    expect(clamp.maxX).toBeLessThan(island.maxX);
    expect(clamp.minY).toBeGreaterThan(island.minY);
    expect(clamp.maxY).toBeLessThan(island.maxY);
  });
});

import { describe, expect, it } from 'vitest';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import {
  computeFarmIslandWorldDepth,
  FARM_ISLAND_DEPTH_BELOW_GROUND,
  FARM_ISLAND_RING_MARGIN,
  FARM_LAND_DEPTH_BOOST,
  ISLAND_GROUND_MIN_SEP,
  isFarmNorthEdgeCell,
} from '../../src/farmIslandLayout';
import { GridSystem } from '../../src/systems/GridSystem';

describe('isFarmNorthEdgeCell', () => {
  it('includes north path ring apex and first soil row, not interior', () => {
    expect(isFarmNorthEdgeCell(3, 5)).toBe(true);
    expect(isFarmNorthEdgeCell(4, 6)).toBe(true);
    expect(isFarmNorthEdgeCell(8, 8)).toBe(false);
  });
});

describe('computeFarmIslandWorldDepth', () => {
  it('is below every ground tile in soil bounds and outer ring', () => {
    const islandDepth = computeFarmIslandWorldDepth();
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.ensureFarmPathRing();

    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const margin = FARM_ISLAND_RING_MARGIN;
    let minGround = Infinity;
    for (let gy = minY - margin; gy <= maxY + margin; gy++) {
      for (let gx = minX - margin; gx <= maxX + margin; gx++) {
        if (!grid.inBounds(gx, gy)) continue;
        const groundDepth = grid.getDepth(gx, gy, 'ground');
        minGround = Math.min(minGround, groundDepth);
        expect(groundDepth).toBeGreaterThan(islandDepth);
        expect(groundDepth).toBeGreaterThanOrEqual(islandDepth + FARM_LAND_DEPTH_BOOST);

        if (isFarmNorthEdgeCell(gx, gy, margin)) {
          expect(groundDepth).toBeGreaterThanOrEqual(islandDepth + ISLAND_GROUND_MIN_SEP);
        }
      }
    }

    expect(islandDepth).toBe(2);
    expect(minGround).toBeGreaterThanOrEqual(islandDepth + ISLAND_GROUND_MIN_SEP);
    expect(minGround).toBeGreaterThanOrEqual(islandDepth + FARM_LAND_DEPTH_BOOST);
  });

  it('is lower than the old NE-corner-only depth (ring tiles were inverted)', () => {
    const legacyBelowGround = 8;
    const oldCornerOnly =
      (FARM_SOIL_BOUNDS.minX + FARM_SOIL_BOUNDS.minY) * 10 - legacyBelowGround;
    expect(computeFarmIslandWorldDepth()).toBeLessThan(oldCornerOnly);
  });
});

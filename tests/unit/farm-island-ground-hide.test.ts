import { describe, expect, it } from 'vitest';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';

describe('hidesGroundForFarmIsland', () => {
  it('never hides ground so farm tiles stay above island.png', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.ensureFarmPathRing();

    const locked = grid
      .getSoilTileCoords()
      .find(({ x, y }) => grid.isFarmPlantingCell(x, y) && !grid.isFarmUnlocked(x, y));
    expect(locked).toBeDefined();
    expect(grid.hidesGroundForFarmIsland(locked!.x, locked!.y)).toBe(false);

    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    for (let y = minY - 1; y <= maxY + 1; y++) {
      for (let x = minX - 1; x <= maxX + 1; x++) {
        if (!grid.inBounds(x, y)) continue;
        expect(grid.hidesGroundForFarmIsland(x, y)).toBe(false);
      }
    }
  });
});

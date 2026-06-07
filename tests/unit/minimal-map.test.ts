import { describe, expect, it } from 'vitest';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';

describe('minimal placeholder map', () => {
  it('keeps buildable grass with farm soil patch and no pre-placed items', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    let voidCount = 0;
    let soilCount = 0;
    let pathCount = 0;
    let waterCount = 0;
    let grassCount = 0;
    let objectCount = 0;

    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        const cell = grid.getCell(x, y);
        if (!cell) continue;
        if (cell.object) objectCount++;
        switch (cell.type) {
          case 'void':
            voidCount++;
            break;
          case 'soil':
            soilCount++;
            break;
          case 'path':
            pathCount++;
            break;
          case 'water':
            waterCount++;
            break;
          case 'grass':
            grassCount++;
            break;
        }
      }
    }

    const soilTiles =
      (FARM_SOIL_BOUNDS.maxX - FARM_SOIL_BOUNDS.minX + 1) *
      (FARM_SOIL_BOUNDS.maxY - FARM_SOIL_BOUNDS.minY + 1);
    const mapCells = grid.size * grid.size;

    expect(soilCount).toBe(soilTiles);
    expect(grassCount).toBe(mapCells - soilCount);
    expect(waterCount).toBe(0);
    expect(pathCount).toBe(0);
    expect(objectCount).toBe(0);
    expect(voidCount).toBe(0);
    expect(grid.getCell(10, 10)?.type).toBe('soil');
    expect(grid.getCell(2, 2)?.type).toBe('grass');
    expect(grid.getCell(2, 2)?.walkable).toBe(true);
  });
});

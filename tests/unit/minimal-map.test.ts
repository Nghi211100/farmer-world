import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_SCENERY, FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';

describe('minimal placeholder map', () => {
  it('keeps buildable grass with farm soil patch and sparse default scenery', () => {
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
    expect(objectCount).toBe(DEFAULT_MAP_SCENERY.length);
    expect(voidCount).toBe(0);
    expect(grid.getCell(10, 10)?.type).toBe('soil');
    expect(grid.getCell(2, 2)?.type).toBe('grass');
    expect(grid.getCell(2, 2)?.walkable).toBe(true);
    expect(grid.getCell(2, 2)?.groundVariant).toBeUndefined();
    expect(grid.hidesDefaultGroundSprite(2, 2)).toBe(true);
  });

  it('places default scenery only on outer grass cells', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    let treeCount = 0;
    let rockCount = 0;
    let bushCount = 0;

    for (const [x, y, key] of DEFAULT_MAP_SCENERY) {
      expect(grid.isDefaultOuterGrassCell(x, y)).toBe(true);
      expect(grid.isFarmSoilCell(x, y)).toBe(false);
      expect(grid.getCell(x, y)?.object).toBe(key);
      if (key.startsWith('tree_')) treeCount++;
      else if (key.startsWith('rock_')) rockCount++;
      else if (key.startsWith('bush_')) bushCount++;
    }

    expect(treeCount).toBe(4);
    expect(rockCount).toBe(2);
    expect(bushCount).toBe(1);
    expect(grid.hidesDefaultGroundSprite(2, 3)).toBe(true);
  });
});

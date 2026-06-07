import { describe, expect, it } from 'vitest';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';

describe('hidesDefaultGroundSprite', () => {
  it('hides default outer grass but keeps farm soil ground tiles', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    expect(grid.getCell(2, 2)?.type).toBe('grass');
    expect(grid.hidesDefaultGroundSprite(2, 2)).toBe(true);

    for (const { x, y } of grid.getSoilTileCoords()) {
      expect(grid.hidesDefaultGroundSprite(x, y)).toBe(false);
    }

    let visibleOuterGrass = 0;
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type !== 'grass') continue;
        if (!grid.hidesDefaultGroundSprite(x, y)) visibleOuterGrass++;
      }
    }
    expect(visibleOuterGrass).toBe(0);
  });

  it('shows user-placed path and water tiles', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    grid.setCell(4, 4, { type: 'path', walkable: true, pathVariant: 'stone_path' });
    expect(grid.hidesDefaultGroundSprite(4, 4)).toBe(false);

    grid.setCell(5, 5, { type: 'water', walkable: false });
    expect(grid.hidesDefaultGroundSprite(5, 5)).toBe(false);
  });

  it('shows decorative grass variants from Build decor', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    grid.setCell(6, 6, { type: 'grass', walkable: true, groundVariant: 'grass_light' });
    expect(grid.hidesDefaultGroundSprite(6, 6)).toBe(false);

    grid.setCell(7, 7, { type: 'grass', walkable: true, groundVariant: 'flower_ground' });
    expect(grid.hidesDefaultGroundSprite(7, 7)).toBe(false);

    grid.setCell(8, 8, { type: 'grass', walkable: true, groundVariant: 'grass' });
    expect(grid.hidesDefaultGroundSprite(8, 8)).toBe(true);
  });

  it('shows active farm soil when dug or during dig animation', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    const unlocked = grid.getSoilTileCoords().find(({ x, y }) => grid.isFarmUnlocked(x, y));
    expect(unlocked).toBeDefined();
    if (!unlocked) return;

    expect(grid.hidesDefaultGroundSprite(unlocked.x, unlocked.y)).toBe(false);
    expect(grid.hidesDefaultGroundSprite(unlocked.x, unlocked.y, { dug: true })).toBe(
      false
    );
    expect(
      grid.hidesDefaultGroundSprite(unlocked.x, unlocked.y, { farmPlotGround: true })
    ).toBe(false);
  });

  it('shows path ring cells after ensureFarmPathRing', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.ensureFarmPathRing();

    const { minX, minY } = FARM_SOIL_BOUNDS;
    const ringCell = grid.getCell(minX - 1, minY);
    expect(ringCell?.type).toBe('path');
    expect(grid.hidesDefaultGroundSprite(minX - 1, minY)).toBe(false);
  });
});

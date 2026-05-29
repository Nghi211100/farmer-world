import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import { LandSystem } from '../../src/systems/LandSystem';

describe('LandSystem.purchaseAt', () => {
  it('unlocks locked soil at the tapped cell', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const land = new LandSystem();

    const locked = grid
      .getSoilTileCoords()
      .find(({ x, y }) => grid.isLockedSoil(x, y) && land.canUnlockSoilAt(grid, x, y));
    expect(locked).toBeDefined();
    if (!locked) return;

    const beforeKey = grid.getGroundTextureKey(locked.x, locked.y);
    const result = land.purchaseAt(grid, locked.x, locked.y);

    expect(result).toEqual({ ok: true, kind: 'unlock', x: locked.x, y: locked.y });
    expect(grid.isFarmUnlocked(locked.x, locked.y)).toBe(true);
    expect(grid.getGroundTextureKey(locked.x, locked.y)).not.toBe(beforeKey);
    expect(grid.getGroundTextureKey(locked.x, locked.y)).toBe('empty_plot');
  });

  it('prefers expand at tap over auto-unlock when grass is eligible', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const land = new LandSystem();

    const unlocked = grid.getSoilTileCoords().find(({ x, y }) => grid.isFarmUnlocked(x, y));
    expect(unlocked).toBeDefined();
    if (!unlocked) return;

    const gx = unlocked.x + 1;
    const gy = unlocked.y;
    if (!grid.inBounds(gx, gy)) return;

    grid.setCell(gx, gy, {
      type: 'grass',
      walkable: true,
      unlocked: true,
      object: undefined,
      groundVariant: 'grass',
    });
    expect(land.canExpandAt(grid, gx, gy)).toBe(true);

    const result = land.purchaseAt(grid, gx, gy);
    expect(result).toEqual({ ok: true, kind: 'expand', x: gx, y: gy });
    expect(grid.getCell(gx, gy)?.type).toBe('soil');
    expect(grid.isFarmUnlocked(gx, gy)).toBe(true);
  });
});

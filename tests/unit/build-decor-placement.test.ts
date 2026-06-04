import { describe, expect, it } from 'vitest';
import { BUILD_DECOR_COST } from '../../src/config/gameConfig';
import { BUILD_ITEMS, BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';

describe('Build decor placement (5 coins)', () => {
  it('lists all former map tiles in decor tab at BUILD_DECOR_COST', () => {
    const decor = BUILD_ITEMS.filter((i) => i.category === 'decor');
    expect(decor.every((i) => i.cost === BUILD_DECOR_COST)).toBe(true);
    expect(decor.map((i) => i.label)).toEqual([
      'Grass',
      'Light grass',
      'Flowers',
      'Stone path',
      'Water',
      'Tree 1',
      'Tree 2',
      'Tree 3',
      'Rock',
      'Bush',
    ]);
  });

  it('places grass on void and rock as natural object', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(2, 2)).toBe(true);
    expect(build.place(2, 2)).toBe(true);
    expect(grid.getCell(2, 2)?.type).toBe('grass');

    const rockItem = BUILD_ITEMS.find((i) => i.label === 'Rock')!;
    build.enterBuildMode(grassItem);
    expect(build.place(3, 2)).toBe(true);
    build.enterBuildMode(rockItem);
    expect(build.canPlace(3, 2)).toBe(true);
    expect(build.place(3, 2)).toBe(true);
    expect(grid.getCell(3, 2)?.object).toBe('rock_01');
  });
});

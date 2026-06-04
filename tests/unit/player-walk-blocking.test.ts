import { describe, expect, it } from 'vitest';
import { BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import { penFootprintCells } from '../../src/config/livestockAssets';
import {
  canPlayerWalkTo,
  findPlayerWalkPath,
  isPlayerWalkCell,
} from '../../src/utils/playerWalk';

function wireFarmWalkBlocking(grid: GridSystem) {
  const build = new BuildSystem(grid);
  const livestock = new LivestockSystem(grid);
  build.setPlacementBlocked((gx, gy) => livestock.getPenAt(gx, gy) != null);
  livestock.setPlacementBlocked((gx, gy) =>
    build.getBuildings().some((b) => b.gridX === gx && b.gridY === gy)
  );
  grid.setWalkBlocked(
    (gx, gy) =>
      livestock.getPenAt(gx, gy) != null ||
      build.getBuildings().some((b) => b.gridX === gx && b.gridY === gy)
  );
  return { build, livestock };
}

function seedGrassVoid(grid: GridSystem): void {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (grid.getCell(x, y)?.type === 'void') {
        grid.setCell(x, y, { type: 'grass', walkable: true });
      }
    }
  }
}

describe('player walk blocking', () => {
  it('blocks cells with natural decor (tree, rock, bush)', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    wireFarmWalkBlocking(grid);

    grid.setObject(8, 8, 'tree_01');
    grid.setObject(9, 8, 'rock_01');
    grid.setObject(10, 8, 'bush_01');

    expect(isPlayerWalkCell(grid, 8, 8)).toBe(false);
    expect(isPlayerWalkCell(grid, 9, 8)).toBe(false);
    expect(isPlayerWalkCell(grid, 10, 8)).toBe(false);
    expect(isPlayerWalkCell(grid, 8, 7)).toBe(true);
  });

  it('rejects a path through a tree and routes around when possible', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    wireFarmWalkBlocking(grid);

    grid.setObject(10, 10, 'tree_02');

    const around = findPlayerWalkPath(grid, 9, 10, 11, 10);
    expect(around).not.toBeNull();
    expect(canPlayerWalkTo(grid, 9, 10, 11, 10)).toBe(true);
    expect(around!.some((c) => c.gx === 10 && c.gy === 10)).toBe(false);
    expect(around!.at(-1)).toEqual({ gx: 11, gy: 10 });
  });

  it('blocks every cell in a 3×3 pen footprint', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(5, 5);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    for (const { gx, gy } of penFootprintCells(pen!)) {
      expect(isPlayerWalkCell(grid, gx, gy)).toBe(false);
    }
    expect(findPlayerWalkPath(grid, 6, 4, 6, 6)).toBeNull();
    expect(canPlayerWalkTo(grid, 6, 4, 6, 6)).toBe(false);
  });

  it('blocks every cell in a 4×4 upgraded pen footprint', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(6, 6);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    expect(livestock.canUpgradeAt(pen!)).toBe(true);
    const upgraded = livestock.tryUpgrade(pen!);
    expect(upgraded?.level).toBe(2);

    for (const { gx, gy } of penFootprintCells(upgraded!)) {
      expect(isPlayerWalkCell(grid, gx, gy)).toBe(false);
    }
    expect(penFootprintCells(upgraded!).length).toBe(16);
  });

  it('cannot path onto a rock even when the destination is adjacent', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    wireFarmWalkBlocking(grid);
    grid.setObject(12, 12, 'rock_01');

    expect(findPlayerWalkPath(grid, 12, 11, 12, 12)).toBeNull();
    expect(canPlayerWalkTo(grid, 12, 11, 12, 12)).toBe(false);
  });
});

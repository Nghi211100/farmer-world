import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS, BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import {
  PEN_MOAT_WATER_OBJECT,
  penFootprintCells,
  penHasWaterMoat,
  penMoatCells,
  penOccupiesCell,
} from '../../src/config/livestockAssets';
import { createNewPen } from '../../src/systems/livestockLogic';
import {
  canPlayerWalkTo,
  isPlayerWalkCell,
} from '../../src/utils/playerWalk';

function seedGrassVoid(grid: GridSystem): void {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (grid.getCell(x, y)?.type === 'void') {
        grid.setCell(x, y, { type: 'grass', walkable: true });
      }
    }
  }
}

function wireFarmBuildPlacement(grid: GridSystem, build: BuildSystem, livestock: LivestockSystem) {
  build.setPlacementBlocked((gx, gy) =>
    livestock.blocksBuildPlacement(gx, gy, {
      bridge: build.selectedItem?.groundTile === 'bridge',
    })
  );
}

function wireFarmWalkBlocking(grid: GridSystem) {
  const build = new BuildSystem(grid);
  const livestock = new LivestockSystem(grid);
  wireFarmBuildPlacement(grid, build, livestock);
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

describe('duck/fish pen placement (no water moat)', () => {
  it('penHasWaterMoat is disabled for all species', () => {
    expect(penHasWaterMoat('duck')).toBe(false);
    expect(penHasWaterMoat('fish')).toBe(false);
    expect(penHasWaterMoat('chicken')).toBe(false);
    expect(penHasWaterMoat('cow')).toBe(false);
  });

  it('duck pen has no moat cells and footprint-only occupancy', () => {
    const pen = createNewPen('d', 'duck', 5, 5, 1);
    expect(penMoatCells(pen)).toHaveLength(0);
    expect(penFootprintCells(pen)).toHaveLength(9);
    expect(penOccupiesCell(pen, 4, 5)).toBe(false);
    expect(penOccupiesCell(pen, 5, 5)).toBe(true);
  });

  it('placing duck pen keeps surrounding grass (no moat conversion)', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    expect(grid.getCell(7, 8)?.type).toBe('grass');
    expect(grid.getCell(7, 8)?.object).not.toBe(PEN_MOAT_WATER_OBJECT);
    expect(grid.getCell(6, 9)?.type).not.toBe('water');
  });

  it('places duck pen on grass without adjacent river water', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    for (let dy = -1; dy <= 4; dy++) {
      for (let dx = -1; dx <= 4; dx++) {
        const gx = 10 + dx;
        const gy = 10 + dy;
        if (!grid.inBounds(gx, gy)) continue;
        grid.setCell(gx, gy, { type: 'grass', walkable: true, object: undefined });
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'fish')!;
    livestock.enterPlaceMode(item);
    expect(livestock.canPlace(10, 10)).toBe(true);
    const pen = livestock.place(10, 10);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
  });

  it('moving duck pen does not create water at old or new anchor', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    for (const anchor of [{ gx: 8, gy: 8 }, { gx: 12, gy: 12 }]) {
      for (let dy = -1; dy <= 3; dy++) {
        for (let dx = -1; dx <= 3; dx++) {
          grid.setCell(anchor.gx + dx, anchor.gy + dy, {
            type: 'grass',
            walkable: true,
            object: undefined,
          });
        }
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    const ringCell = { gx: 7, gy: 8 };

    expect(livestock.canMovePenTo(pen!, 12, 12)).toBe(true);
    livestock.movePenTo(pen!, 12, 12);
    expect(grid.getCell(ringCell.gx, ringCell.gy)?.type).toBe('grass');
    expect(grid.getCell(11, 12)?.type).toBe('grass');
  });

  it('allows build decor on grass beside duck pen footprint', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { build, livestock } = wireFarmWalkBlocking(grid);
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'fish')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    const beside = { gx: 7, gy: 8 };
    expect(grid.getCell(beside.gx, beside.gy)?.type).toBe('grass');
    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(beside.gx, beside.gy)).toBe(true);
    build.exitBuildMode();
  });

  it('player can walk on grass ring beside duck pen', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    const ring = { gx: 7, gy: 8 };
    expect(isPlayerWalkCell(grid, ring.gx, ring.gy)).toBe(true);
    expect(canPlayerWalkTo(grid, 7, 7, ring.gx, ring.gy)).toBe(true);
    const inner = penFootprintCells(pen!)[0]!;
    expect(isPlayerWalkCell(grid, inner.gx, inner.gy)).toBe(false);
  });

  it('duck pen can upgrade on grass ring (no moat blocking)', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    for (let dy = -1; dy <= 4; dy++) {
      for (let dx = -1; dx <= 4; dx++) {
        const gx = 8 + dx;
        const gy = 8 + dy;
        if (!grid.inBounds(gx, gy)) continue;
        grid.setCell(gx, gy, { type: 'grass', walkable: true, object: undefined });
      }
    }

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    expect(livestock.canUpgradeAt(pen!)).toBe(true);
    const upgraded = livestock.tryUpgrade(pen!);
    expect(upgraded?.level).toBe(2);
    expect(penMoatCells(upgraded!)).toHaveLength(0);
  });
});

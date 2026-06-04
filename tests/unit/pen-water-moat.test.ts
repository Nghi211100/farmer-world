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

function clearMoatPad(grid: GridSystem, anchorGx: number, anchorGy: number): void {
  for (let dy = -1; dy <= 3; dy++) {
    for (let dx = -1; dx <= 3; dx++) {
      const gx = anchorGx + dx;
      const gy = anchorGy + dy;
      if (!grid.inBounds(gx, gy)) continue;
      grid.setCell(gx, gy, { type: 'grass', walkable: true, object: undefined });
    }
  }
}

describe('duck/fish pen water moat', () => {
  it('penHasWaterMoat is true only for duck and fish', () => {
    expect(penHasWaterMoat('duck')).toBe(true);
    expect(penHasWaterMoat('fish')).toBe(true);
    expect(penHasWaterMoat('chicken')).toBe(false);
    expect(penHasWaterMoat('cow')).toBe(false);
  });

  it('level-1 duck pen has sixteen moat cells around 3×3', () => {
    const pen = createNewPen('d', 'duck', 5, 5, 1);
    expect(penMoatCells(pen)).toHaveLength(16);
    expect(penFootprintCells(pen)).toHaveLength(9);
    expect(penOccupiesCell(pen, 4, 5)).toBe(true);
    expect(penOccupiesCell(pen, 5, 5)).toBe(true);
    expect(penOccupiesCell(pen, 3, 5)).toBe(false);
  });

  it('placing duck pen converts moat ring to water tiles', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    for (const { gx, gy } of penMoatCells(pen!)) {
      expect(grid.getCell(gx, gy)?.type).toBe('water');
      expect(grid.getCell(gx, gy)?.walkable).toBe(false);
      expect(grid.getCell(gx, gy)?.object).toBe(PEN_MOAT_WATER_OBJECT);
    }
  });

  it('does not convert path or existing river cells in moat ring', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);

    const moatPath = { gx: 7, gy: 8 };
    grid.setCell(moatPath.gx, moatPath.gy, {
      type: 'path',
      walkable: true,
      pathVariant: 'stone_path',
      object: undefined,
    });
    const riverBesideMoat = { gx: 6, gy: 9 };
    grid.setCell(riverBesideMoat.gx, riverBesideMoat.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    expect(grid.getCell(moatPath.gx, moatPath.gy)?.type).toBe('path');
    expect(grid.getCell(riverBesideMoat.gx, riverBesideMoat.gy)?.type).toBe('water');
    const grassOutside = { gx: 6, gy: 8 };
    expect(grid.getCell(grassOutside.gx, grassOutside.gy)?.type).toBe('grass');
  });

  it('moving pen restores only pen_moat_water cells to grass, not river', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);
    clearMoatPad(grid, 12, 12);

    const riverBesideMoat = { gx: 6, gy: 9 };
    grid.setCell(riverBesideMoat.gx, riverBesideMoat.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    const moatRiverJunction = penMoatCells(pen!).find((c) => c.gx === 7 && c.gy === 9)!;
    expect(grid.getCell(moatRiverJunction.gx, moatRiverJunction.gy)?.object).toBe(
      PEN_MOAT_WATER_OBJECT
    );

    livestock.movePenTo(pen!, 12, 12);
    expect(grid.getCell(riverBesideMoat.gx, riverBesideMoat.gy)?.type).toBe('water');
    expect(grid.getCell(riverBesideMoat.gx, riverBesideMoat.gy)?.object).toBeUndefined();
    expect(grid.getCell(moatRiverJunction.gx, moatRiverJunction.gy)?.type).toBe('grass');
  });

  it('allows bridge on moat cell where player river meets duck pen', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { build, livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);

    grid.setCell(6, 9, { type: 'water', walkable: false, object: undefined });

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    const junction = { gx: 7, gy: 9 };
    expect(grid.getCell(junction.gx, junction.gy)?.type).toBe('water');
    expect(grid.canPlaceBridgeAt(junction.gx, junction.gy)).toBe(true);

    const bridgeItem = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(bridgeItem);
    expect(build.canPlace(junction.gx, junction.gy)).toBe(true);
    expect(build.place(junction.gx, junction.gy)).toBe(true);
    expect(grid.getCell(junction.gx, junction.gy)?.pathVariant).toBe('bridge_tile');
    build.exitBuildMode();
  });

  it('cannot place build decor on pen moat cells', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { build, livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'fish')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    const moat = penMoatCells(pen!)[0]!;
    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(moat.gx, moat.gy)).toBe(false);
    build.exitBuildMode();

    const bridgeItem = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(bridgeItem);
    expect(grid.isRiverWaterCell(moat.gx, moat.gy)).toBe(true);
    expect(build.canPlace(moat.gx, moat.gy)).toBe(false);
    build.exitBuildMode();
  });

  it('player cannot walk through moat water', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();

    const moat = penMoatCells(pen!)[0]!;
    expect(isPlayerWalkCell(grid, moat.gx, moat.gy)).toBe(false);
    const inner = penFootprintCells(pen!)[0]!;
    expect(canPlayerWalkTo(grid, moat.gx, moat.gy - 1, inner.gx, inner.gy)).toBe(false);
  });

  it('duck pen can upgrade after placement (own moat cells become inner)', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);
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
    expect(penMoatCells(upgraded!).length).toBe(20);
  });

  it('moving duck pen clears old moat and applies water at new anchor', () => {
    const grid = new GridSystem();
    seedGrassVoid(grid);
    const { livestock } = wireFarmWalkBlocking(grid);
    clearMoatPad(grid, 8, 8);
    clearMoatPad(grid, 12, 12);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    const oldMoat = penMoatCells(pen!)[0]!;

    expect(livestock.canMovePenTo(pen!, 12, 12)).toBe(true);
    livestock.movePenTo(pen!, 12, 12);
    expect(grid.getCell(oldMoat.gx, oldMoat.gy)?.type).toBe('grass');
    const moved = livestock.getPenAt(12, 12)!;
    for (const { gx, gy } of penMoatCells(moved)) {
      expect(grid.getCell(gx, gy)?.type).toBe('water');
    }
  });
});

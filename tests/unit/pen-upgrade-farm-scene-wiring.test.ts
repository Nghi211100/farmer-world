import { describe, expect, it } from 'vitest';
import { BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import { LIVESTOCK_PEN_UPGRADE_COST } from '../../src/config/LivestockConfig';
import { penFootprintCells } from '../../src/config/livestockAssets';
import { createDefaultFarmPens } from '../../src/systems/livestockLogic';

/** Mirrors FarmScene.create() livestock ↔ build placementBlocked wiring. */
function farmSceneLivestock(grid: GridSystem) {
  const build = new BuildSystem(grid);
  const livestock = new LivestockSystem(grid);
  build.setPlacementBlocked((gx, gy) => livestock.getPenAt(gx, gy) != null);
  livestock.setPlacementBlocked((gx, gy) =>
    build.getBuildings().some((b) => b.gridX === gx && b.gridY === gy)
  );
  return { build, livestock };
}

describe('pen upgrade — FarmScene placement wiring', () => {
  it('fresh chicken pen on empty grass upgrades to 4×4 when ring is clear', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const { livestock } = farmSceneLivestock(grid);
    livestock.loadPens([]);

    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placed = null as ReturnType<LivestockSystem['place']>;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (!livestock.canPlace(gx, gy)) continue;
        placed = livestock.place(gx, gy);
        if (placed) {
          const block = livestock.getPenUpgradeBlockMessage(placed);
          if (!block) break outer;
          livestock.loadPens([]);
          livestock.enterPlaceMode(item);
        }
      }
    }
    livestock.exitPlaceMode();
    expect(placed).not.toBeNull();
    expect(livestock.canUpgradeAt(placed!)).toBe(true);
    const upgraded = livestock.tryUpgrade(placed!);
    expect(upgraded?.level).toBe(2);
    expect(penFootprintCells(livestock.getPenAt(placed!.gridX, placed!.gridY)!).length).toBe(16);
  });

  it('default-map upgradeable pens pass with FarmScene wiring', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const { livestock } = farmSceneLivestock(grid);
    const upgradeable = new Set(['chicken', 'ruminant', 'cow', 'pig']);
    for (const pen of createDefaultFarmPens()) {
      const label = pen.penKind === 'ruminant' ? 'ruminant' : pen.animalType;
      livestock.loadPens([pen]);
      expect(livestock.canUpgradeAt(pen)).toBe(upgradeable.has(label));
      if (upgradeable.has(label)) {
        expect(livestock.tryUpgrade(pen)?.level).toBe(2);
      }
    }
  });

  it('upgrade cost constant matches economy gate', () => {
    expect(LIVESTOCK_PEN_UPGRADE_COST).toBe(150);
  });
});

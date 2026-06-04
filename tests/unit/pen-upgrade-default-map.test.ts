import { describe, expect, it } from 'vitest';
import type { LivestockPenData } from '../../src/config/LivestockConfig';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem } from '../../src/systems/LivestockSystem';
import {
  createDefaultFarmPens,
  penUpgradeExpansionCells,
} from '../../src/systems/livestockLogic';
import { penFootprintCells } from '../../src/config/livestockAssets';

/** Default anchors on minimal map — duck/fish sit near map edge in the 4×4 ring. */
const UPGRADEABLE_DEFAULT = new Set(['chicken', 'ruminant', 'cow', 'pig']);

function seedGrassForPen(grid: GridSystem, pen: LivestockPenData): void {
  for (const { gx, gy } of penFootprintCells(pen)) {
    grid.setCell(gx, gy, { type: 'grass', walkable: true, object: undefined });
  }
  for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
    if (!grid.inBounds(gx, gy)) continue;
    const cell = grid.getCell(gx, gy);
    if (cell?.type === 'soil' || cell?.type === 'path') continue;
    grid.setCell(gx, gy, { type: 'grass', walkable: true, object: undefined });
  }
}

describe('default map pen upgrades', () => {
  for (const pen of createDefaultFarmPens()) {
    const label = pen.penKind === 'ruminant' ? 'ruminant' : pen.animalType;
    const expectUpgrade = UPGRADEABLE_DEFAULT.has(label);
    it(`${expectUpgrade ? 'allows' : 'blocks'} upgrade for default ${label} pen`, () => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      if (expectUpgrade) seedGrassForPen(grid, pen);
      const livestock = new LivestockSystem(grid);
      livestock.loadPens([pen]);
      expect(livestock.canUpgradeAt(pen)).toBe(expectUpgrade);
      if (expectUpgrade) {
        expect(livestock.tryUpgrade(pen)?.level).toBe(2);
      } else {
        expect(livestock.tryUpgrade(pen)).toBeNull();
        expect(livestock.getPenUpgradeBlockMessage(pen)).toBeTruthy();
      }
    });
  }
});

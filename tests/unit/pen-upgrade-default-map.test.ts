import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem } from '../../src/systems/LivestockSystem';
import { createDefaultFarmPens } from '../../src/systems/livestockLogic';

/** Default anchors on placeholder map — some sit near water/decor and cannot expand. */
const UPGRADEABLE_DEFAULT = new Set(['chicken', 'ruminant', 'cow', 'pig']);

describe('default map pen upgrades', () => {
  for (const pen of createDefaultFarmPens()) {
    const label = pen.penKind === 'ruminant' ? 'ruminant' : pen.animalType;
    const expectUpgrade = UPGRADEABLE_DEFAULT.has(label);
    it(`${expectUpgrade ? 'allows' : 'blocks'} upgrade for default ${label} pen`, () => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
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

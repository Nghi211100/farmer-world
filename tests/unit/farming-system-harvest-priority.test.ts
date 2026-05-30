import { describe, expect, it } from 'vitest';
import { getCropDef } from '../../src/config/CropConfig';
import { CropLifecycleState } from '../../src/config/gameConfig';
import type { CropTileData } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';
import { FarmingSystem } from '../../src/systems/FarmingSystem';

function setupSystems() {
  const grid = new GridSystem();
  grid.generatePlaceholderMap();
  const farming = new FarmingSystem(grid);
  return { farming };
}

function readyCrop(overrides: Partial<CropTileData> = {}): CropTileData {
  const now = Date.now();
  return {
    cropType: 'wheat',
    kind: 'wheat',
    stage: CropLifecycleState.READY,
    waterLevel: 0,
    wateredMilestoneCount: 1,
    plantedAt: now - 60_000,
    lastWaterTime: now - 60_000,
    growthElapsedSec: getCropDef('wheat').growTimeSec,
    lastTickAt: now - 1_000,
    dug: true,
    soilIdleDry: false,
    soilIdleDrySince: undefined,
    ...overrides,
  };
}

describe('FarmingSystem harvest priority', () => {
  it('treats ready crop as harvestable even when crop moisture is dry', () => {
    const { farming } = setupSystems();
    farming.importCrops({
      '8,8': readyCrop({ waterLevel: 0 }),
    });

    expect(farming.isReady(8, 8)).toBe(true);
    expect(farming.canWater(8, 8)).toBe(false);
    expect(farming.harvest(8, 8)).toEqual({
      kind: 'wheat',
      yield: getCropDef('wheat').yield,
    });
  });

  it('allows harvesting ready crop even when soil is idle-dry', () => {
    const { farming } = setupSystems();
    const now = Date.now();
    farming.importCrops({
      '8,8': readyCrop({
        soilIdleDry: true,
        soilIdleDrySince: now - 10_000,
        lastFarmActivityAt: now - 180_000,
      }),
    });

    expect(farming.isReady(8, 8)).toBe(true);
    expect(farming.canWater(8, 8)).toBe(false);
    expect(farming.harvest(8, 8)).not.toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { CropLifecycleState, FARMING } from '../../src/config/gameConfig';
import type { CropTileData } from '../../src/config/gameConfig';
import {
  applyFarmActivityStamp,
  applySoilIdleDryState,
  isPlotSubjectToSoilIdle,
  isSoilIdleDryAt,
  shouldBecomeSoilIdleDry,
  SOIL_IDLE_DRY_MS,
} from '../../src/systems/soilIdleLogic';

function emptyDugCrop(overrides: Partial<CropTileData> = {}): CropTileData {
  return {
    stage: CropLifecycleState.EMPTY,
    waterLevel: 0,
    plantedAt: 0,
    lastWaterTime: 0,
    growthElapsedSec: 0,
    lastTickAt: 0,
    dug: true,
    ...overrides,
  };
}

describe('soilIdleLogic', () => {
  it('exports 2 minute dry threshold aligned with FARMING config', () => {
    expect(SOIL_IDLE_DRY_MS).toBe(120_000);
    expect(FARMING.soilIdleDryMs).toBe(SOIL_IDLE_DRY_MS);
  });

  it('tracks idle on dug empty soil and planted crops, not while digging', () => {
    const unlockedSoil = { unlocked: true, cellType: 'soil' as const };
    expect(
      isPlotSubjectToSoilIdle({
        ...unlockedSoil,
        crop: emptyDugCrop(),
      })
    ).toBe(true);
    expect(
      isPlotSubjectToSoilIdle({
        ...unlockedSoil,
        crop: emptyDugCrop({
          cropType: 'wheat',
          kind: 'wheat',
          stage: CropLifecycleState.PLANTED,
        }),
      })
    ).toBe(true);
    expect(
      isPlotSubjectToSoilIdle({
        ...unlockedSoil,
        crop: emptyDugCrop({ stage: CropLifecycleState.DIGGING, dug: false }),
      })
    ).toBe(false);
    expect(
      isPlotSubjectToSoilIdle({
        unlocked: false,
        cellType: 'soil',
        crop: emptyDugCrop(),
      })
    ).toBe(false);
  });

  it('becomes dry after 2 minutes without farm activity', () => {
    const now = 1_000_000;
    const last = now - SOIL_IDLE_DRY_MS;
    expect(isSoilIdleDryAt(last, now, true)).toBe(true);
    expect(isSoilIdleDryAt(last + 1, now, true)).toBe(false);
    expect(isSoilIdleDryAt(last, now, false)).toBe(false);
  });

  it('shouldBecomeSoilIdleDry only once until cleared', () => {
    const crop = emptyDugCrop({ lastFarmActivityAt: 1000 });
    const now = 1000 + SOIL_IDLE_DRY_MS;
    expect(shouldBecomeSoilIdleDry(crop, now, true)).toBe(true);
    applySoilIdleDryState(crop, now);
    expect(shouldBecomeSoilIdleDry(crop, now + 1000, true)).toBe(false);
  });

  it('water or till clears dry and resets activity timestamp', () => {
    const crop = emptyDugCrop({
      lastFarmActivityAt: 1000,
      soilIdleDry: true,
      soilIdleDrySince: 100,
    });
    const now = 500_000;
    applyFarmActivityStamp(crop, now);
    expect(crop.soilIdleDry).toBe(false);
    expect(crop.soilIdleDrySince).toBeUndefined();
    expect(crop.lastFarmActivityAt).toBe(now);
    expect(
      isSoilIdleDryAt(crop.lastFarmActivityAt, now + SOIL_IDLE_DRY_MS - 1, true)
    ).toBe(false);
  });
});

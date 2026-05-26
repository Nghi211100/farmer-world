import type { CropDefinition } from '../config/CropConfig';
import { FARMING } from '../config/gameConfig';

export interface CropGrowthState {
  growthElapsedSec: number;
  wateredMilestoneCount: number;
}

/** True when crop has reached the next water milestone and player has not watered yet. */
export function isCropDry(
  growth: CropGrowthState,
  waterMilestonesSec: readonly number[]
): boolean {
  const idx = growth.wateredMilestoneCount;
  if (idx >= waterMilestonesSec.length) return false;
  return growth.growthElapsedSec >= waterMilestonesSec[idx];
}

export function growthRateForCrop(
  growth: CropGrowthState,
  waterMilestonesSec: readonly number[]
): number {
  return isCropDry(growth, waterMilestonesSec) ? FARMING.growthRateWithoutWater : 1;
}

/**
 * Advance effective growth toward {@link CropDefinition.growTimeSec}.
 * Splits ticks at water milestones so dry slowdown starts exactly at milestone elapsed time.
 */
export function advanceCropGrowth(
  growth: CropGrowthState,
  wallSec: number,
  def: Pick<CropDefinition, 'growTimeSec' | 'waterMilestonesSec'>
): CropGrowthState {
  if (wallSec <= 0) return growth;

  let remaining = wallSec;
  let elapsed = growth.growthElapsedSec;
  let wateredCount = growth.wateredMilestoneCount;

  while (remaining > 0 && elapsed < def.growTimeSec) {
    const state: CropGrowthState = {
      growthElapsedSec: elapsed,
      wateredMilestoneCount: wateredCount,
    };
    const dry = isCropDry(state, def.waterMilestonesSec);
    const rate = dry ? FARMING.growthRateWithoutWater : 1;

    if (!dry) {
      const nextMilestone = def.waterMilestonesSec[wateredCount];
      if (nextMilestone !== undefined && elapsed < nextMilestone) {
        const effectiveToMilestone = nextMilestone - elapsed;
        const wallToMilestone = effectiveToMilestone / rate;
        const step = Math.min(remaining, wallToMilestone);
        elapsed += step * rate;
        remaining -= step;
        continue;
      }
    }

    const effectiveLeft = def.growTimeSec - elapsed;
    const wallNeeded = effectiveLeft / rate;
    const step = Math.min(remaining, wallNeeded);
    elapsed += step * rate;
    remaining -= step;
  }

  return {
    growthElapsedSec: Math.min(elapsed, def.growTimeSec),
    wateredMilestoneCount: wateredCount,
  };
}

/** Wall-clock seconds until mature at the current growth rate. */
export function remainingGrowSec(
  growth: CropGrowthState,
  def: Pick<CropDefinition, 'growTimeSec' | 'waterMilestonesSec'>
): number {
  const deficit = Math.max(0, def.growTimeSec - growth.growthElapsedSec);
  const rate = growthRateForCrop(growth, def.waterMilestonesSec);
  return deficit / rate;
}

/** Infer milestone count from legacy continuous waterLevel saves. */
export function inferWateredMilestoneCount(
  growthElapsedSec: number,
  waterLevel: number,
  waterMilestonesSec: readonly number[]
): number {
  let count = 0;
  for (const milestone of waterMilestonesSec) {
    if (growthElapsedSec < milestone) break;
    if (waterLevel < FARMING.waterThreshold) return count;
    count++;
  }
  return count;
}

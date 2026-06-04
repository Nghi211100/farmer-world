import { CropLifecycleState, FARMING, type CropTileData } from '../config/gameConfig';

/** Wall-clock ms without {@link countsAsFarmActivity} before plot is neglected-dry. */
export const SOIL_IDLE_DRY_MS = 120_000;

/**
 * Player actions that count as "canh tác" (working the plot) and reset the idle timer.
 * Dig/hoe (xới), plant, water, harvest.
 */
export const FARM_ACTIVITY_KINDS = ['dig', 'plant', 'water', 'harvest'] as const;
export type FarmActivityKind = (typeof FARM_ACTIVITY_KINDS)[number];

export function countsAsFarmActivity(_kind: FarmActivityKind): boolean {
  return true;
}

export interface SoilIdlePlotContext {
  unlocked: boolean;
  cellType: 'void' | 'grass' | 'soil' | 'water' | 'path';
  crop: CropTileData | null;
}

/** Unlocked farm soil that has been tilled (dug empty) or has a crop lifecycle record. */
export function isPlotSubjectToSoilIdle(ctx: SoilIdlePlotContext): boolean {
  if (!ctx.unlocked || ctx.cellType !== 'soil') return false;
  const crop = ctx.crop;
  if (!crop) return false;
  if (crop.stage === CropLifecycleState.DIGGING) return false;
  const kind = crop.cropType ?? crop.kind;
  if (kind) return true;
  return crop.dug === true && crop.stage === CropLifecycleState.EMPTY;
}

export function isSoilIdleDryAt(
  lastFarmActivityAt: number | undefined,
  now: number,
  subject: boolean
): boolean {
  if (!subject) return false;
  if (lastFarmActivityAt == null || lastFarmActivityAt <= 0) return false;
  return now - lastFarmActivityAt >= FARMING.soilIdleDryMs;
}

export function shouldBecomeSoilIdleDry(
  crop: CropTileData,
  now: number,
  subject: boolean
): boolean {
  if (crop.soilIdleDry) return false;
  return isSoilIdleDryAt(crop.lastFarmActivityAt, now, subject);
}

/** Stamp activity time and clear neglect-dry (after water or till). */
export function applyFarmActivityStamp(
  crop: CropTileData,
  now: number
): void {
  crop.lastFarmActivityAt = now;
  crop.soilIdleDry = false;
  crop.soilIdleDrySince = undefined;
}

export function applySoilIdleDryState(crop: CropTileData, now: number): void {
  crop.soilIdleDry = true;
  crop.soilIdleDrySince = now;
}

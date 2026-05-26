import type { CropId } from './CropConfig';
import { CropLifecycleState } from './gameConfig';

export interface CropStageSize {
  width: number;
  height: number;
  /** Per-stage anchor tweak (px); positive sinks, negative lifts. */
  offsetY?: number;
}

export interface CropRenderEntry {
  /** Extra Y at tile bottom anchor; positive sinks down, negative lifts. */
  offsetY: number;
  stages: Record<1 | 2 | 3 | 4, CropStageSize>;
}

/** Global downward shift (px) so crop dirt mound meets the 64×32 tile plane. Tunable. */
export const CROP_SINK_Y = -3;

/**
 * On-screen crop display sizes (px), NOT tile footprint.
 * Footprint 64×32; width fixed 64; height only varies; anchor 0.5, 1 (CropRenderer).
 * PNG sources may be much larger; CropRenderer scales down to match.
 */
export const CROP_RENDER_CONFIG: Record<CropId, CropRenderEntry> = {
  wheat: {
    offsetY: 0,
    stages: {
      1: { width: 64, height: 32 },
      2: { width: 64, height: 46 },
      3: { width: 64, height: 39 },
      4: { width: 64, height: 45 },
    },
  },
  corn: {
    offsetY: 0,
    stages: {
      1: { width: 64, height: 32 },
      2: { width: 64, height: 46 },
      3: { width: 64, height: 38 },
      4: { width: 64, height: 52 },
    },
  },
  carrot: {
    offsetY: 0,
    stages: {
      1: { width: 64, height: 32 },
      2: { width: 64, height: 37 },
      3: { width: 64, height: 33 },
      4: { width: 64, height: 39 },
    },
  },
  pumpkin: {
    offsetY: 0,
    stages: {
      1: { width: 64, height: 32 },
      2: { width: 64, height: 36 },
      3: { width: 64, height: 32 },
      4: { width: 64, height: 40 },
    },
  },
  tomato: {
    offsetY: 0,
    stages: {
      1: { width: 64, height: 35 },
      2: { width: 64, height: 36 },
      3: { width: 64, height: 40 },
      4: { width: 64, height: 45 },
    },
  },
};

export type CropRenderStage = 1 | 2 | 3 | 4;

function clampStage(stageNumber: number): CropRenderStage {
  const s = Math.min(4, Math.max(1, Math.round(stageNumber)));
  return s as CropRenderStage;
}

export function getCropDisplaySize(
  cropType: CropId,
  stageNumber: number
): CropStageSize {
  const stage = clampStage(stageNumber);
  return CROP_RENDER_CONFIG[cropType].stages[stage];
}

export function getCropOffsetY(cropType: CropId, stageNumber?: number): number {
  const entry = CROP_RENDER_CONFIG[cropType];
  let stageOffset = 0;
  if (stageNumber !== undefined) {
    const stage = clampStage(stageNumber);
    stageOffset = entry.stages[stage].offsetY ?? 0;
  }
  return entry.offsetY + stageOffset;
}

/** Screen Y for crop anchor (origin 0.5, 1) at tile bottom center. */
export function getCropAnchorY(footY: number, cropType: CropId, stageNumber?: number): number {
  return footY + getCropOffsetY(cropType, stageNumber) + CROP_SINK_Y;
}

/**
 * Map FarmingSystem lifecycle → render stage (texture + footprint).
 * PLANTED/STAGE1 → 1, STAGE2 → 2, STAGE3 → 3, READY → 4.
 */
export function lifecycleStageToRenderStage(stage: CropLifecycleState): CropRenderStage {
  switch (stage) {
    case CropLifecycleState.PLANTED:
    case CropLifecycleState.STAGE1:
      return 1;
    case CropLifecycleState.STAGE2:
      return 2;
    case CropLifecycleState.STAGE3:
      return 3;
    case CropLifecycleState.READY:
      return 4;
    default:
      return 1;
  }
}

/**
 * Display stage for scaling/anchor — must match getTextureKey visual stage.
 * While growing, visualStage can reach 4 before lifecycle READY (progress ≥ 75%).
 */
export function resolveCropRenderStage(
  lifecycle: CropLifecycleState,
  visualStage?: number
): CropRenderStage {
  if (lifecycle === CropLifecycleState.READY) return 4;
  if (visualStage !== undefined && visualStage > 0) {
    return clampStage(visualStage);
  }
  return lifecycleStageToRenderStage(lifecycle);
}

import { FARM_SOIL_BOUNDS } from '../config/gameConfig';
import { penFootprintOccupiesCell } from '../config/livestockAssets';
import type { MoveSession } from '../systems/ObjectEditSystem';

/** Hold duration before object follows the pointer (ms); near-immediate pickup. */
export const OBJECT_MOVE_LONG_PRESS_MS = 75;

/** Subtle squash/stretch while picked up (buildings/naturals only; pens use exact display size). */
export const OBJECT_MOVE_PICKUP_SCALE_X = 1.02;
export const OBJECT_MOVE_PICKUP_SCALE_Y = 0.95;

export function isCellInFarmSoilBounds(gx: number, gy: number): boolean {
  return (
    gx >= FARM_SOIL_BOUNDS.minX &&
    gx <= FARM_SOIL_BOUNDS.maxX &&
    gy >= FARM_SOIL_BOUNDS.minY &&
    gy <= FARM_SOIL_BOUNDS.maxY
  );
}

/** True when grid cell is part of the object being moved (saved origin and/or ghost preview). */
export function isGridOnMoveSessionOrigin(
  session: MoveSession,
  gx: number,
  gy: number,
  previewGx?: number,
  previewGy?: number
): boolean {
  const { originGx, originGy, payload } = session;
  if (payload.kind === 'pen') {
    const level = payload.pen.level;
    if (penFootprintOccupiesCell({ gridX: originGx, gridY: originGy, level }, gx, gy)) {
      return true;
    }
    if (
      previewGx !== undefined &&
      previewGy !== undefined &&
      (previewGx !== originGx || previewGy !== originGy) &&
      penFootprintOccupiesCell({ gridX: previewGx, gridY: previewGy, level }, gx, gy)
    ) {
      return true;
    }
    return false;
  }
  if (gx === originGx && gy === originGy) return true;
  if (
    previewGx !== undefined &&
    previewGy !== undefined &&
    gx === previewGx &&
    gy === previewGy
  ) {
    return true;
  }
  return false;
}

export function objectMovePickupScale(
  baseScaleX: number,
  baseScaleY: number
): { scaleX: number; scaleY: number } {
  return {
    scaleX: baseScaleX * OBJECT_MOVE_PICKUP_SCALE_X,
    scaleY: baseScaleY * OBJECT_MOVE_PICKUP_SCALE_Y,
  };
}

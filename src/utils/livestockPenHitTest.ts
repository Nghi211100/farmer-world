import {
  penFootprintOccupiesCell,
  type LivestockPenLevel,
} from '../config/livestockAssets';

export interface LivestockPenHitCandidate {
  id: string;
  gridX: number;
  gridY: number;
  level?: LivestockPenLevel;
  depth: number;
  visible: boolean;
  alpha: number;
}

function footprintHit(
  candidate: LivestockPenHitCandidate,
  gx: number,
  gy: number
): boolean {
  return penFootprintOccupiesCell(
    { gridX: candidate.gridX, gridY: candidate.gridY, level: candidate.level },
    gx,
    gy
  );
}

/**
 * Resolve pen target from grid cell — only footprint tiles (3×3 or 4×4), not moat or sprite bounds.
 * Prefers top-most depth so overlapping pens remain deterministic.
 */
export function pickLivestockPenAtGridCell(
  candidates: LivestockPenHitCandidate[],
  gx: number,
  gy: number
): LivestockPenHitCandidate | undefined {
  const hits = candidates.filter(
    (candidate) =>
      candidate.visible &&
      candidate.alpha > 0 &&
      footprintHit(candidate, gx, gy)
  );
  if (hits.length === 0) return undefined;
  hits.sort((a, b) => b.depth - a.depth || b.gridY - a.gridY || b.gridX - a.gridX);
  return hits[0];
}

/**
 * @deprecated Use pickLivestockPenAtGridCell after world→grid conversion.
 * Kept as alias for callers that still pass world coords with a grid resolver.
 */
export function pickLivestockPenAtWorldPoint(
  candidates: LivestockPenHitCandidate[],
  worldX: number,
  worldY: number,
  worldToGrid: (worldX: number, worldY: number) => { x: number; y: number }
): LivestockPenHitCandidate | undefined {
  const { x, y } = worldToGrid(worldX, worldY);
  return pickLivestockPenAtGridCell(candidates, x, y);
}

export type GridPoint = { gx: number; gy: number };

/** Manhattan distance between two grid anchors (stable, cheap tie-breaker). */
export function gridManhattanDistance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
}

/**
 * Among all cells passing `canPlaceAt`, return the anchor nearest to `near` (Manhattan on grid).
 * Tie-break: lower gy, then lower gx (stable scan order).
 */
export function findNearestValidGridPlacement(
  gridSize: number,
  near: GridPoint,
  canPlaceAt: (gx: number, gy: number) => boolean
): GridPoint | null {
  let best: GridPoint | null = null;
  let bestDist = Infinity;
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      if (!canPlaceAt(gx, gy)) continue;
      const dist = gridManhattanDistance({ gx, gy }, near);
      if (best === null || dist < bestDist) {
        bestDist = dist;
        best = { gx, gy };
      } else if (dist === bestDist) {
        if (gy < best.gy || (gy === best.gy && gx < best.gx)) {
          best = { gx, gy };
        }
      }
    }
  }
  return best;
}

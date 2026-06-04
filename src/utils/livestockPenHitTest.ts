export interface LivestockPenHitCandidate {
  id: string;
  gridX: number;
  gridY: number;
  depth: number;
  visible: boolean;
  alpha: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

function containsPoint(
  bounds: LivestockPenHitCandidate['bounds'],
  worldX: number,
  worldY: number
): boolean {
  return (
    worldX >= bounds.x &&
    worldX <= bounds.x + bounds.width &&
    worldY >= bounds.y &&
    worldY <= bounds.y + bounds.height
  );
}

/**
 * Resolve pen target from world coordinates using rendered pen-house bounds.
 * Prefers top-most depth so overlapping pens remain deterministic.
 */
export function pickLivestockPenAtWorldPoint(
  candidates: LivestockPenHitCandidate[],
  worldX: number,
  worldY: number
): LivestockPenHitCandidate | undefined {
  const hits = candidates.filter(
    (candidate) =>
      candidate.visible &&
      candidate.alpha > 0 &&
      candidate.bounds.width > 0 &&
      candidate.bounds.height > 0 &&
      containsPoint(candidate.bounds, worldX, worldY)
  );
  if (hits.length === 0) return undefined;
  hits.sort((a, b) => b.depth - a.depth || b.gridY - a.gridY || b.gridX - a.gridX);
  return hits[0];
}

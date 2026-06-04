import type { GridSystem } from '../systems/GridSystem';

export type GridCoord = { gx: number; gy: number };

const CARDINAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function coordKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

/** Whether the farmer can stand on this cell (grid walkable + optional extra blockers). */
export function isPlayerWalkCell(grid: GridSystem, gx: number, gy: number): boolean {
  return grid.isWalkable(gx, gy);
}

/**
 * Shortest 4-connected path between two walkable cells (excludes start, includes goal).
 * Returns null when no route exists.
 */
export function findPlayerWalkPath(
  grid: GridSystem,
  fromGx: number,
  fromGy: number,
  toGx: number,
  toGy: number
): GridCoord[] | null {
  if (!grid.inBounds(fromGx, fromGy) || !grid.inBounds(toGx, toGy)) return null;
  if (!isPlayerWalkCell(grid, toGx, toGy)) return null;
  if (fromGx === toGx && fromGy === toGy) return [];

  const startKey = coordKey(fromGx, fromGy);
  const goalKey = coordKey(toGx, toGy);
  const queue: GridCoord[] = [{ gx: fromGx, gy: fromGy }];
  const cameFrom = new Map<string, string | null>([[startKey, null]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = coordKey(current.gx, current.gy);
    if (currentKey === goalKey) {
      const path: GridCoord[] = [];
      let cursor: string | null = goalKey;
      while (cursor && cursor !== startKey) {
        const [gx, gy] = cursor.split(',').map(Number);
        path.unshift({ gx, gy });
        cursor = cameFrom.get(cursor) ?? null;
      }
      return path;
    }

    for (const [dx, dy] of CARDINAL_OFFSETS) {
      const nx = current.gx + dx;
      const ny = current.gy + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const nextKey = coordKey(nx, ny);
      if (cameFrom.has(nextKey)) continue;
      if (!isPlayerWalkCell(grid, nx, ny)) continue;
      cameFrom.set(nextKey, currentKey);
      queue.push({ gx: nx, gy: ny });
    }
  }

  return null;
}

/** True when a full walk route exists to the destination cell. */
export function canPlayerWalkTo(
  grid: GridSystem,
  fromGx: number,
  fromGy: number,
  toGx: number,
  toGy: number
): boolean {
  return findPlayerWalkPath(grid, fromGx, fromGy, toGx, toGy) !== null;
}

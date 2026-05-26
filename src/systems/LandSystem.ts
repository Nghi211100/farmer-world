import type { GridSystem } from './GridSystem';

export class LandSystem {
  /** Grass tile adjacent to at least one unlocked soil tile — eligible for purchase */
  canExpandAt(grid: GridSystem, gx: number, gy: number): boolean {
    const cell = grid.getCell(gx, gy);
    if (!cell || cell.object || (cell.type !== 'grass' && cell.type !== 'path')) return false;
    return this.hasAdjacentUnlockedSoil(grid, gx, gy);
  }

  /** Locked soil adjacent to unlocked soil — unlock via land purchase */
  canUnlockSoilAt(grid: GridSystem, gx: number, gy: number): boolean {
    if (!grid.isLockedSoil(gx, gy)) return false;
    return this.hasAdjacentUnlockedSoil(grid, gx, gy);
  }

  private hasAdjacentUnlockedSoil(grid: GridSystem, gx: number, gy: number): boolean {
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const n = grid.getCell(gx + dx, gy + dy);
      if (n?.type === 'soil' && grid.isFarmUnlocked(gx + dx, gy + dy)) return true;
    }
    return false;
  }

  /** Next locked soil to unlock (closest to farm center, then reading order). */
  findNextLockedSoil(grid: GridSystem): { x: number; y: number } | null {
    const center = grid.getFarmSoilCenter();
    const locked = grid.getSoilTileCoords().filter(({ x, y }) => grid.isLockedSoil(x, y));
    if (locked.length === 0) return null;

    locked.sort((a, b) => {
      const da = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
      const db = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
      if (da !== db) return da - db;
      return a.y - b.y || a.x - b.x;
    });

    for (const tile of locked) {
      if (this.hasAdjacentUnlockedSoil(grid, tile.x, tile.y)) return tile;
    }
    return null;
  }

  unlockNextSoilTile(grid: GridSystem): { x: number; y: number } | null {
    const next = this.findNextLockedSoil(grid);
    if (!next) return null;
    if (!grid.unlockSoilTile(next.x, next.y)) return null;
    return next;
  }

  expandTile(grid: GridSystem, gx: number, gy: number): boolean {
    if (grid.unlockSoilTile(gx, gy)) return true;
    if (!this.canExpandAt(grid, gx, gy)) return false;
    grid.setCell(gx, gy, { type: 'soil', walkable: true, unlocked: true, object: undefined });
    return true;
  }

  /** Purchase land: prefer unlocking locked soil, else expand grass at tap. */
  purchaseAt(
    grid: GridSystem,
    gx: number,
    gy: number
  ): { ok: boolean; kind: 'unlock' | 'expand' | 'none' } {
    if (this.canUnlockSoilAt(grid, gx, gy) && grid.unlockSoilTile(gx, gy)) {
      return { ok: true, kind: 'unlock' };
    }
    const auto = this.unlockNextSoilTile(grid);
    if (auto) return { ok: true, kind: 'unlock' };
    if (this.expandTile(grid, gx, gy)) return { ok: true, kind: 'expand' };
    return { ok: false, kind: 'none' };
  }
}

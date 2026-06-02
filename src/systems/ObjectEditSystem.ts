import type { BuildingData } from '../config/gameConfig';
import {
  getLivestockPenTextureKeyForPen,
  type LivestockPenData,
} from '../config/LivestockConfig';
import { penFootprintTiles } from '../config/livestockAssets';
import type { BuildSystem } from './BuildSystem';
import type { GridSystem } from './GridSystem';
import type { LivestockSystem } from './LivestockSystem';

export type EditableObject =
  | { kind: 'building'; building: BuildingData }
  | { kind: 'natural'; textureKey: string }
  | { kind: 'pen'; pen: LivestockPenData };

export type MoveSession = {
  originGx: number;
  originGy: number;
  payload: EditableObject;
};

/** Move/remove editing for buildings, map naturals, and livestock pens. */
export class ObjectEditSystem {
  active = false;
  previewLocked = false;
  ghostX = 0;
  ghostY = 0;
  private session: MoveSession | null = null;

  constructor(
    private grid: GridSystem,
    private build: BuildSystem,
    private livestock?: LivestockSystem
  ) {}

  findEditableAt(gx: number, gy: number): EditableObject | null {
    const pen = this.livestock?.getPenAt(gx, gy);
    if (pen) return { kind: 'pen', pen };
    const building = this.build.findBuildingAt(gx, gy);
    if (building) return { kind: 'building', building };
    const cell = this.grid.getCell(gx, gy);
    if (!cell?.object) return null;
    if (cell.type === 'water' || cell.type === 'path') return null;
    if (this.grid.isLockedSoil(gx, gy)) return null;
    return { kind: 'natural', textureKey: cell.object };
  }

  canPlaceAt(gx: number, gy: number): boolean {
    if (!this.session) return false;
    const { originGx, originGy, payload } = this.session;
    if (gx === originGx && gy === originGy) return true;
    if (payload.kind === 'pen') {
      return this.livestock?.canMovePenTo(payload.pen, gx, gy) ?? false;
    }
    return this.build.canPlaceObjectAt(gx, gy);
  }

  removeAt(gx: number, gy: number): boolean {
    const obj = this.findEditableAt(gx, gy);
    if (!obj) return false;
    if (obj.kind === 'pen') return false;
    if (obj.kind === 'building') {
      return this.build.removeBuildingAt(gx, gy);
    }
    this.grid.clearObject(gx, gy);
    return true;
  }

  beginMove(gx: number, gy: number): MoveSession | null {
    const payload = this.findEditableAt(gx, gy);
    if (!payload || payload.kind === 'pen' && payload.pen.state === 'producing') {
      return null;
    }
    const anchorGx = payload.kind === 'pen' ? payload.pen.gridX : gx;
    const anchorGy = payload.kind === 'pen' ? payload.pen.gridY : gy;
    this.session = { originGx: anchorGx, originGy: anchorGy, payload };
    this.active = true;
    this.previewLocked = false;
    this.ghostX = anchorGx;
    this.ghostY = anchorGy;
    return this.session;
  }

  getSession(): MoveSession | null {
    return this.session;
  }

  updateGhost(gx: number, gy: number): void {
    if (!this.active || this.previewLocked) return;
    this.ghostX = gx;
    this.ghostY = gy;
  }

  lockPreviewAt(gx: number, gy: number): void {
    this.ghostX = gx;
    this.ghostY = gy;
    this.previewLocked = true;
  }

  unlockPreview(): void {
    this.previewLocked = false;
  }

  confirmMoveAt(gx: number, gy: number): boolean {
    if (!this.session || !this.canPlaceAt(gx, gy)) return false;
    const { originGx, originGy, payload } = this.session;
    if (payload.kind === 'building') {
      if (!this.build.moveBuildingTo(originGx, originGy, gx, gy)) return false;
    } else if (payload.kind === 'pen') {
      if (!this.livestock?.movePenTo(payload.pen, gx, gy)) return false;
    } else if (gx !== originGx || gy !== originGy) {
      this.grid.clearObject(originGx, originGy);
      this.grid.setObject(gx, gy, payload.textureKey);
    }
    this.endMove();
    return true;
  }

  cancelMove(): void {
    this.endMove();
  }

  endMove(): void {
    this.active = false;
    this.previewLocked = false;
    this.session = null;
  }

  ghostTextureKey(): string {
    const session = this.session;
    if (!session) return 'tree_01';
    if (session.payload.kind === 'building') {
      return session.payload.building.textureKey;
    }
    if (session.payload.kind === 'pen') {
      const { pen } = session.payload;
      return getLivestockPenTextureKeyForPen(pen, pen.level ?? 1);
    }
    return session.payload.textureKey;
  }

  ghostFootprintScale(): number {
    const session = this.session;
    if (session?.payload.kind === 'pen') {
      const size = penFootprintTiles(session.payload.pen.level ?? 1).w;
      return 0.85 + size * 0.35;
    }
    return 1;
  }

  isNaturalTexture(textureKey: string): boolean {
    return !textureKey.includes('house') && !textureKey.includes('barn');
  }

  isPenSession(): boolean {
    return this.session?.payload.kind === 'pen';
  }
}

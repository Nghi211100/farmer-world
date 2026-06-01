import type { BuildingData } from '../config/gameConfig';
import type { BuildSystem } from './BuildSystem';
import type { GridSystem } from './GridSystem';

export type EditableObject =
  | { kind: 'building'; building: BuildingData }
  | { kind: 'natural'; textureKey: string };

export type MoveSession = {
  originGx: number;
  originGy: number;
  payload: EditableObject;
};

/** Move/remove editing for placed buildings and map naturals (trees, rocks, bushes). */
export class ObjectEditSystem {
  active = false;
  previewLocked = false;
  ghostX = 0;
  ghostY = 0;
  private session: MoveSession | null = null;

  constructor(
    private grid: GridSystem,
    private build: BuildSystem
  ) {}

  findEditableAt(gx: number, gy: number): EditableObject | null {
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
    const { originGx, originGy } = this.session;
    if (gx === originGx && gy === originGy) return true;
    return this.build.canPlaceObjectAt(gx, gy);
  }

  removeAt(gx: number, gy: number): boolean {
    const obj = this.findEditableAt(gx, gy);
    if (!obj) return false;
    if (obj.kind === 'building') {
      return this.build.removeBuildingAt(gx, gy);
    }
    this.grid.clearObject(gx, gy);
    return true;
  }

  beginMove(gx: number, gy: number): MoveSession | null {
    const payload = this.findEditableAt(gx, gy);
    if (!payload) return null;
    this.session = { originGx: gx, originGy: gy, payload };
    this.active = true;
    this.previewLocked = false;
    this.ghostX = gx;
    this.ghostY = gy;
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
    return session.payload.kind === 'building'
      ? session.payload.building.textureKey
      : session.payload.textureKey;
  }

  isNaturalTexture(textureKey: string): boolean {
    return !textureKey.includes('house') && !textureKey.includes('barn');
  }
}

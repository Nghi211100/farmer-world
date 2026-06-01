import { buildingTextureKey } from '../config/assets';
import { ECONOMY } from '../config/gameConfig';
import type { BuildingData, BuildingType } from '../config/gameConfig';
import type { GridSystem } from './GridSystem';

export type BuildItemType = BuildingType;
export type BuildCategory = 'buildings' | 'decor';

export interface BuildItemDef {
  type: BuildItemType;
  textureKey: string;
  label: string;
  cost: number;
  footprint: { w: number; h: number };
  category: BuildCategory;
  /** When set, card is locked until player level reaches this value. */
  requiredLevel?: number;
}

export const BUILD_ITEMS: BuildItemDef[] = [
  {
    type: 'house',
    textureKey: 'house_lv1',
    label: 'House',
    cost: 50,
    footprint: { w: 1, h: 1 },
    category: 'buildings',
  },
  {
    type: 'barn',
    textureKey: 'barn_lv1',
    label: 'Barn',
    cost: 80,
    footprint: { w: 1, h: 1 },
    category: 'buildings',
  },
  {
    type: 'tree',
    textureKey: 'tree_01',
    label: 'Tree',
    cost: 10,
    footprint: { w: 1, h: 1 },
    category: 'decor',
  },
];

export class BuildSystem {
  active = false;
  selectedItem: BuildItemDef | null = null;
  /** Preview snapped to a tile; ghost no longer follows the pointer. */
  previewLocked = false;
  ghostX = 0;
  ghostY = 0;
  private buildings: BuildingData[] = [];
  private onChange?: () => void;

  constructor(private grid: GridSystem) {}

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  enterBuildMode(item: BuildItemDef): void {
    this.active = true;
    this.selectedItem = item;
    this.previewLocked = false;
  }

  exitBuildMode(): void {
    this.active = false;
    this.selectedItem = null;
    this.previewLocked = false;
  }

  updateGhost(gx: number, gy: number): void {
    if (this.previewLocked) return;
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

  /** Right, down, left, up — first valid neighbor after a placement. */
  findNextPlacementTile(fromGx: number, fromGy: number): { gx: number; gy: number } | null {
    const offsets: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (const [dx, dy] of offsets) {
      const gx = fromGx + dx;
      const gy = fromGy + dy;
      if (this.canPlace(gx, gy)) return { gx, gy };
    }
    return null;
  }

  canPlace(gx: number, gy: number): boolean {
    if (!this.selectedItem || !this.grid.inBounds(gx, gy)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path') return false;
    if (this.buildings.some((b) => b.gridX === gx && b.gridY === gy)) return false;
    return true;
  }

  place(gx: number, gy: number): BuildingData | null {
    if (!this.selectedItem || !this.canPlace(gx, gy)) return null;
    const building: BuildingData = {
      type: this.selectedItem.type,
      textureKey: this.selectedItem.textureKey,
      gridX: gx,
      gridY: gy,
      level: 1,
    };
    this.buildings.push(building);
    this.grid.setObject(gx, gy, building.textureKey);
    this.onChange?.();
    return building;
  }

  findBuildingAt(gx: number, gy: number): BuildingData | null {
    return this.buildings.find((b) => b.gridX === gx && b.gridY === gy) ?? null;
  }

  /** Empty walkable tile suitable for placing or moving a structure (not water/path). */
  canPlaceObjectAt(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path') return false;
    if (this.buildings.some((b) => b.gridX === gx && b.gridY === gy)) return false;
    return true;
  }

  removeBuildingAt(gx: number, gy: number): boolean {
    const idx = this.buildings.findIndex((b) => b.gridX === gx && b.gridY === gy);
    if (idx < 0) return false;
    this.buildings.splice(idx, 1);
    this.grid.clearObject(gx, gy);
    this.onChange?.();
    return true;
  }

  moveBuildingTo(fromGx: number, fromGy: number, toGx: number, toGy: number): boolean {
    const building = this.findBuildingAt(fromGx, fromGy);
    if (!building || !this.canPlaceObjectAt(toGx, toGy)) return false;
    if (fromGx === toGx && fromGy === toGy) return true;
    this.grid.clearObject(fromGx, fromGy);
    building.gridX = toGx;
    building.gridY = toGy;
    this.grid.setObject(toGx, toGy, building.textureKey);
    this.onChange?.();
    return true;
  }

  canUpgrade(building: BuildingData): boolean {
    if (building.type === 'tree') return false;
    return building.level < ECONOMY.maxBuildingLevel;
  }

  upgradeBuilding(building: BuildingData): boolean {
    if (!this.canUpgrade(building)) return false;
    building.level += 1;
    building.textureKey = buildingTextureKey(building.type, building.level);
    if (building.level >= 3) {
      building.textureKey = buildingTextureKey(building.type, 2);
    }
    this.grid.setObject(building.gridX, building.gridY, building.textureKey);
    this.onChange?.();
    return true;
  }

  refreshBuildingSprite(building: BuildingData): void {
    building.textureKey = buildingTextureKey(building.type, building.level);
    this.grid.setObject(building.gridX, building.gridY, building.textureKey);
  }

  getBuildings(): BuildingData[] {
    return [...this.buildings];
  }

  loadBuildings(data: BuildingData[]): void {
    this.buildings = data.map((b) => ({
      ...b,
      level: b.level ?? 1,
      textureKey: buildingTextureKey(b.type, b.level ?? 1),
    }));
    for (const b of this.buildings) {
      this.grid.setObject(b.gridX, b.gridY, b.textureKey);
    }
    this.onChange?.();
  }
}

import { buildingTextureKey } from '../config/assets';
import { ECONOMY } from '../config/gameConfig';
import type { BuildingData, BuildingType } from '../config/gameConfig';
import type { GridSystem } from './GridSystem';

export type BuildItemType = BuildingType;

export interface BuildItemDef {
  type: BuildItemType;
  textureKey: string;
  label: string;
  cost: number;
  footprint: { w: number; h: number };
}

export const BUILD_ITEMS: BuildItemDef[] = [
  { type: 'house', textureKey: 'house_lv1', label: 'House', cost: 50, footprint: { w: 1, h: 1 } },
  { type: 'barn', textureKey: 'barn_lv1', label: 'Barn', cost: 80, footprint: { w: 1, h: 1 } },
  { type: 'tree', textureKey: 'tree_01', label: 'Tree', cost: 10, footprint: { w: 1, h: 1 } },
];

export class BuildSystem {
  active = false;
  selectedItem: BuildItemDef | null = null;
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
  }

  exitBuildMode(): void {
    this.active = false;
    this.selectedItem = null;
  }

  updateGhost(gx: number, gy: number): void {
    this.ghostX = gx;
    this.ghostY = gy;
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

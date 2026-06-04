import { buildingTextureKey } from '../config/assets';
import {
  BUILD_DECOR_COST,
  ECONOMY,
  type BuildingData,
  type BuildingType,
  type GroundDecorVariant,
  type PathGroundVariant,
} from '../config/gameConfig';
import { PEN_MOAT_WATER_OBJECT } from '../config/livestockAssets';
import type { GridSystem } from './GridSystem';

export type BuildItemType = BuildingType;
export type BuildCategory = 'buildings' | 'decor';
export type BuildPlacementKind = 'building' | 'natural' | 'ground';

export interface BuildItemDef {
  type: BuildItemType;
  textureKey: string;
  label: string;
  cost: number;
  footprint: { w: number; h: number };
  category: BuildCategory;
  placement: BuildPlacementKind;
  /** Ground tile placement only. */
  groundTile?: 'grass' | 'water' | 'path' | 'bridge';
  groundVariant?: GroundDecorVariant;
  pathVariant?: PathGroundVariant;
  /** Field border: must be adjacent to farm soil, not on soil. */
  requireAdjacentFarmSoil?: boolean;
  /** When set, card is locked until player level reaches this value. */
  requiredLevel?: number;
}

const DECOR = BUILD_DECOR_COST;

export const BUILD_ITEMS: BuildItemDef[] = [
  {
    type: 'house',
    textureKey: 'house_lv1',
    label: 'House',
    cost: 50,
    footprint: { w: 1, h: 1 },
    category: 'buildings',
    placement: 'building',
  },
  {
    type: 'barn',
    textureKey: 'barn_lv1',
    label: 'Barn',
    cost: 80,
    footprint: { w: 1, h: 1 },
    category: 'buildings',
    placement: 'building',
  },
  {
    type: 'tree',
    textureKey: 'grass',
    label: 'Grass',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'grass',
  },
  {
    type: 'tree',
    textureKey: 'grass_light',
    label: 'Light grass',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'grass',
    groundVariant: 'grass_light',
  },
  {
    type: 'tree',
    textureKey: 'flower_ground',
    label: 'Flowers',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'grass',
    groundVariant: 'flower_ground',
  },
  {
    type: 'tree',
    textureKey: 'stone_path',
    label: 'Stone path',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'path',
    pathVariant: 'stone_path',
  },
  {
    type: 'tree',
    textureKey: 'field_border',
    label: 'Field border',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'path',
    pathVariant: 'field_border',
    requireAdjacentFarmSoil: true,
  },
  {
    type: 'tree',
    textureKey: 'path',
    label: 'Path',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'path',
    pathVariant: 'path',
  },
  {
    type: 'tree',
    textureKey: 'road_corner',
    label: 'Road corner',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'path',
    pathVariant: 'road_corner',
  },
  {
    type: 'tree',
    textureKey: 'bridge_tile',
    label: 'Bridge',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'bridge',
    pathVariant: 'bridge_tile',
  },
  {
    type: 'tree',
    textureKey: 'water',
    label: 'Water',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'ground',
    groundTile: 'water',
  },
  {
    type: 'tree',
    textureKey: 'tree_01',
    label: 'Tree 1',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'natural',
  },
  {
    type: 'tree',
    textureKey: 'tree_02',
    label: 'Tree 2',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'natural',
  },
  {
    type: 'tree',
    textureKey: 'tree_03',
    label: 'Tree 3',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'natural',
  },
  {
    type: 'tree',
    textureKey: 'rock_01',
    label: 'Rock',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'natural',
  },
  {
    type: 'tree',
    textureKey: 'bush_01',
    label: 'Bush',
    cost: DECOR,
    footprint: { w: 1, h: 1 },
    category: 'decor',
    placement: 'natural',
  },
];

export function isNaturalBuildTexture(textureKey: string): boolean {
  return (
    textureKey.startsWith('tree_') ||
    textureKey.startsWith('rock_') ||
    textureKey.startsWith('bush_')
  );
}

export class BuildSystem {
  active = false;
  selectedItem: BuildItemDef | null = null;
  /** Preview snapped to a tile; ghost no longer follows the pointer. */
  previewLocked = false;
  ghostX = 0;
  ghostY = 0;
  private buildings: BuildingData[] = [];
  private onChange?: () => void;
  private placementBlocked?: (gx: number, gy: number) => boolean;

  constructor(private grid: GridSystem) {}

  /** Extra collision (e.g. livestock pens). */
  setPlacementBlocked(fn: (gx: number, gy: number) => boolean): void {
    this.placementBlocked = fn;
  }

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
    if (this.placementBlocked?.(gx, gy)) return false;
    const item = this.selectedItem;
    if (item.placement === 'ground') return this.canPlaceGroundTile(gx, gy, item);
    if (item.placement === 'natural') return this.canPlaceNatural(gx, gy);
    return this.canPlaceBuilding(gx, gy);
  }

  private canPlaceBuilding(gx: number, gy: number): boolean {
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path' || cell.type === 'void') return false;
    if (this.buildings.some((b) => b.gridX === gx && b.gridY === gy)) return false;
    return true;
  }

  private canPlaceNatural(gx: number, gy: number): boolean {
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path' || cell.type === 'void') return false;
    if (cell.type === 'soil') return false;
    if (this.buildings.some((b) => b.gridX === gx && b.gridY === gy)) return false;
    return true;
  }

  private canPlaceGroundTile(gx: number, gy: number, item: BuildItemDef): boolean {
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return false;
    if (
      cell.object &&
      !(item.groundTile === 'bridge' && cell.object === PEN_MOAT_WATER_OBJECT)
    ) {
      return false;
    }
    if (cell.type === 'soil') return false;
    if (this.buildings.some((b) => b.gridX === gx && b.gridY === gy)) return false;
    if (item.requireAdjacentFarmSoil) {
      if (this.grid.isFarmSoilCell(gx, gy) || !this.grid.isAdjacentToFarmSoil(gx, gy)) {
        return false;
      }
    }
    if (item.groundTile === 'bridge') {
      return this.grid.canPlaceBridgeAt(gx, gy);
    }
    if (item.groundTile === 'path' && this.grid.isFarmSoilCell(gx, gy)) return false;
    if (item.groundTile === 'water' && cell.type === 'path') {
      return false;
    }
    if (cell.type === 'void' || cell.type === 'grass' || cell.type === 'water') return true;
    if (cell.type === 'path') return item.groundTile === 'path';
    return false;
  }

  place(gx: number, gy: number): boolean {
    if (!this.selectedItem || !this.canPlace(gx, gy)) return false;
    const item = this.selectedItem;
    if (item.placement === 'ground') {
      this.placeGroundTile(gx, gy, item);
      this.onChange?.();
      return true;
    }
    if (item.placement === 'natural') {
      this.grid.setObject(gx, gy, item.textureKey);
      this.onChange?.();
      return true;
    }
    const building: BuildingData = {
      type: item.type,
      textureKey: item.textureKey,
      gridX: gx,
      gridY: gy,
      level: 1,
    };
    this.buildings.push(building);
    this.grid.setObject(gx, gy, building.textureKey);
    this.onChange?.();
    return true;
  }

  private placeGroundTile(gx: number, gy: number, item: BuildItemDef): void {
    const tile = item.groundTile ?? 'grass';
    if (tile === 'grass') {
      this.grid.setCell(gx, gy, {
        type: 'grass',
        walkable: true,
        groundVariant: item.groundVariant,
        object: undefined,
      });
      return;
    }
    if (tile === 'path' || tile === 'bridge') {
      this.grid.setCell(gx, gy, {
        type: 'path',
        walkable: true,
        groundVariant: undefined,
        pathVariant: item.pathVariant ?? 'stone_path',
        object: undefined,
      });
      return;
    }
    this.grid.setCell(gx, gy, {
      type: 'water',
      walkable: false,
      groundVariant: undefined,
      object: undefined,
    });
  }

  findBuildingAt(gx: number, gy: number): BuildingData | null {
    return this.buildings.find((b) => b.gridX === gx && b.gridY === gy) ?? null;
  }

  /** Empty walkable tile suitable for placing or moving a structure (not water/path). */
  canPlaceObjectAt(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path' || cell.type === 'void') return false;
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
      textureKey:
        b.type === 'tree'
          ? b.textureKey
          : buildingTextureKey(b.type, b.level ?? 1),
    }));
    for (const b of this.buildings) {
      this.grid.setObject(b.gridX, b.gridY, b.textureKey);
    }
    this.onChange?.();
  }
}

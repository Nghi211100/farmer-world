import type { CropId } from './CropConfig';
import type { LivestockPenData } from './LivestockConfig';

/** Max internal game resolution; canvas FIT-scales down on larger viewports (letterbox in CSS). */
export const MAX_GAME_WIDTH = 1492;
export const MAX_GAME_HEIGHT = 1054;

export const GRID_SIZE = 20;
/** Soil tiles unlocked at game start; more unlock via land purchases */
export const INITIAL_UNLOCKED_FARM_TILES = 10;
/** Starting economy for a brand-new save (no existing localStorage save). */
export const DEFAULT_COINS = 500;
/** Cost of the first purchasable soil tile (prior purchases = 0). */
export const LAND_UNLOCK_COST = 2000;

/**
 * Land unlock cost for the next purchase after `priorPurchases` completed buys.
 * Geometric progression: round(base × multiplier^priorPurchases) → 2000, 3000, 4500, …
 */
export function landUnlockCostForPurchaseIndex(priorPurchases: number): number {
  const { baseCost, costMultiplier } = ECONOMY.land;
  const n = Math.max(0, priorPurchases);
  return Math.round(baseCost * costMultiplier ** n);
}

export function canAffordLandUnlock(coins: number, cost: number): boolean {
  return coins >= cost;
}

/** Vietnamese copy for land expansion (right-bar shovel). */
export const LAND_EXPAND_STRINGS = {
  selectHint: 'Chọn ô đất muốn mở',
  confirmMessage: (cost: number) =>
    `Bạn muốn bỏ ra số tiền ${cost} để mở ô đất này không?`,
  confirmBalance: (coins: number) => `Số dư: ${coins}`,
  confirmYes: 'Có',
  confirmNo: 'Không',
  insufficientCoins: (cost: number) => `Cần ${cost} xu để mở ô đất`,
  invalidTile: 'Chọn ô đất đã khóa hoặc cỏ cạnh nông trại',
  successUnlock: (spent: number) => `Đã mở ô đất (-${spent} 🪙)`,
  successExpand: (spent: number) => `Đã mở rộng đất (-${spent} 🪙)`,
} as const;

export const DEFAULT_GEMS = 10;
export const DEFAULT_ENERGY = 100;

export type TileType = 'void' | 'grass' | 'soil' | 'water' | 'path';

/** Build → Decor ground tiles and nature props (coins each). */
export const BUILD_DECOR_COST = 5;

/** Farm planting soil rectangle (inclusive), matches placeholder map */
export const FARM_SOIL_BOUNDS = {
  minX: 4,
  maxX: 11,
  minY: 6,
  maxY: 13,
} as const;

/** Default farmer spawn on the path ring (matches placeholder map + {@link FarmScene} player). */
export const FARM_PLAYER_SPAWN_GX = 10;
export const FARM_PLAYER_SPAWN_GY = 10;
export type MapObjectType = 'tree' | 'rock' | 'bush' | 'house' | 'barn' | 'silo' | 'coop';

/** Decorative grass on locked soil and outer-map grass tiles */
export type GroundDecorVariant = 'grass' | 'grass_light' | 'flower_ground';

/** Per complete group of eligible decor tiles: 3 / 2 / 5, shuffled within each group */
export const GROUND_DECOR_MIX = {
  groupSize: 10,
  flower: 3,
  grassLight: 2,
  grass: 5,
} as const;

/** Counts per variant for `total` eligible cells (full groups + proportional remainder). */
export function groundDecorVariantCounts(total: number): Record<GroundDecorVariant, number> {
  const n = Math.max(0, total);
  const { groupSize, flower, grassLight } = GROUND_DECOR_MIX;
  const groups = Math.floor(n / groupSize);
  const remainder = n % groupSize;
  const flower_ground =
    groups * flower + Math.round(remainder * (flower / groupSize));
  const grass_light =
    groups * grassLight + Math.round(remainder * (grassLight / groupSize));
  const grass = n - flower_ground - grass_light;
  return { flower_ground, grass_light, grass };
}

/** Unplanted farm soil moisture → ground texture (0–100); dug plots use soil/mud/wet_soil */
export const SOIL_MOISTURE = {
  /** Dug soil: dry band (shows soil texture) */
  dryMax: 24,
  /** Dug soil: mid band (shows mud texture) */
  mudMin: 25,
  mudMax: 74,
  /** Dug soil: saturated band (shows wet_soil texture) */
  wetMin: 75,
} as const;

export type SoilMoistureTextureKey = 'empty_plot' | 'soil' | 'mud' | 'wet_soil';

export function soilMoistureTextureKey(
  level: number,
  dug: boolean
): SoilMoistureTextureKey {
  const v = Math.max(0, Math.min(100, level));
  if (!dug) return 'empty_plot';
  if (v >= SOIL_MOISTURE.wetMin) return 'wet_soil';
  if (v >= SOIL_MOISTURE.mudMin) return 'mud';
  return 'soil';
}

/** Crop tile lifecycle */
export enum CropLifecycleState {
  EMPTY = 'EMPTY',
  DIGGING = 'DIGGING',
  PLANTED = 'PLANTED',
  STAGE1 = 'STAGE1',
  STAGE2 = 'STAGE2',
  STAGE3 = 'STAGE3',
  READY = 'READY',
  HARVESTED = 'HARVESTED',
}

/** @deprecated Use CropLifecycleState — kept for save migration */
export enum CropState {
  EMPTY = 'EMPTY',
  PLANTED = 'PLANTED',
  GROWING = 'GROWING',
  READY = 'READY',
}

export type CropKind = CropId;

export interface CropTileData {
  cropType?: CropKind;
  kind?: CropKind;
  stage: CropLifecycleState;
  /** Legacy display field; 100 = hydrated, 0 = dry milestone active. */
  waterLevel: number;
  /** Growth water milestones cleared by watering while dry. */
  wateredMilestoneCount?: number;
  plantedAt: number;
  lastWaterTime: number;
  growthElapsedSec: number;
  lastTickAt: number;
  dug?: boolean;
  lastFarmActivityAt?: number;
  soilIdleDry?: boolean;
  soilIdleDrySince?: number;
}

export enum PlayerFarmAction {
  IDLE = 'IDLE',
  DIGGING = 'DIGGING',
  PLANTING = 'PLANTING',
  WATERING = 'WATERING',
  HARVESTING = 'HARVESTING',
}

export enum FarmTool {
  HOE = 'HOE',
  SEED = 'SEED',
  WATERING_CAN = 'WATERING_CAN',
  HARVEST_HAND = 'HARVEST_HAND',
}

export const FARMING = {
  maxWater: 100,
  /** Below this moisture, crop growth uses {@link FARMING.growthRateWithoutWater} instead of full speed. */
  waterThreshold: 25,
  /** Growth speed multiplier while crop moisture is below {@link FARMING.waterThreshold} (0–1). */
  growthRateWithoutWater: 0.5,
  digDurationMs: 600,
  /** Unplanted/dug soil becomes neglect-dry after this idle period. */
  soilIdleDryMs: 120_000,
  /** One watering action refills crop (and empty soil) to maxWater. */
  waterRestoreAmount: 100,
};

/** Copy for neglect-dry soil (idle without farming). */
export const SOIL_IDLE_STRINGS = {
  plotDry: 'Ô đất đã khô — hãy tưới nước hoặc xới lại',
  cannotPlant: 'Ô đất khô — tưới nước hoặc xới lại trước khi gieo',
  cannotHarvest: 'Ô đất khô — tưới nước hoặc xới lại trước khi thu hoạch',
} as const;

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Playwright / capture scripts: keep the WebGL color buffer so canvas screenshots
 * are not blank letterbox (#1b2e16). Enable with `?screenshot=1`.
 */
export function isScreenshotCaptureMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('screenshot') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Farm debug overlays. Off by default; enable with `?debugGrid=1` (or global `?debug=1`).
 * - World-space full map grid + iso tile outlines (GRID_SIZE²; grass/water/moat included)
 * - Screen-fixed viewport HUD outlines ({@link computePlayableFarmViewportLayout})
 */
export function isFarmGridDebug(): boolean {
  if (isDebugMode()) return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugGrid') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Persistent top tool strip (hoe/seed/water/harvest) — dev-only.
 * Off in normal play; tools are chosen from the farm action popup on tile click.
 * Enable only with `?debugToolBar=1` (not tied to global `?debug=1`).
 */
export function isPersistentToolBarEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugToolBar') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Farm camera pan/zoom HUD (`?debugCamera=1` or global `?debug=1`).
 */
export function isFarmCameraDebug(): boolean {
  if (isDebugMode()) return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugCamera') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Dev experiment: lock tile (10,10) world at all zooms.
 * Enable with `?forceSpawnWorld=878.3,535.4` (comma-separated world x,y).
 */
export function getFarmForceSpawnWorld(): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('forceSpawnWorld');
    if (!raw) return null;
    const parts = raw.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { x: parts[0], y: parts[1] };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Warehouse modal slot grid overlay (`?debugWarehouse=1` or global `?debug=1`). */
export function isWarehouseGridDebug(): boolean {
  if (isDebugMode()) return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugWarehouse') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

/** E2e/runtime override for shop grid overlay (see `setShopGridDebugForTest`). */
let shopGridDebugTestOverride: boolean | undefined;

/** Force shop modal layout grid on/off from `__FARMER_WORLD_TEST__` (dev only). */
export function setShopGridDebugForTest(enabled?: boolean): void {
  shopGridDebugTestOverride = enabled;
}

/** Shop modal dual debug grids: layout (yellow) + texture/cover (cyan/magenta). Off by default. */
export function isShopGridDebug(): boolean {
  if (shopGridDebugTestOverride === true) return true;
  if (shopGridDebugTestOverride === false) return false;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugShopGrid') === '1';
  } catch {
    /* ignore */
  }
  return false;
}

export type BuildingType = 'house' | 'barn' | 'tree';

export interface BuildingData {
  type: BuildingType;
  textureKey: string;
  gridX: number;
  gridY: number;
  level: number;
}

export {
  ITEM_IDS,
  ITEM_LABELS,
  ITEM_ICON_KEYS,
  SEED_BUY_PRICES,
  FOOD_BUY_PRICES,
  RESOURCE_SELL_PRICES,
  isSeedItem,
  isFoodItem,
  isShopBuyable,
} from './items';
export type { ItemId } from './items';
import {
  ITEM_IDS,
  FOOD_BUY_PRICES,
  LIVESTOCK_SELL_PRICES,
  RESOURCE_SELL_PRICES,
  SEED_BUY_PRICES,
} from './items';

/** Warehouse capacity = total item count across all stacks (not unique types). */
export const WAREHOUSE = {
  maxLevel: 4,
  /** L1–L4 slot totals; same as `warehouseCapacityForLevel(level)`. */
  capacityByLevel: [500, 1000, 1500, 2000] as const,
  upgradeCosts: [
    { coins: 200, wood: 10, stone: 5 },
    { coins: 500, wood: 25, stone: 15 },
    { coins: 1200, wood: 50, stone: 30 },
  ] as const,
} as const;

/**
 * Total item slots at warehouse level (1-based).
 * Formula: `500 + (level - 1) * 500` → L1=500, L2=1000, L3=1500, L4=2000.
 */
export function warehouseCapacityForLevel(level: number): number {
  const l = Math.min(WAREHOUSE.maxLevel, Math.max(1, Math.floor(level)));
  return 500 + (l - 1) * 500;
}

export const ENERGY = {
  max: 100,
  defaultEnergy: DEFAULT_ENERGY,
  /** Per farm action (dig, water, plant, harvest). */
  actionCost: 1,
  /** Passive drain while moving or performing a farm animation. */
  activeDrainIntervalMs: 38_000,
  activeDrainAmount: 1,
  /** Regen while idle (online) or offline (applied on load from energyUpdatedAt). */
  recoveryIntervalMs: 50_000,
  recoveryAmount: 1,
};

/** Economy — land/buildings; seed/sell from items config */
export const ECONOMY = {
  seeds: SEED_BUY_PRICES,
  food: FOOD_BUY_PRICES,
  sell: RESOURCE_SELL_PRICES,
  land: {
    baseCost: 2000,
    /** Per prior purchase multiplier (2nd unlock = round(2000 × 1.5) = 3000). */
    costMultiplier: 1.5,
  },
  buildingUpgrade: {
    house: [0, 75, 200],
    barn: [0, 100, 250],
    tree: [0, 0, 0],
  } as Record<BuildingType, [number, number, number]>,
  maxBuildingLevel: 3,
  livestock: LIVESTOCK_SELL_PRICES,
};

export const SEED_TO_CROP: Record<string, CropKind> = {
  [ITEM_IDS.SEEDS_WHEAT]: 'wheat',
  [ITEM_IDS.SEEDS_CORN]: 'corn',
  [ITEM_IDS.SEEDS_CARROT]: 'carrot',
  [ITEM_IDS.SEEDS_PUMPKIN]: 'pumpkin',
  [ITEM_IDS.SEEDS_TOMATO]: 'tomato',
  seeds_wheat: 'wheat',
  seeds_corn: 'corn',
};

export const CROP_TO_SEED: Record<CropKind, string> = {
  wheat: ITEM_IDS.SEEDS_WHEAT,
  corn: ITEM_IDS.SEEDS_CORN,
  carrot: ITEM_IDS.SEEDS_CARROT,
  pumpkin: ITEM_IDS.SEEDS_PUMPKIN,
  tomato: ITEM_IDS.SEEDS_TOMATO,
};

export interface GameSaveData {
  version?: number;
  coins: number;
  gems: number;
  energy: number;
  energyUpdatedAt?: number;
  warehouseLevel?: number;
  warehouse?: Record<string, number>;
  seeds?: Record<string, number>;
  /** @deprecated v3 flat inventory — migrated to warehouse + seeds */
  inventory?: Record<string, number>;
  crops: Record<string, CropTileData>;
  buildings: BuildingData[];
  /** Livestock pens (optional — absent on older saves). */
  livestock?: LivestockPenData[];
  landPurchases: number;
  selectedSeed?: string;
  selectedTool?: FarmTool;
}

export const SAVE_KEY = 'your-farm-save-v4';
export const SAVE_VERSION = 4;

/** Future feature hooks */
export interface IQuestSystem {
  acceptQuest(questId: string): void;
  completeQuest(questId: string): void;
}

export interface IMarketSystem {
  buy(itemId: string, qty: number): void;
  sell(itemId: string, qty: number): void;
}

export interface IDayNightSystem {
  getTimeOfDay(): 'day' | 'night';
  setSpeed(multiplier: number): void;
}

export interface IMultiplayerSystem {
  connect(roomId: string): Promise<void>;
  syncState(): void;
}

export const futureSystems = {
  animals: null,
  quests: null as IQuestSystem | null,
  market: null as IMarketSystem | null,
  production: null,
  crafting: null,
  dayNight: null as IDayNightSystem | null,
  multiplayer: null as IMultiplayerSystem | null,
};

import { ITEM_IDS } from './items';
import {
  getLivestockHouseTextureKey,
  LIVESTOCK_HOUSE_KEYS,
  type LivestockPenLevel,
  type LivestockStage,
} from './livestockAssets';

export type AnimalType =
  | 'cow'
  | 'pig'
  | 'chicken'
  | 'fish'
  | 'duck'
  | 'sheep'
  | 'goat';

export type LivestockPenState = 'unstocked' | 'idle' | 'producing' | 'ready';
export type AnimalLifecycleState =
  | 'baby'
  | 'growing'
  | 'adult'
  | 'producing'
  | 'hungry';

/** Goat + sheep share one buildable pen (house art until stocked). */
export type LivestockPenKind = 'ruminant';

/** Per-animal lifecycle timers (growth, production, hunger). */
export interface LivestockAnimalLifecycle {
  lifecycleState?: AnimalLifecycleState;
  growthStartAt?: number;
  growthDurationMs?: number;
  productionProgressMs?: number;
  hungerSinceFeedMs?: number;
  hungrySince?: number;
  happiness?: number;
  lastUpdatedAt?: number;
}

export interface PenAnimalData extends LivestockAnimalLifecycle {
  animalType: AnimalType;
  stage?: LivestockStage;
  variant?: number;
  animalTextureKey?: string;
}

export interface RuminantOccupantData extends LivestockAnimalLifecycle {
  animalType: 'goat' | 'sheep';
  stage?: LivestockStage;
  variant?: number;
  animalTextureKey?: string;
}

export interface LivestockPenData {
  id: string;
  animalType: AnimalType;
  /** When set, pen accepts goat/sheep in shared slots up to level capacity. */
  penKind?: LivestockPenKind;
  /** Anchor tile (top-left of footprint rectangle in grid coords). */
  gridX: number;
  gridY: number;
  state: LivestockPenState;
  /** Pen footprint: level 1 = 3×3, level 2 = 4×4. */
  level: LivestockPenLevel;
  readyAt?: number;
  /** True stocked animals in this pen (state derives from this value). */
  stockCount?: number;
  stage?: LivestockStage;
  variant?: number;
  animalTextureKey?: string;
  /** Shared-pen occupants for goat/sheep rendering + persistence. */
  ruminantOccupants?: RuminantOccupantData[];
  /** Per-animal instances for dedicated species pens (cow, chicken, …). */
  penAnimals?: PenAnimalData[];
  /** @deprecated Pen-level mirror of primary animal; use penAnimals / ruminantOccupants. */
  lifecycleState?: AnimalLifecycleState;
  growthStartAt?: number;
  growthDurationMs?: number;
  productionStartAt?: number;
  productionProgressMs?: number;
  hungrySince?: number;
  hungerSinceFeedMs?: number;
  happiness?: number;
  lastUpdatedAt?: number;
}

/** Per-species pen/house texture keys (same art for Lv1/Lv2; scale differs in render). */
export const LIVESTOCK_TEXTURE_KEYS: Record<AnimalType, string> = {
  ...LIVESTOCK_HOUSE_KEYS,
};

export const LIVESTOCK_PEN_UPGRADE_COST = 150;
export const LIVESTOCK_PEN_CAPACITY_BY_LEVEL: Record<LivestockPenLevel, number> = {
  1: 4,
  2: 8,
};

export const RUMINANT_PEN_LABEL_VI = 'Chuồng Dê/Cừu';

export interface LivestockAnimalDef {
  type: AnimalType;
  label: string;
  labelVi: string;
  productItemId: string;
  productLabel: string;
  penCost: number;
  animalCost: number;
  feedCost: number;
  produceMs: number;
  productSellPrice: number;
  growthMs: number;
  hungryAfterMs: number;
  feedItemId: string;
  feedRequired: number;
  sellBasePrice: number;
  /** Pen placeable; animal purchase disabled until PNGs exist. */
  houseOnly?: boolean;
}

export const LIVESTOCK_ANIMALS: Record<AnimalType, LivestockAnimalDef> = {
  cow: {
    type: 'cow',
    label: 'Cow',
    labelVi: 'Bò',
    productItemId: ITEM_IDS.MILK,
    productLabel: 'Milk',
    penCost: 120,
    animalCost: 80,
    feedCost: 15,
    produceMs: 45_000,
    productSellPrice: 12,
    growthMs: 55_000,
    hungryAfterMs: 275_000,
    feedItemId: ITEM_IDS.GRASS,
    feedRequired: 2,
    sellBasePrice: 80,
  },
  pig: {
    type: 'pig',
    label: 'Pig',
    labelVi: 'Heo',
    productItemId: ITEM_IDS.PORK,
    productLabel: 'Pork',
    penCost: 100,
    animalCost: 70,
    feedCost: 12,
    produceMs: 40_000,
    productSellPrice: 18,
    growthMs: 45_000,
    hungryAfterMs: 225_000,
    feedItemId: ITEM_IDS.PUMPKIN,
    feedRequired: 2,
    sellBasePrice: 70,
  },
  chicken: {
    type: 'chicken',
    label: 'Chicken',
    labelVi: 'Gà',
    productItemId: ITEM_IDS.EGG,
    productLabel: 'Egg',
    penCost: 60,
    animalCost: 40,
    feedCost: 8,
    produceMs: 25_000,
    productSellPrice: 10,
    growthMs: 30_000,
    hungryAfterMs: 150_000,
    feedItemId: ITEM_IDS.CORN,
    feedRequired: 1,
    sellBasePrice: 40,
  },
  fish: {
    type: 'fish',
    label: 'Fish',
    labelVi: 'Cá',
    productItemId: ITEM_IDS.FISH,
    productLabel: 'Fish',
    penCost: 90,
    animalCost: 55,
    feedCost: 10,
    produceMs: 35_000,
    productSellPrice: 14,
    growthMs: 35_000,
    hungryAfterMs: 175_000,
    feedItemId: ITEM_IDS.FISH_FEED,
    feedRequired: 1,
    sellBasePrice: 55,
  },
  goat: {
    type: 'goat',
    label: 'Goat',
    labelVi: 'Dê',
    productItemId: ITEM_IDS.GOAT_MILK,
    productLabel: 'Goat milk',
    penCost: 95,
    animalCost: 65,
    feedCost: 12,
    produceMs: 38_000,
    productSellPrice: 15,
    growthMs: 40_000,
    hungryAfterMs: 200_000,
    feedItemId: ITEM_IDS.GRASS,
    feedRequired: 1,
    sellBasePrice: 65,
  },
  duck: {
    type: 'duck',
    label: 'Duck',
    labelVi: 'Vịt',
    productItemId: ITEM_IDS.DUCK_EGG,
    productLabel: 'Duck egg',
    penCost: 70,
    animalCost: 45,
    feedCost: 9,
    produceMs: 28_000,
    productSellPrice: 11,
    growthMs: 32_000,
    hungryAfterMs: 160_000,
    feedItemId: ITEM_IDS.CORN,
    feedRequired: 1,
    sellBasePrice: 45,
  },
  sheep: {
    type: 'sheep',
    label: 'Sheep',
    labelVi: 'Cừu',
    productItemId: ITEM_IDS.WOOL,
    productLabel: 'Wool',
    penCost: 85,
    animalCost: 50,
    feedCost: 10,
    produceMs: 32_000,
    productSellPrice: 13,
    growthMs: 42_000,
    hungryAfterMs: 210_000,
    feedItemId: ITEM_IDS.GRASS,
    feedRequired: 1,
    sellBasePrice: 50,
  },
};

export const LIVESTOCK_ANIMAL_LIST = Object.values(LIVESTOCK_ANIMALS);

/** Build cost for shared goat/sheep pen (avg of species pen costs). */
export const RUMINANT_PEN_COST = Math.round(
  (LIVESTOCK_ANIMALS.goat.penCost + LIVESTOCK_ANIMALS.sheep.penCost) / 2
);

/** Short species/kind label for pen footprint debug overlay center. */
export function penFootprintDebugLabel(
  pen: Pick<LivestockPenData, 'animalType' | 'penKind'>
): string {
  if (pen.penKind === 'ruminant') return 'Dê/Cừu';
  return getLivestockDef(pen.animalType).labelVi;
}

export function getLivestockDef(type: AnimalType): LivestockAnimalDef {
  return LIVESTOCK_ANIMALS[type];
}

export function livestockPenCapacity(level: LivestockPenLevel = 1): number {
  return LIVESTOCK_PEN_CAPACITY_BY_LEVEL[level] ?? LIVESTOCK_PEN_CAPACITY_BY_LEVEL[1];
}

/** House/pen sprite for species (level only affects footprint scale in scene). */
export function getLivestockPenTextureKey(
  animalType: AnimalType,
  _level: LivestockPenLevel = 1
): string {
  return getLivestockHouseTextureKey(animalType);
}

/** House sprite for a placed pen row (ruminant always uses shared sheep_house art). */
export function getLivestockPenTextureKeyForPen(
  pen: LivestockPenData,
  _level: LivestockPenLevel = 1
): string {
  if (pen.penKind === 'ruminant') {
    return 'sheep_house';
  }
  return getLivestockHouseTextureKey(pen.animalType);
}

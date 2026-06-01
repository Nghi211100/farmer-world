/** Crop definitions — growth times in seconds, prices in coins */

export type CropId = 'wheat' | 'corn' | 'carrot' | 'pumpkin' | 'tomato';

export interface CropDefinition {
  id: CropId;
  name: string;
  seedPrice: number;
  sellPrice: number;
  /** Effective growth seconds to reach maturity when fully watered. */
  growTimeSec: number;
  /**
   * Effective growth elapsed times when moisture runs out and the crop needs watering.
   * Player must water at each milestone; missed windows slow growth until watered.
   */
  waterMilestonesSec: number[];
  stages: number;
  yield: number;
  spritePrefix: string;
  seedItemId: string;
  harvestItemId: string;
}

export const CROPS: Record<CropId, CropDefinition> = {
  carrot: {
    id: 'carrot',
    name: 'Carrot',
    seedPrice: 10,
    sellPrice: 17,
    growTimeSec: 240,
    waterMilestonesSec: [120],
    stages: 4,
    yield: 2,
    spritePrefix: 'carrot',
    seedItemId: 'carrot_seed',
    harvestItemId: 'carrot',
  },
  corn: {
    id: 'corn',
    name: 'Corn',
    seedPrice: 8,
    sellPrice: 14,
    growTimeSec: 300,
    waterMilestonesSec: [150],
    stages: 4,
    yield: 3,
    spritePrefix: 'corn',
    seedItemId: 'corn_seed',
    harvestItemId: 'corn',
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    seedPrice: 5,
    sellPrice: 9,
    growTimeSec: 330,
    waterMilestonesSec: [180],
    stages: 4,
    yield: 2,
    spritePrefix: 'wheat',
    seedItemId: 'wheat_seed',
    harvestItemId: 'wheat',
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    seedPrice: 12,
    sellPrice: 21,
    growTimeSec: 360,
    waterMilestonesSec: [180, 300],
    stages: 4,
    yield: 2,
    spritePrefix: 'tomato',
    seedItemId: 'tomato_seed',
    harvestItemId: 'tomato',
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin',
    seedPrice: 20,
    sellPrice: 35,
    growTimeSec: 420,
    waterMilestonesSec: [180, 360],
    stages: 4,
    yield: 5,
    spritePrefix: 'pumpkin',
    seedItemId: 'pumpkin_seed',
    harvestItemId: 'pumpkin',
  },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** Per-crop seed packet icons (assets/seeds/*_seed.png) */
export const CROP_UI_ICON_KEYS: Record<CropId, string> = {
  wheat: 'seed_wheat',
  corn: 'seed_corn',
  carrot: 'seed_carrot',
  pumpkin: 'seed_pumpkin',
  tomato: 'seed_tomato',
};

export function getCropDef(id: CropId): CropDefinition {
  return CROPS[id];
}

export function cropIdFromSeedItem(seedItemId: string): CropId | null {
  for (const c of CROP_IDS) {
    if (CROPS[c].seedItemId === seedItemId) return c;
  }
  return null;
}

export function textureKeyForStage(prefix: string, visualStage: number): string {
  const stage = Math.min(4, Math.max(1, visualStage));
  return `${prefix}_stage${stage}`;
}

/** Future systems — stubs for expansion */
export interface IFertilizerSystem {
  applyFertilizer(tileKey: string, fertilizerId: string): void;
}

export interface IAutoWateringSystem {
  tick(deltaMs: number): void;
}

export interface IAnimalSystem {
  feed(animalId: string): void;
  collect(animalId: string): void;
}

export interface IProductionSystem {
  startRecipe(recipeId: string): void;
}

export interface ICraftingSystem {
  craft(recipeId: string): void;
}

export interface ISeasonSystem {
  getCurrentSeason(): string;
  getGrowthMultiplier(cropId: CropId): number;
}

export const futureCropSystems = {
  fertilizer: null as IFertilizerSystem | null,
  autoWatering: null as IAutoWateringSystem | null,
  animals: null as IAnimalSystem | null,
  production: null as IProductionSystem | null,
  crafting: null as ICraftingSystem | null,
  seasons: null as ISeasonSystem | null,
};

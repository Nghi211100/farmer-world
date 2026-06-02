import { TILE_HEIGHT, TILE_WIDTH } from '../utils/iso';
import type { AnimalType } from './LivestockConfig';

/** Life stage art folders use `ault` for adult in filenames. */
export type LivestockStage = 'child' | 'young' | 'adult';

export type LivestockTextureEntry = {
  key: string;
  path: string;
  species: AnimalType;
  stage: LivestockStage;
  /** `0` = base file without `_1` suffix; `1`–`3` = numbered variant. */
  variant: number;
};

const ANIMALS_DIR = 'animals';

/** Raw files under `src/assets/animals` (see docs/LIVESTOCK_PLAN.md). `ault` in filenames = adult stage. */
export const LIVESTOCK_TEXTURE_ENTRIES: LivestockTextureEntry[] = [
  { key: 'chicken_child', path: `${ANIMALS_DIR}/chicken_child.png`, species: 'chicken', stage: 'child', variant: 0 },
  { key: 'chicken_ault', path: `${ANIMALS_DIR}/chicken_ault.png`, species: 'chicken', stage: 'adult', variant: 0 },
  { key: 'chicken_ault_1', path: `${ANIMALS_DIR}/chicken_ault_1.png`, species: 'chicken', stage: 'adult', variant: 1 },
  { key: 'chicken_ault_2', path: `${ANIMALS_DIR}/chicken_ault_2.png`, species: 'chicken', stage: 'adult', variant: 2 },
  { key: 'chicken_ault_3', path: `${ANIMALS_DIR}/chicken_ault_3.png`, species: 'chicken', stage: 'adult', variant: 3 },

  { key: 'cow_child', path: `${ANIMALS_DIR}/cow_child.png`, species: 'cow', stage: 'child', variant: 0 },
  { key: 'cow_ault', path: `${ANIMALS_DIR}/cow_ault.png`, species: 'cow', stage: 'adult', variant: 0 },
  { key: 'cow_ault_2', path: `${ANIMALS_DIR}/cow_ault_2.png`, species: 'cow', stage: 'adult', variant: 2 },

  { key: 'duck_child', path: `${ANIMALS_DIR}/duck_child.png`, species: 'duck', stage: 'child', variant: 0 },
  { key: 'duck_ault_1', path: `${ANIMALS_DIR}/duck_ault_1.png`, species: 'duck', stage: 'adult', variant: 1 },
  { key: 'duck_ault_2', path: `${ANIMALS_DIR}/duck_ault_2.png`, species: 'duck', stage: 'adult', variant: 2 },
  { key: 'duck_ault_3', path: `${ANIMALS_DIR}/duck_ault_3.png`, species: 'duck', stage: 'adult', variant: 3 },

  { key: 'pig_child_1', path: `${ANIMALS_DIR}/pig_child_1.png`, species: 'pig', stage: 'child', variant: 1 },
  { key: 'pig_child_2', path: `${ANIMALS_DIR}/pig_child_2.png`, species: 'pig', stage: 'child', variant: 2 },
  { key: 'pig_young', path: `${ANIMALS_DIR}/pig_young.png`, species: 'pig', stage: 'young', variant: 0 },
  { key: 'pig_ault', path: `${ANIMALS_DIR}/pick_ault.png`, species: 'pig', stage: 'adult', variant: 0 },

  { key: 'fish_child', path: `${ANIMALS_DIR}/fish_child.png`, species: 'fish', stage: 'child', variant: 0 },
  { key: 'fish_1', path: `${ANIMALS_DIR}/fish_1.png`, species: 'fish', stage: 'adult', variant: 1 },
  { key: 'fish_2', path: `${ANIMALS_DIR}/fish_2.png`, species: 'fish', stage: 'adult', variant: 2 },
  { key: 'fish_3', path: `${ANIMALS_DIR}/fish_3.png`, species: 'fish', stage: 'adult', variant: 3 },
  { key: 'fish_4', path: `${ANIMALS_DIR}/fish_4.png`, species: 'fish', stage: 'adult', variant: 4 },

  { key: 'sheep_child', path: `${ANIMALS_DIR}/sheep_child.png`, species: 'sheep', stage: 'child', variant: 0 },
  { key: 'sheep_ault', path: `${ANIMALS_DIR}/sheep_ault.png`, species: 'sheep', stage: 'adult', variant: 0 },
  { key: 'sheep_ault_1', path: `${ANIMALS_DIR}/sheep_ault_1.png`, species: 'sheep', stage: 'adult', variant: 1 },
  { key: 'sheep_ault_2', path: `${ANIMALS_DIR}/sheep_ault_2.png`, species: 'sheep', stage: 'adult', variant: 2 },

  { key: 'goat_child', path: `${ANIMALS_DIR}/goat_child.png`, species: 'goat', stage: 'child', variant: 0 },
  { key: 'goat_ault', path: `${ANIMALS_DIR}/goat_ault.png`, species: 'goat', stage: 'adult', variant: 0 },
  { key: 'goat_ault_1', path: `${ANIMALS_DIR}/goat_ault_1.png`, species: 'goat', stage: 'adult', variant: 1 },
  { key: 'goat_ault_2', path: `${ANIMALS_DIR}/goat_ault_2.png`, species: 'goat', stage: 'adult', variant: 2 },
];

/** Species pen/house sprites (`src/assets/animals/*_house.png`). */
export const LIVESTOCK_HOUSE_KEYS: Record<AnimalType, string> = {
  chicken: 'chicken_house',
  cow: 'cow_house',
  duck: 'duck_house',
  fish: 'fish_house',
  pig: 'pig_house',
  sheep: 'sheep_house',
  goat: 'goat_house',
};

/** @deprecated Generic fence — use {@link LIVESTOCK_HOUSE_KEYS} per species. */
export const LIVESTOCK_PEN_TEXTURE_KEYS = {
  small: 'livestock_pen_small',
  large: 'livestock_pen_large',
} as const;

export const LIVESTOCK_PEN_LEVELS = {
  1: { size: 3 },
  2: { size: 4 },
} as const;

export function getLivestockHouseTextureKey(species: AnimalType): string {
  return LIVESTOCK_HOUSE_KEYS[species];
}

/** Multiplier on iso footprint AABB (1 = full magenta debug span). */
export const PEN_HOUSE_FOOTPRINT_FIT_PADDING = 1;

/**
 * Fit box for pen house art — iso AABB of N×N diamonds × {@link PEN_HOUSE_FOOTPRINT_FIT_PADDING}.
 * Lv1: 192×96 px (3×64 × 3×32). Matches {@link isoRectFootprintScreenBounds}.
 */
export function penHouseDisplaySize(
  level: LivestockPenLevel,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
  fitPadding: number = PEN_HOUSE_FOOTPRINT_FIT_PADDING
): { width: number; height: number } {
  const tiles = LIVESTOCK_PEN_LEVELS[level].size;
  return {
    width: tiles * tileW * fitPadding,
    height: tiles * tileH * fitPadding,
  };
}

/** @deprecated Use {@link penHouseDisplaySize}; species no longer changes fit box. */
export function penHouseFootprintFitBox(
  level: LivestockPenLevel,
  _species?: AnimalType,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { width: number; height: number } {
  return penHouseDisplaySize(level, tileW, tileH);
}

export function speciesHasAnimalSprites(species: AnimalType): boolean {
  return getLivestockStagesForSpecies(species).length > 0;
}

export type LivestockPenLevel = keyof typeof LIVESTOCK_PEN_LEVELS;

const bySpeciesStage = new Map<string, LivestockTextureEntry[]>();

for (const entry of LIVESTOCK_TEXTURE_ENTRIES) {
  const k = `${entry.species}:${entry.stage}`;
  const list = bySpeciesStage.get(k) ?? [];
  list.push(entry);
  bySpeciesStage.set(k, list);
}

/** Stages that have at least one texture for a species. */
export function getLivestockStagesForSpecies(species: AnimalType): LivestockStage[] {
  const stages: LivestockStage[] = [];
  for (const stage of ['child', 'young', 'adult'] as const) {
    if ((bySpeciesStage.get(`${species}:${stage}`)?.length ?? 0) > 0) stages.push(stage);
  }
  return stages;
}

export function getLivestockTexturesFor(
  species: AnimalType,
  stage: LivestockStage
): LivestockTextureEntry[] {
  return [...(bySpeciesStage.get(`${species}:${stage}`) ?? [])];
}

/** Pick a random visual variant index among entries for this stage (uniform). */
export function pickLivestockVariantIndex(
  species: AnimalType,
  stage: LivestockStage,
  rng: () => number = Math.random
): number {
  const entries = getLivestockTexturesFor(species, stage);
  if (entries.length === 0) return 0;
  const idx = Math.floor(rng() * entries.length);
  return entries[idx]!.variant;
}

export function pickLivestockStage(
  species: AnimalType,
  rng: () => number = Math.random
): LivestockStage {
  const stages = getLivestockStagesForSpecies(species);
  if (stages.length === 0) return 'adult';
  return stages[Math.floor(rng() * stages.length)]!;
}

export function resolveLivestockAnimalTextureKey(
  species: AnimalType,
  stage: LivestockStage,
  variant: number
): string {
  const entries = getLivestockTexturesFor(species, stage);
  const exact = entries.find((e) => e.variant === variant);
  if (exact) return exact.key;
  if (entries.length > 0) return entries[0]!.key;
  return `animal_${species}_${stage}`;
}

export function penFootprintTiles(level: LivestockPenLevel = 1): { w: number; h: number } {
  const size = LIVESTOCK_PEN_LEVELS[level].size;
  return { w: size, h: size };
}

export function penOccupiesCell(
  pen: { gridX: number; gridY: number; level?: LivestockPenLevel },
  gx: number,
  gy: number
): boolean {
  const { w, h } = penFootprintTiles(pen.level ?? 1);
  return gx >= pen.gridX && gx < pen.gridX + w && gy >= pen.gridY && gy < pen.gridY + h;
}

export function penFootprintCells(
  pen: { gridX: number; gridY: number; level?: LivestockPenLevel }
): Array<{ gx: number; gy: number }> {
  const { w, h } = penFootprintTiles(pen.level ?? 1);
  const cells: Array<{ gx: number; gy: number }> = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ gx: pen.gridX + dx, gy: pen.gridY + dy });
    }
  }
  return cells;
}

export function penFootprintCenterGrid(pen: {
  gridX: number;
  gridY: number;
  level?: LivestockPenLevel;
}): { gx: number; gy: number } {
  const { w, h } = penFootprintTiles(pen.level ?? 1);
  return { gx: pen.gridX + (w - 1) / 2, gy: pen.gridY + (h - 1) / 2 };
}

import { DISPLAY_SIZE, TILE_HEIGHT, TILE_WIDTH } from '../utils/iso';
import type { GridSystem } from '../systems/GridSystem';
import type { AnimalLifecycleState, AnimalType } from './LivestockConfig';

/** Some keys keep legacy `ault` naming for save compatibility. */
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

/** Raw files under `src/assets/animals` (see docs/LIVESTOCK_PLAN.md). */
export const LIVESTOCK_TEXTURE_ENTRIES: LivestockTextureEntry[] = [
  { key: 'chicken_child', path: `${ANIMALS_DIR}/chicken_child.png`, species: 'chicken', stage: 'child', variant: 0 },
  { key: 'chicken_ault', path: `${ANIMALS_DIR}/chicken_adult.png`, species: 'chicken', stage: 'adult', variant: 0 },
  { key: 'chicken_ault_1', path: `${ANIMALS_DIR}/chicken_adult_1.png`, species: 'chicken', stage: 'adult', variant: 1 },
  { key: 'chicken_ault_2', path: `${ANIMALS_DIR}/chicken_adult_2.png`, species: 'chicken', stage: 'adult', variant: 2 },
  { key: 'chicken_ault_3', path: `${ANIMALS_DIR}/chicken_adult_3.png`, species: 'chicken', stage: 'adult', variant: 3 },

  { key: 'cow_child', path: `${ANIMALS_DIR}/cow_child.png`, species: 'cow', stage: 'child', variant: 0 },
  { key: 'cow_ault', path: `${ANIMALS_DIR}/cow_adult.png`, species: 'cow', stage: 'adult', variant: 0 },
  { key: 'cow_ault_2', path: `${ANIMALS_DIR}/cow_adult_2.png`, species: 'cow', stage: 'adult', variant: 2 },

  { key: 'duck_child', path: `${ANIMALS_DIR}/duck_child.png`, species: 'duck', stage: 'child', variant: 0 },
  { key: 'duck_ault_1', path: `${ANIMALS_DIR}/duck_adult_1.png`, species: 'duck', stage: 'adult', variant: 1 },
  { key: 'duck_ault_2', path: `${ANIMALS_DIR}/duck_adult_2.png`, species: 'duck', stage: 'adult', variant: 2 },
  { key: 'duck_ault_3', path: `${ANIMALS_DIR}/duck_adult_3.png`, species: 'duck', stage: 'adult', variant: 3 },

  { key: 'pig_child', path: `${ANIMALS_DIR}/pig_child.png`, species: 'pig', stage: 'child', variant: 0 },
  { key: 'pig_child_1', path: `${ANIMALS_DIR}/pig_child_1.png`, species: 'pig', stage: 'child', variant: 1 },
  { key: 'pig_adult', path: `${ANIMALS_DIR}/pig_adult.png`, species: 'pig', stage: 'adult', variant: 0 },
  { key: 'pig_adult_1', path: `${ANIMALS_DIR}/pig_adult_1.png`, species: 'pig', stage: 'adult', variant: 1 },

  { key: 'fish_child', path: `${ANIMALS_DIR}/fish_child.png`, species: 'fish', stage: 'child', variant: 0 },
  { key: 'fish_1', path: `${ANIMALS_DIR}/fish_adult.png`, species: 'fish', stage: 'adult', variant: 1 },
  { key: 'fish_2', path: `${ANIMALS_DIR}/fish_adult_1.png`, species: 'fish', stage: 'adult', variant: 2 },
  { key: 'fish_3', path: `${ANIMALS_DIR}/fish_adult_2.png`, species: 'fish', stage: 'adult', variant: 3 },
  { key: 'fish_4', path: `${ANIMALS_DIR}/fish_adult_3.png`, species: 'fish', stage: 'adult', variant: 4 },

  { key: 'sheep_child', path: `${ANIMALS_DIR}/sheep_child.png`, species: 'sheep', stage: 'child', variant: 0 },
  { key: 'sheep_ault', path: `${ANIMALS_DIR}/sheep_adult.png`, species: 'sheep', stage: 'adult', variant: 0 },
  { key: 'sheep_ault_1', path: `${ANIMALS_DIR}/sheep_adult_1.png`, species: 'sheep', stage: 'adult', variant: 1 },
  { key: 'sheep_ault_2', path: `${ANIMALS_DIR}/sheep_adult_2.png`, species: 'sheep', stage: 'adult', variant: 2 },

  { key: 'goat_child', path: `${ANIMALS_DIR}/goat_child.png`, species: 'goat', stage: 'child', variant: 0 },
  { key: 'goat_ault', path: `${ANIMALS_DIR}/goat_adult.png`, species: 'goat', stage: 'adult', variant: 0 },
  { key: 'goat_ault_1', path: `${ANIMALS_DIR}/goat_adult_1.png`, species: 'goat', stage: 'adult', variant: 1 },
  { key: 'goat_ault_2', path: `${ANIMALS_DIR}/goat_adult_2.png`, species: 'goat', stage: 'adult', variant: 2 },
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
/** Visual-only up-scale for pen house art (does not change placement footprint). */
export const PEN_HOUSE_VISUAL_SCALE = 1.1;
/** Visual-only Y scale for pen house art (allows aspect tuning without footprint changes). */
export const PEN_HOUSE_VISUAL_HEIGHT_SCALE = 1.0;
/** Species-specific visual X-scale overrides for pen/house art. */
export const PEN_HOUSE_VISUAL_SCALE_BY_SPECIES: Partial<Record<AnimalType, number>> = {
  chicken: 1.0,
  duck: 1.0,
  fish: 1.0,
  pig: 1.0,
  cow: 1.0,
  sheep: 1.0,
  goat: 1.0,
};
/** Species-specific visual Y-scale overrides for pen/house art. */
export const PEN_HOUSE_VISUAL_HEIGHT_SCALE_BY_SPECIES: Partial<Record<AnimalType, number>> = {
  chicken: 1.25,
  duck: 1.05,
  fish: 0.95,
  pig: 1.1,
  cow: 1.1,
  sheep: 1.1,
  goat: 1.1,
};
/** Visual-only vertical offset fraction relative to pen footprint display height (negative = up). */
export const PEN_HOUSE_Y_OFFSET_FRAC = -0.03;

const HOUSE_TEXTURE_TO_SPECIES: Partial<Record<string, AnimalType>> = Object.fromEntries(
  (Object.entries(LIVESTOCK_HOUSE_KEYS) as Array<[AnimalType, string]>).map(([species, texture]) => [
    texture,
    species,
  ])
) as Partial<Record<string, AnimalType>>;

/**
 * Fit box for pen house art — iso AABB of N×N diamonds × {@link PEN_HOUSE_FOOTPRINT_FIT_PADDING}.
 * Lv1: 192×96 px (3×64 × 3×32). Matches {@link isoRectFootprintScreenBounds}.
 */
export function penHouseDisplaySize(
  level: LivestockPenLevel,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
  fitPadding: number = PEN_HOUSE_FOOTPRINT_FIT_PADDING,
  visualScaleX: number = PEN_HOUSE_VISUAL_SCALE,
  visualScaleY: number = PEN_HOUSE_VISUAL_HEIGHT_SCALE,
  species?: AnimalType
): { width: number; height: number } {
  const tiles = LIVESTOCK_PEN_LEVELS[level].size;
  const speciesVisualScaleX = species
    ? PEN_HOUSE_VISUAL_SCALE_BY_SPECIES[species] ?? visualScaleX
    : visualScaleX;
  const speciesVisualScaleY = species
    ? PEN_HOUSE_VISUAL_HEIGHT_SCALE_BY_SPECIES[species] ?? visualScaleY
    : visualScaleY;
  const scaledX = fitPadding * speciesVisualScaleX;
  const scaledY = fitPadding * speciesVisualScaleY;
  return {
    width: tiles * tileW * scaledX,
    height: tiles * tileH * scaledY,
  };
}

export function penHouseYOffsetPx(
  level: LivestockPenLevel,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
  species?: AnimalType
): number {
  const display = penHouseDisplaySize(level, tileW, tileH, PEN_HOUSE_FOOTPRINT_FIT_PADDING, PEN_HOUSE_VISUAL_SCALE, PEN_HOUSE_VISUAL_HEIGHT_SCALE, species);
  return display.height * PEN_HOUSE_Y_OFFSET_FRAC;
}

/** @deprecated Use {@link penHouseDisplaySize}; species no longer changes fit box. */
export function penHouseFootprintFitBox(
  level: LivestockPenLevel,
  species?: AnimalType,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { width: number; height: number } {
  return penHouseDisplaySize(level, tileW, tileH, PEN_HOUSE_FOOTPRINT_FIT_PADDING, PEN_HOUSE_VISUAL_SCALE, PEN_HOUSE_VISUAL_HEIGHT_SCALE, species);
}

export function getAnimalTypeForHouseTextureKey(textureKey: string): AnimalType | undefined {
  return HOUSE_TEXTURE_TO_SPECIES[textureKey];
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
  const availableStages = getLivestockStagesForSpecies(species);
  for (const fallbackStage of availableStages) {
    const fallbackEntries = getLivestockTexturesFor(species, fallbackStage);
    if (fallbackEntries.length > 0) return fallbackEntries[0]!.key;
  }
  return getLivestockHouseTextureKey(species);
}

export function lifecycleStateToTextureStage(
  lifecycleState: AnimalLifecycleState | undefined,
  fallbackStage: LivestockStage = 'adult'
): LivestockStage {
  if (lifecycleState === 'baby' || lifecycleState === 'growing') return 'child';
  if (lifecycleState === 'adult' || lifecycleState === 'producing' || lifecycleState === 'hungry') {
    return 'adult';
  }
  return fallbackStage === 'young' ? 'child' : fallbackStage;
}

export function penFootprintTiles(level: LivestockPenLevel = 1): { w: number; h: number } {
  const size = LIVESTOCK_PEN_LEVELS[level].size;
  return { w: size, h: size };
}

/** Screen anchor + display size for pen house sprites (live pens and placement ghosts). */
export type PenHouseFootprintLayout = {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
};

export function penHouseFootprintLayout(
  grid: GridSystem,
  anchorGx: number,
  anchorGy: number,
  level: LivestockPenLevel,
  species?: AnimalType,
  tileW: number = DISPLAY_SIZE.tileW,
  tileH: number = DISPLAY_SIZE.tileH
): PenHouseFootprintLayout {
  const { w, h } = penFootprintTiles(level);
  const screen = grid.getRectMapFootprintScreenBounds(anchorGx, anchorGy, w, h);
  const display = penHouseDisplaySize(
    level,
    tileW,
    tileH,
    PEN_HOUSE_FOOTPRINT_FIT_PADDING,
    PEN_HOUSE_VISUAL_SCALE,
    PEN_HOUSE_VISUAL_HEIGHT_SCALE,
    species
  );
  const yOffset = penHouseYOffsetPx(level, tileW, tileH, species);
  return {
    x: screen.centerX,
    y: screen.bottomY + yOffset,
    displayWidth: Math.max(1, Math.round(display.width)),
    displayHeight: Math.max(1, Math.round(display.height)),
  };
}

/** Grid marker for duck/fish moat cells converted from grass (not river water). */
export const PEN_MOAT_WATER_OBJECT = 'pen_moat_water';

/** Duck/fish pens include a one-cell water moat around the fence footprint. */
export function penHasWaterMoat(animalType: AnimalType): boolean {
  return animalType === 'duck' || animalType === 'fish';
}

export function penHasWaterMoatForPen(pen: {
  animalType: AnimalType;
  penKind?: 'ruminant';
}): boolean {
  if (pen.penKind === 'ruminant') return false;
  return penHasWaterMoat(pen.animalType);
}

/** One-cell ring outside the pen house footprint (duck/fish only). */
export function penMoatCells(
  pen: { gridX: number; gridY: number; level?: LivestockPenLevel; animalType: AnimalType; penKind?: 'ruminant' }
): Array<{ gx: number; gy: number }> {
  if (!penHasWaterMoatForPen(pen)) return [];
  const { w, h } = penFootprintTiles(pen.level ?? 1);
  const cells: Array<{ gx: number; gy: number }> = [];
  for (let gy = pen.gridY - 1; gy <= pen.gridY + h; gy++) {
    for (let gx = pen.gridX - 1; gx <= pen.gridX + w; gx++) {
      if (gx >= pen.gridX && gx < pen.gridX + w && gy >= pen.gridY && gy < pen.gridY + h) {
        continue;
      }
      cells.push({ gx, gy });
    }
  }
  return cells;
}

export function penMoatOccupiesCell(
  pen: Parameters<typeof penMoatCells>[0],
  gx: number,
  gy: number
): boolean {
  return penMoatCells(pen).some((c) => c.gx === gx && c.gy === gy);
}

/** Pen house fence footprint only (not the duck/fish water moat ring). */
export function penFootprintOccupiesCell(
  pen: { gridX: number; gridY: number; level?: LivestockPenLevel },
  gx: number,
  gy: number
): boolean {
  const { w, h } = penFootprintTiles(pen.level ?? 1);
  return gx >= pen.gridX && gx < pen.gridX + w && gy >= pen.gridY && gy < pen.gridY + h;
}

/** Moat cell touches river/player water outside this pen's moat ring (bridge junction). */
export function penMoatTouchesExternalWater(
  grid: {
    inBounds(gx: number, gy: number): boolean;
    getCell(gx: number, gy: number): { type?: string } | null | undefined;
  },
  pen: Parameters<typeof penMoatCells>[0],
  gx: number,
  gy: number
): boolean {
  if (!penMoatOccupiesCell(pen, gx, gy)) return false;
  const cardinals: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of cardinals) {
    const nx = gx + dx;
    const ny = gy + dy;
    if (!grid.inBounds(nx, ny)) continue;
    if (grid.getCell(nx, ny)?.type !== 'water') continue;
    if (!penMoatOccupiesCell(pen, nx, ny)) return true;
  }
  return false;
}

export function penOccupiesCell(
  pen: { gridX: number; gridY: number; level?: LivestockPenLevel; animalType?: AnimalType; penKind?: 'ruminant' },
  gx: number,
  gy: number
): boolean {
  if (penFootprintOccupiesCell(pen, gx, gy)) return true;
  if (pen.animalType && penHasWaterMoatForPen(pen as { animalType: AnimalType; penKind?: 'ruminant' })) {
    return penMoatOccupiesCell(pen as Parameters<typeof penMoatCells>[0], gx, gy);
  }
  return false;
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

export type LivestockAnimalRenderBox = {
  width: number;
  height: number;
  yRatio: number;
};

const DEFAULT_ANIMAL_RENDER_BOX: LivestockAnimalRenderBox = {
  width: TILE_WIDTH * 0.9,
  height: DISPLAY_SIZE.buildingH * 0.5,
  yRatio: 0.42,
};

const SPECIES_ANIMAL_RENDER_BOX: Partial<Record<AnimalType, LivestockAnimalRenderBox>> = {
  goat: {
    width: TILE_WIDTH * 0.66,
    height: DISPLAY_SIZE.buildingH * 0.36,
    yRatio: 0.36,
  },
  sheep: {
    width: TILE_WIDTH * 0.66,
    height: DISPLAY_SIZE.buildingH * 0.36,
    yRatio: 0.36,
  },
};

const SPECIES_STAGE_RENDER_MULTIPLIER: Partial<
  Record<AnimalType, Partial<Record<LivestockStage, number>>>
> = {
  chicken: { child: 0.5, adult: 0.6 },
  cow: { child: 0.7, adult: 0.8 },
  duck: { child: 0.5, adult: 0.6 },
  fish: { child: 0.5, adult: 0.6 },
  pig: { child: 0.7, adult: 0.8 },
};

export function getLivestockAnimalRenderMultiplier(
  species: AnimalType,
  stage?: LivestockStage
): number {
  if (!stage) return 1;
  return SPECIES_STAGE_RENDER_MULTIPLIER[species]?.[stage] ?? 1;
}

export function getLivestockAnimalRenderBox(
  species: AnimalType,
  stage?: LivestockStage
): LivestockAnimalRenderBox {
  const base = SPECIES_ANIMAL_RENDER_BOX[species] ?? DEFAULT_ANIMAL_RENDER_BOX;
  const mul = getLivestockAnimalRenderMultiplier(species, stage);
  return {
    width: base.width * mul,
    height: base.height * mul,
    yRatio: base.yRatio,
  };
}

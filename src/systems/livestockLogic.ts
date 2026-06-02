import {
  DEFAULT_LIVESTOCK_PEN_ANCHORS,
  DEDICATED_PEN_SPECIES,
  defaultPenIdForSpecies,
  defaultRuminantPenId,
  isRuminantPenAnchor,
  LIVESTOCK_SPECIES_ORDER,
} from '../config/livestockPenLayout';
import {
  getLivestockDef,
  type AnimalType,
  type LivestockPenData,
} from '../config/LivestockConfig';
import {
  penFootprintCells,
  pickLivestockStage,
  pickLivestockVariantIndex,
  resolveLivestockAnimalTextureKey,
  speciesHasAnimalSprites,
  type LivestockPenLevel,
} from '../config/livestockAssets';

export function livestockPenKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export { penFootprintCells };

export function isRuminantPen(pen: LivestockPenData): boolean {
  return pen.penKind === 'ruminant';
}

export function isRuminantSpecies(animalType: AnimalType): boolean {
  return animalType === 'goat' || animalType === 'sheep';
}

/** Advance `producing` → `ready` when timer elapsed. */
export function tickLivestockPen(
  pen: LivestockPenData,
  nowMs: number
): LivestockPenData {
  if (pen.state !== 'producing' || pen.readyAt === undefined) return pen;
  if (nowMs >= pen.readyAt) {
    return { ...pen, state: 'ready' };
  }
  return pen;
}

export function tickAllLivestockPens(
  pens: LivestockPenData[],
  nowMs: number
): LivestockPenData[] {
  return pens.map((p) => tickLivestockPen(p, nowMs));
}

export function canStockPenWith(
  pen: LivestockPenData,
  animalType: AnimalType
): boolean {
  if (pen.state !== 'unstocked') return false;
  if (!speciesHasAnimalSprites(animalType)) return false;
  if (isRuminantPen(pen)) {
    return isRuminantSpecies(animalType);
  }
  const def = getLivestockDef(pen.animalType);
  if (def.houseOnly) return false;
  return pen.animalType === animalType;
}

/** Direct pen tap stock (non-ruminant species pens only; ruminant uses shop). */
export function canStockAnimal(pen: LivestockPenData): boolean {
  if (isRuminantPen(pen)) return false;
  if (pen.state !== 'unstocked') return false;
  const def = getLivestockDef(pen.animalType);
  if (def.houseOnly) return false;
  return speciesHasAnimalSprites(pen.animalType);
}

export function canFeedPen(pen: LivestockPenData): boolean {
  return pen.state === 'idle';
}

export function canUpgradePen(pen: LivestockPenData): boolean {
  return (pen.level ?? 1) === 1 && pen.state !== 'producing';
}

export function canCollectFromPen(pen: LivestockPenData, nowMs: number): boolean {
  const ticked = tickLivestockPen(pen, nowMs);
  return ticked.state === 'ready';
}

export function feedPen(pen: LivestockPenData, nowMs: number): LivestockPenData | null {
  if (!canFeedPen(pen)) return null;
  const def = getLivestockDef(pen.animalType);
  return {
    ...pen,
    state: 'producing',
    readyAt: nowMs + def.produceMs,
  };
}

export function collectFromPen(pen: LivestockPenData, nowMs: number): {
  pen: LivestockPenData;
  productItemId: string;
  qty: number;
} | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (ticked.state !== 'ready') return null;
  const def = getLivestockDef(ticked.animalType);
  return {
    pen: { ...ticked, state: 'idle', readyAt: undefined },
    productItemId: def.productItemId,
    qty: 1,
  };
}

export function stockPenWithAnimal(
  pen: LivestockPenData,
  animalType: AnimalType,
  rng: () => number = Math.random
): LivestockPenData | null {
  if (!canStockPenWith(pen, animalType)) return null;
  const stage = pickLivestockStage(animalType, rng);
  const variant = pickLivestockVariantIndex(animalType, stage, rng);
  const animalTextureKey = resolveLivestockAnimalTextureKey(animalType, stage, variant);
  return {
    ...pen,
    animalType,
    state: 'idle',
    readyAt: undefined,
    stage,
    variant,
    animalTextureKey,
  };
}

export function upgradePen(pen: LivestockPenData): LivestockPenData | null {
  if (!canUpgradePen(pen)) return null;
  return { ...pen, level: 2 as LivestockPenLevel };
}

/** Cells that must be free when upgrading 3×3 → 4×4 (the new ring). */
export function penUpgradeExpansionCells(pen: LivestockPenData): Array<{ gx: number; gy: number }> {
  const target = penFootprintCells({ ...pen, level: 2 });
  const current = new Set(
    penFootprintCells({ ...pen, level: 1 }).map((c) => `${c.gx},${c.gy}`)
  );
  return target.filter((c) => !current.has(`${c.gx},${c.gy}`));
}

export function createNewPen(
  id: string,
  animalType: AnimalType,
  gridX: number,
  gridY: number,
  level: LivestockPenLevel = 1
): LivestockPenData {
  return {
    id,
    animalType,
    gridX,
    gridY,
    state: 'unstocked',
    level,
  };
}

/** Shared goat/sheep pen (empty: sheep_house art until first shop purchase). */
export function createRuminantPen(
  id: string,
  gridX: number,
  gridY: number,
  level: LivestockPenLevel = 1
): LivestockPenData {
  return {
    id,
    penKind: 'ruminant',
    animalType: 'sheep',
    gridX,
    gridY,
    state: 'unstocked',
    level,
  };
}

function migrateSavedPen(p: LivestockPenData): LivestockPenData {
  if (p.penKind === 'ruminant') return p;
  if (p.animalType === 'goat' || p.animalType === 'sheep') {
    if (p.state === 'unstocked') {
      return { ...p, penKind: 'ruminant', animalType: 'sheep' };
    }
    return { ...p, penKind: 'ruminant' };
  }
  return p;
}

function isValidSavedPen(p: LivestockPenData): boolean {
  if (isRuminantPen(p)) return true;
  if (DEDICATED_PEN_SPECIES.includes(p.animalType)) return true;
  return LIVESTOCK_SPECIES_ORDER.includes(p.animalType);
}

/** Default pens at {@link DEFAULT_LIVESTOCK_PEN_ANCHORS} (dev reference layout). */
export function createDefaultFarmPens(): LivestockPenData[] {
  return DEFAULT_LIVESTOCK_PEN_ANCHORS.map((anchor) => {
    if (isRuminantPenAnchor(anchor)) {
      return createRuminantPen(defaultRuminantPenId(), anchor.gridX, anchor.gridY, 1);
    }
    return createNewPen(
      defaultPenIdForSpecies(anchor.animalType),
      anchor.animalType,
      anchor.gridX,
      anchor.gridY,
      1
    );
  });
}

/** Sanitize saved pens (player-placed only; no auto-fill missing species). */
export function normalizeSavedLivestockPens(saved: LivestockPenData[]): LivestockPenData[] {
  return saved
    .map(migrateSavedPen)
    .filter(isValidSavedPen)
    .map((p, i) => ({
      ...p,
      id: p.id || `pen-${p.penKind === 'ruminant' ? 'ruminant' : p.animalType}-${i + 1}`,
      level: (p.level ?? 1) as LivestockPenLevel,
    }));
}

export function getPenForSpecies(
  pens: LivestockPenData[],
  animalType: AnimalType
): LivestockPenData | undefined {
  if (isRuminantSpecies(animalType)) {
    const shared = pens.find((p) => isRuminantPen(p));
    if (shared) return shared;
    return pens.find((p) => p.animalType === animalType);
  }
  return pens.find((p) => !isRuminantPen(p) && p.animalType === animalType);
}

/** First pen/pond of species that can accept a newly purchased animal. */
export function findPenForStocking(
  pens: LivestockPenData[],
  animalType: AnimalType
): LivestockPenData | undefined {
  return pens.find((p) => canStockPenWith(p, animalType));
}

export function penActionLabel(
  pen: LivestockPenData,
  nowMs: number
): 'stock' | 'feed' | 'collect' | 'wait' | 'upgrade' | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (ticked.state === 'unstocked') return 'stock';
  if (ticked.state === 'idle') return 'feed';
  if (ticked.state === 'ready') return 'collect';
  if (ticked.state === 'producing') return 'wait';
  return null;
}

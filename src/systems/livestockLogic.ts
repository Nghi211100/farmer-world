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
  LIVESTOCK_PEN_MAX_LEVEL,
  livestockPenCapacity,
  type AnimalLifecycleState,
  type AnimalType,
  type LivestockAnimalLifecycle,
  type LivestockPenData,
  type PenAnimalData,
  type RuminantOccupantData,
} from '../config/LivestockConfig';
import {
  penFootprintCells,
  pickLivestockStage,
  pickLivestockVariantIndex,
  resolveLivestockAnimalTextureKey,
  speciesHasAnimalSprites,
  type LivestockPenLevel,
} from '../config/livestockAssets';
import { formatGrowthTime } from '../utils/iso';

export function livestockPenKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export { penFootprintCells };

export function isRuminantPen(pen: LivestockPenData): boolean {
  return pen.penKind === 'ruminant';
}

export function isRuminantSpecies(animalType: AnimalType): animalType is 'goat' | 'sheep' {
  return animalType === 'goat' || animalType === 'sheep';
}

function normalizeRuminantOccupants(pen: LivestockPenData): RuminantOccupantData[] {
  const raw = pen.ruminantOccupants ?? [];
  const out: RuminantOccupantData[] = [];
  for (const occupant of raw) {
    if (!occupant) continue;
    if (!isRuminantSpecies(occupant.animalType)) continue;
    out.push(occupant);
  }
  return out;
}

export function penCapacity(pen: LivestockPenData): number {
  return livestockPenCapacity((pen.level ?? 1) as LivestockPenLevel);
}

export function penStockCount(pen: LivestockPenData): number {
  if (isRuminantPen(pen)) {
    const byOccupants = normalizeRuminantOccupants(pen).length;
    const bySavedCount = Math.max(0, Math.floor(pen.stockCount ?? 0));
    return Math.max(byOccupants, bySavedCount);
  }
  if (pen.state === 'unstocked') return 0;
  const byAnimals = pen.penAnimals?.length ?? 0;
  if (byAnimals > 0) return byAnimals;
  return Math.max(1, Math.floor(pen.stockCount ?? 1));
}

function clampHappiness(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function newAnimalLifecycle(nowMs: number, animalType: AnimalType): LivestockAnimalLifecycle {
  const def = getLivestockDef(animalType);
  return {
    lifecycleState: 'baby',
    growthStartAt: nowMs,
    growthDurationMs: def.growthMs,
    productionProgressMs: 0,
    hungerSinceFeedMs: 0,
    happiness: 100,
    lastUpdatedAt: nowMs,
  };
}

function lifecycleFromPenFallback(pen: LivestockPenData, nowMs: number): LivestockAnimalLifecycle {
  const def = getLivestockDef(pen.animalType);
  return {
    lifecycleState: pen.lifecycleState ?? 'baby',
    growthStartAt: pen.growthStartAt ?? nowMs,
    growthDurationMs: pen.growthDurationMs ?? def.growthMs,
    productionProgressMs: pen.productionProgressMs ?? 0,
    hungerSinceFeedMs: pen.hungerSinceFeedMs ?? 0,
    hungrySince: pen.hungrySince,
    happiness: pen.happiness ?? 100,
    lastUpdatedAt: pen.lastUpdatedAt ?? nowMs,
  };
}

function animalHasLifecycle(a: PenAnimalData | RuminantOccupantData): boolean {
  return a.growthStartAt != null || a.lifecycleState != null;
}

function syncPenAggregateFromAnimals(pen: LivestockPenData, nowMs: number): LivestockPenData {
  if (isRuminantPen(pen)) {
    const occupants = normalizeRuminantOccupants(pen);
    if (occupants.length === 0) {
      return { ...pen, stockCount: 0, state: 'unstocked', lifecycleState: undefined, readyAt: undefined };
    }
    const primary = occupants[0]!;
    const tickedOccupants = occupants.map((o) => ({
      ...o,
      ...tickAnimalInstance(o, o.animalType, nowMs),
    }));
    const snapshots = tickedOccupants.map((ticked) => ({
      ticked,
      ready: isAnimalProductionReady(ticked, ticked.animalType),
    }));
    const anyReady = snapshots.some((s) => s.ready);
    const anyHungry = snapshots.some((s) => s.ticked.lifecycleState === 'hungry');
    const immature = snapshots.find(
      (s) => s.ticked.lifecycleState === 'baby' || s.ticked.lifecycleState === 'growing'
    );
    const penState: LivestockPenData['state'] = anyReady
      ? 'ready'
      : anyHungry || immature
        ? 'idle'
        : 'producing';
    const penLifecycle: AnimalLifecycleState = anyHungry
      ? 'hungry'
      : immature
        ? (immature.ticked.lifecycleState === 'growing' ? 'growing' : 'baby')
        : 'producing';
    const p0 = snapshots[0]!.ticked;
    return {
      ...pen,
      ruminantOccupants: tickedOccupants,
      stockCount: tickedOccupants.length,
      animalType: primary.animalType,
      stage: primary.stage,
      variant: primary.variant,
      animalTextureKey: primary.animalTextureKey,
      state: penState,
      lifecycleState: penLifecycle,
      growthStartAt: p0.growthStartAt,
      growthDurationMs: p0.growthDurationMs,
      productionProgressMs: p0.productionProgressMs,
      hungerSinceFeedMs: p0.hungerSinceFeedMs,
      hungrySince: p0.hungrySince,
      happiness: p0.happiness,
      lastUpdatedAt: nowMs,
      readyAt: anyReady ? nowMs : undefined,
    };
  }

  const animals = pen.penAnimals ?? [];
  if (animals.length === 0) {
    return { ...pen, stockCount: 0, state: 'unstocked', lifecycleState: undefined, readyAt: undefined };
  }
  const primary = animals[0]!;
  const tickedAnimals = animals.map((a) => ({
    ...a,
    ...tickAnimalInstance(a, pen.animalType, nowMs),
  }));
  const snapshots = tickedAnimals.map((ticked) => ({
    ticked,
    ready: isAnimalProductionReady(ticked, pen.animalType),
  }));
  const anyReady = snapshots.some((s) => s.ready);
  const anyHungry = snapshots.some((s) => s.ticked.lifecycleState === 'hungry');
  const immature = snapshots.find(
    (s) => s.ticked.lifecycleState === 'baby' || s.ticked.lifecycleState === 'growing'
  );
  const penState: LivestockPenData['state'] = anyReady
    ? 'ready'
    : anyHungry || immature
      ? 'idle'
      : 'producing';
  const penLifecycle: AnimalLifecycleState = anyHungry
    ? 'hungry'
    : immature
      ? (immature.ticked.lifecycleState === 'growing' ? 'growing' : 'baby')
      : 'producing';
  const p0 = snapshots[0]!.ticked;
  return {
    ...pen,
    penAnimals: tickedAnimals,
    stockCount: tickedAnimals.length,
    stage: primary.stage,
    variant: primary.variant,
    animalTextureKey: primary.animalTextureKey,
    state: penState,
    lifecycleState: penLifecycle,
    growthStartAt: p0.growthStartAt,
    growthDurationMs: p0.growthDurationMs,
    productionProgressMs: p0.productionProgressMs,
    hungerSinceFeedMs: p0.hungerSinceFeedMs,
    hungrySince: p0.hungrySince,
    happiness: p0.happiness,
    lastUpdatedAt: nowMs,
    readyAt: anyReady ? nowMs : undefined,
  };
}

export function ensureDedicatedPenAnimals(pen: LivestockPenData, nowMs: number = Date.now()): LivestockPenData {
  if (pen.state === 'unstocked' || isRuminantPen(pen)) return pen;
  const count = Math.max(0, Math.floor(pen.stockCount ?? 0));
  if (count === 0) return { ...pen, penAnimals: [], stockCount: 0 };

  const existing = pen.penAnimals ?? [];
  if (existing.length >= count && existing.slice(0, count).every(animalHasLifecycle)) {
    return { ...pen, penAnimals: existing.slice(0, count), stockCount: count };
  }

  const fallback = lifecycleFromPenFallback(pen, nowMs);
  const animals: PenAnimalData[] = [];
  for (let i = 0; i < count; i++) {
    const prev = existing[i];
    if (prev && animalHasLifecycle(prev)) {
      animals.push({ ...prev, animalType: prev.animalType ?? pen.animalType });
    } else if (i === 0) {
      animals.push({
        animalType: pen.animalType,
        stage: prev?.stage ?? pen.stage,
        variant: prev?.variant ?? pen.variant,
        animalTextureKey: prev?.animalTextureKey ?? pen.animalTextureKey,
        ...fallback,
      });
    } else {
      animals.push({
        animalType: pen.animalType,
        stage: prev?.stage ?? pen.stage,
        variant: prev?.variant ?? pen.variant,
        animalTextureKey: prev?.animalTextureKey ?? pen.animalTextureKey,
        ...newAnimalLifecycle(nowMs, pen.animalType),
      });
    }
  }
  return { ...pen, penAnimals: animals, stockCount: count };
}

function ensureRuminantOccupantLifecycle(
  pen: LivestockPenData,
  occupants: RuminantOccupantData[],
  nowMs: number
): RuminantOccupantData[] {
  const fallback = lifecycleFromPenFallback(pen, nowMs);
  return occupants.map((o, i) => {
    if (animalHasLifecycle(o)) return o;
    if (i === 0) return { ...o, ...fallback };
    return { ...o, ...newAnimalLifecycle(nowMs, o.animalType) };
  });
}

export function growthProgressRatioForAnimal(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): number {
  const def = getLivestockDef(animalType);
  const start = animal.growthStartAt ?? nowMs;
  const duration = Math.max(1, animal.growthDurationMs ?? def.growthMs);
  return Math.max(0, Math.min(1, (nowMs - start) / duration));
}

export function growthProgressRatio(pen: LivestockPenData, nowMs: number): number {
  const prepared = isRuminantPen(pen)
    ? pen
    : ensureDedicatedPenAnimals(pen, nowMs);
  if (isRuminantPen(prepared)) {
    const o = normalizeRuminantOccupants(prepared)[0];
    if (!o) return 0;
    return growthProgressRatioForAnimal(o, o.animalType, nowMs);
  }
  const a = prepared.penAnimals?.[0];
  if (!a) return 0;
  return growthProgressRatioForAnimal(a, prepared.animalType, nowMs);
}

export function tickAnimalInstance(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): LivestockAnimalLifecycle {
  const def = getLivestockDef(animalType);
  const lastUpdatedAt = animal.lastUpdatedAt ?? animal.growthStartAt ?? nowMs;
  const elapsed = Math.max(0, nowMs - lastUpdatedAt);
  const happiness = clampHappiness(animal.happiness ?? 100);
  const prevLifecycle = animal.lifecycleState ?? 'baby';
  let lifecycleState: AnimalLifecycleState = prevLifecycle;
  let productionProgressMs = animal.productionProgressMs ?? 0;
  let hungrySince = animal.hungrySince;
  let hungerSinceFeedMs = animal.hungerSinceFeedMs ?? 0;
  let nextHappiness = happiness;

  const growthRatio = growthProgressRatioForAnimal(animal, animalType, nowMs);
  if (lifecycleState === 'baby' || lifecycleState === 'growing') {
    lifecycleState = growthRatio >= 1 ? 'adult' : growthRatio >= 0.5 ? 'growing' : 'baby';
  }
  const justMatured =
    (prevLifecycle === 'baby' || prevLifecycle === 'growing') &&
    lifecycleState !== 'baby' &&
    lifecycleState !== 'growing';
  if (lifecycleState === 'adult') {
    lifecycleState = 'producing';
  }
  if (justMatured) {
    productionProgressMs = 0;
    hungerSinceFeedMs = 0;
  }

  if (lifecycleState === 'hungry') {
    const hungryMs = Math.max(0, nowMs - (hungrySince ?? nowMs));
    if (hungryMs > 240 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.5);
    else if (hungryMs > 120 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.75);
    else if (hungryMs > 60 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.9);
  } else if (lifecycleState === 'producing') {
    const speedMultiplier = 0.5 + happiness / 200;
    if (!justMatured) {
      productionProgressMs += elapsed * speedMultiplier;
      hungerSinceFeedMs += elapsed;
    }
    if (hungerSinceFeedMs >= def.hungryAfterMs) {
      lifecycleState = 'hungry';
      hungrySince = nowMs;
    }
  }

  return {
    ...animal,
    lifecycleState,
    happiness: nextHappiness,
    productionProgressMs,
    hungerSinceFeedMs,
    hungrySince,
    lastUpdatedAt: nowMs,
  };
}

/** Harvestable: production bar full while still adult cycle (producing or hungry). */
export function isAnimalProductionReady(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType
): boolean {
  const state = animal.lifecycleState;
  if (state !== 'producing' && state !== 'hungry') return false;
  const def = getLivestockDef(animalType);
  return (animal.productionProgressMs ?? 0) >= def.produceMs;
}

/** `produce` = lifecycle producing (timer is still satiation-until-hungry, not product cooldown). */
export type LivestockTimerKind = 'ready' | 'grow' | 'produce' | 'hungry';

export interface LivestockTimerInfo {
  kind: LivestockTimerKind;
  /** Satiation bar 0..1 (1 = fed/full, 0 = starving). */
  hungerProgress: number;
  /** Progress bar fill 0..1 (mirrors hungerProgress — satiation, not growth/production). */
  barProgress: number;
  /** Label above bar (growth countdown, "Ready", or empty — no hunger HH:MM:SS). */
  growthTimeText: string;
}

/** Feed when satiation bar ≤ this fraction (85% of hunger window elapsed). */
export const LIVESTOCK_ALMOST_HUNGRY_SATIATION = 0.15;

function hungerProgressRatioForAnimal(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType
): number {
  if (animal.lifecycleState === 'hungry') return 0;
  const def = getLivestockDef(animalType);
  const hungryAfter = Math.max(1, def.hungryAfterMs);
  const fedMs = animal.hungerSinceFeedMs ?? 0;
  return Math.max(0, Math.min(1, 1 - fedMs / hungryAfter));
}

/** True when hungry or producing with satiation at/below the almost-hungry threshold. */
export function isAnimalFeedable(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType
): boolean {
  if (animal.lifecycleState === 'hungry') return true;
  if (animal.lifecycleState !== 'producing') return false;
  return (
    hungerProgressRatioForAnimal(animal, animalType) <= LIVESTOCK_ALMOST_HUNGRY_SATIATION
  );
}

/** Seconds until maturation (0 when growth window elapsed). */
function growthRemainingSec(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): number {
  const def = getLivestockDef(animalType);
  const start = animal.growthStartAt ?? nowMs;
  const duration = Math.max(1, animal.growthDurationMs ?? def.growthMs);
  return Math.max(0, (duration - (nowMs - start)) / 1000);
}

function buildLivestockTimerInfo(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): LivestockTimerInfo | null {
  const hungerProgress = hungerProgressRatioForAnimal(animal, animalType);
  const barProgress = hungerProgress;

  if (isAnimalProductionReady(animal, animalType)) {
    return { kind: 'ready', hungerProgress, barProgress, growthTimeText: 'Ready' };
  }
  if (animal.lifecycleState === 'hungry') {
    return {
      kind: 'hungry',
      hungerProgress: 0,
      barProgress: 0,
      growthTimeText: '',
    };
  }
  if (animal.lifecycleState === 'baby' || animal.lifecycleState === 'growing') {
    return {
      kind: 'grow',
      hungerProgress,
      barProgress,
      growthTimeText: formatGrowthTime(growthRemainingSec(animal, animalType, nowMs)),
    };
  }
  if (animal.lifecycleState === 'producing') {
    return {
      kind: 'produce',
      hungerProgress,
      barProgress,
      growthTimeText: '',
    };
  }
  return null;
}

/** Hunger bar + countdown for one animal instance (advances timers). */
export function getLivestockTimerInfoForAnimal(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): LivestockTimerInfo | null {
  const ticked = tickAnimalInstance(animal, animalType, nowMs);
  return buildLivestockTimerInfo(ticked, animalType, nowMs);
}

/** Primary animal timer (slot 0); pen should already be ticked for live UI. */
export function getLivestockTimerInfo(
  pen: LivestockPenData,
  nowMs: number
): LivestockTimerInfo | null {
  return getLivestockTimerInfoForSlot(pen, 0, nowMs);
}

/** Per-slot timer from an already-ticked pen (used by world overlays). */
export function getLivestockTimerInfoForSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): LivestockTimerInfo | null {
  if (pen.state === 'unstocked') return null;
  if (isRuminantPen(pen)) {
    const occupant = normalizeRuminantOccupants(pen)[slotIndex];
    if (!occupant) return null;
    return buildLivestockTimerInfo(occupant, occupant.animalType, nowMs);
  }
  const animal = pen.penAnimals?.[slotIndex];
  if (animal) return buildLivestockTimerInfo(animal, pen.animalType, nowMs);
  if (slotIndex !== 0) return null;
  return buildLivestockTimerInfo(lifecycleFromPenFallback(pen, nowMs), pen.animalType, nowMs);
}

/** Offline-capable lifecycle tick — each stocked animal advances independently. */
export function tickLivestockPen(
  pen: LivestockPenData,
  nowMs: number
): LivestockPenData {
  if (pen.state === 'unstocked') return pen;
  if (isRuminantPen(pen)) {
    const prepared = {
      ...pen,
      ruminantOccupants: ensureRuminantOccupantLifecycle(
        pen,
        normalizeRuminantOccupants(pen),
        nowMs
      ),
    };
    return syncPenAggregateFromAnimals(prepared, nowMs);
  }
  const prepared = ensureDedicatedPenAnimals(pen, nowMs);
  return syncPenAggregateFromAnimals(prepared, nowMs);
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
  if (penStockCount(pen) >= penCapacity(pen)) return false;
  if (isRuminantPen(pen)) {
    if (!isRuminantSpecies(animalType)) return false;
    if (!speciesHasAnimalSprites(animalType)) return false;
    return true;
  }
  if (!speciesHasAnimalSprites(animalType)) return false;
  const def = getLivestockDef(pen.animalType);
  if (def.houseOnly) return false;
  return pen.animalType === animalType;
}

/** Empty pen slots for a species across all compatible pens, capped by coins. */
export function maxLivestockPurchasable(
  pens: LivestockPenData[],
  animalType: AnimalType,
  unitPrice: number,
  coins: number
): number {
  let slots = 0;
  for (const pen of pens) {
    if (!canStockPenWith(pen, animalType)) continue;
    slots += penCapacity(pen) - penStockCount(pen);
  }
  if (slots <= 0) return 0;
  const maxByCoins = unitPrice > 0 ? Math.floor(coins / unitPrice) : slots;
  return Math.min(slots, maxByCoins);
}

/** Direct pen tap stock (non-ruminant species pens only; ruminant uses shop). */
export function canStockAnimal(pen: LivestockPenData): boolean {
  if (isRuminantPen(pen)) return false;
  if (penStockCount(pen) >= penCapacity(pen)) return false;
  const def = getLivestockDef(pen.animalType);
  if (def.houseOnly) return false;
  return speciesHasAnimalSprites(pen.animalType);
}

export function canFeedPen(pen: LivestockPenData, nowMs: number = Date.now()): boolean {
  if (pen.state === 'unstocked') return false;
  const slots = penAnimalSlotCount(pen);
  for (let i = 0; i < slots; i++) {
    if (canFeedAnimalAtSlot(pen, i, nowMs)) return true;
  }
  return false;
}

export function canUpgradePen(pen: LivestockPenData): boolean {
  return !isPenAtMaxLevel(pen);
}

export function canCollectFromPen(pen: LivestockPenData, nowMs: number): boolean {
  const ticked = tickLivestockPen(pen, nowMs);
  return ticked.state === 'ready';
}

function feedAnimalInstance(
  animal: LivestockAnimalLifecycle,
  nowMs: number
): LivestockAnimalLifecycle {
  return {
    ...animal,
    lifecycleState: 'producing',
    hungrySince: undefined,
    hungerSinceFeedMs: 0,
    lastUpdatedAt: nowMs,
  };
}

export function feedPen(pen: LivestockPenData, nowMs: number): LivestockPenData | null {
  if (!canFeedPen(pen, nowMs)) return null;
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const occupants = (ticked.ruminantOccupants ?? []).map((o) =>
      isAnimalFeedable(o, o.animalType)
        ? { ...o, ...feedAnimalInstance(o, nowMs) }
        : o
    );
    if (!occupants.some((o, i) => o !== ticked.ruminantOccupants?.[i])) return null;
    return syncPenAggregateFromAnimals({ ...ticked, ruminantOccupants: occupants }, nowMs);
  }
  const animals = (ticked.penAnimals ?? []).map((a) =>
    isAnimalFeedable(a, ticked.animalType)
      ? { ...a, ...feedAnimalInstance(a, nowMs) }
      : a
  );
  if (!animals.some((a, i) => a !== ticked.penAnimals?.[i])) return null;
  return syncPenAggregateFromAnimals({ ...ticked, penAnimals: animals }, nowMs);
}

export function collectFromPen(pen: LivestockPenData, nowMs: number): {
  pen: LivestockPenData;
  productItemId: string;
  qty: number;
} | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const occupants = ticked.ruminantOccupants ?? [];
    let collectedType: AnimalType | null = null;
    let collectedHappiness = 100;
    const nextOccupants = occupants.map((o) => {
      const instance = tickAnimalInstance(o, o.animalType, nowMs);
      const ready = isAnimalProductionReady(instance, o.animalType);
      if (!collectedType && ready) {
        collectedType = o.animalType;
        collectedHappiness = instance.happiness ?? 100;
        return {
          ...o,
          ...instance,
          lifecycleState: 'producing' as const,
          productionProgressMs: 0,
          lastUpdatedAt: nowMs,
        };
      }
      return { ...o, ...instance };
    });
    if (!collectedType) return null;
    const def = getLivestockDef(collectedType);
    const quantityMultiplier = 0.5 + clampHappiness(collectedHappiness) / 200;
    const nextPen = syncPenAggregateFromAnimals(
      { ...ticked, ruminantOccupants: nextOccupants },
      nowMs
    );
    return {
      pen: nextPen,
      productItemId: def.productItemId,
      qty: Math.max(1, Math.floor(quantityMultiplier)),
    };
  }

  const animals = ticked.penAnimals ?? [];
  let collectedHappiness = 100;
  let collected = false;
  const nextAnimals = animals.map((a) => {
    const instance = tickAnimalInstance(a, ticked.animalType, nowMs);
    const ready = isAnimalProductionReady(instance, ticked.animalType);
    if (!collected && ready) {
      collected = true;
      collectedHappiness = instance.happiness ?? 100;
      return {
        ...a,
        ...instance,
        lifecycleState: 'producing' as const,
        productionProgressMs: 0,
        lastUpdatedAt: nowMs,
      };
    }
    return { ...a, ...instance };
  });
  if (!collected) return null;
  const def = getLivestockDef(ticked.animalType);
  const quantityMultiplier = 0.5 + clampHappiness(collectedHappiness) / 200;
  const nextPen = syncPenAggregateFromAnimals({ ...ticked, penAnimals: nextAnimals }, nowMs);
  return {
    pen: nextPen,
    productItemId: def.productItemId,
    qty: Math.max(1, Math.floor(quantityMultiplier)),
  };
}

export function stockPenWithAnimal(
  pen: LivestockPenData,
  animalType: AnimalType,
  rng: () => number = Math.random,
  nowMs: number = Date.now()
): LivestockPenData | null {
  if (!canStockPenWith(pen, animalType)) return null;
  const stage = pickLivestockStage(animalType, rng);
  const variant = pickLivestockVariantIndex(animalType, stage, rng);
  const animalTextureKey = resolveLivestockAnimalTextureKey(animalType, stage, variant);
  const now = nowMs;
  if (isRuminantPen(pen) && isRuminantSpecies(animalType)) {
    const existing = ensureRuminantOccupantLifecycle(
      pen,
      normalizeRuminantOccupants(pen),
      now
    );
    const nextOccupants = [
      ...existing,
      {
        animalType,
        stage,
        variant,
        animalTextureKey,
        ...newAnimalLifecycle(now, animalType),
      } satisfies RuminantOccupantData,
    ].sort((a, b) => (a.animalType === b.animalType ? 0 : a.animalType === 'goat' ? -1 : 1));
    const primary = nextOccupants[0] ?? null;
    if (!primary) return null;
    return syncPenAggregateFromAnimals(
      {
        ...pen,
        animalType: primary.animalType,
        readyAt: undefined,
        stage: primary.stage,
        variant: primary.variant,
        animalTextureKey: primary.animalTextureKey,
        ruminantOccupants: nextOccupants,
      },
      now
    );
  }
  const prepared = ensureDedicatedPenAnimals(pen, now);
  const nextAnimals: PenAnimalData[] = [
    ...(prepared.penAnimals ?? []),
    {
      animalType,
      stage,
      variant,
      animalTextureKey,
      ...newAnimalLifecycle(now, animalType),
    },
  ];
  return syncPenAggregateFromAnimals(
    {
      ...prepared,
      animalType,
      readyAt: undefined,
      penAnimals: nextAnimals,
      stockCount: nextAnimals.length,
    },
    now
  );
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
    stockCount: 0,
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
    stockCount: 0,
    ruminantOccupants: [],
  };
}

function migrateSavedPen(p: LivestockPenData): LivestockPenData {
  if (p.penKind === 'ruminant') {
    const occupants = normalizeRuminantOccupants(p);
    const cappedOccupants = occupants.slice(0, livestockPenCapacity((p.level ?? 1) as LivestockPenLevel));
    if (occupants.length > 0) {
      const primary = cappedOccupants[0]!;
      return {
        ...p,
        animalType: primary.animalType,
        stage: primary.stage,
        variant: primary.variant,
        animalTextureKey: primary.animalTextureKey,
        stockCount: cappedOccupants.length,
        state: cappedOccupants.length > 0 ? (p.state === 'unstocked' ? 'idle' : p.state) : 'unstocked',
        ruminantOccupants: cappedOccupants,
      };
    }
    if (p.state === 'unstocked') {
      return { ...p, animalType: 'sheep', stockCount: 0, ruminantOccupants: [] };
    }
    if (isRuminantSpecies(p.animalType)) {
      return {
        ...p,
        stockCount: 1,
        ruminantOccupants: [
          {
            animalType: p.animalType,
            stage: p.stage,
            variant: p.variant,
            animalTextureKey: p.animalTextureKey,
            lifecycleState: p.lifecycleState ?? 'baby',
            growthStartAt: p.growthStartAt ?? Date.now(),
          },
        ],
      };
    }
    return { ...p, animalType: 'sheep', stockCount: 0, state: 'unstocked', ruminantOccupants: [] };
  }
  if (p.animalType === 'goat' || p.animalType === 'sheep') {
    if (p.state === 'unstocked') {
      return { ...p, penKind: 'ruminant', animalType: 'sheep', stockCount: 0, ruminantOccupants: [] };
    }
    return {
      ...p,
      penKind: 'ruminant',
      stockCount: 1,
      ruminantOccupants: [
        {
          animalType: p.animalType,
          stage: p.stage,
          variant: p.variant,
          animalTextureKey: p.animalTextureKey,
          lifecycleState: p.lifecycleState ?? 'baby',
          growthStartAt: p.growthStartAt ?? Date.now(),
        },
      ],
    };
  }
  const normalizedCount = Math.min(
    livestockPenCapacity((p.level ?? 1) as LivestockPenLevel),
    p.state === 'unstocked' ? 0 : Math.max(1, Math.floor(p.stockCount ?? 1))
  );
  return {
    ...p,
    stockCount: normalizedCount,
    state: normalizedCount === 0 ? 'unstocked' : p.state,
  };
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
  const now = Date.now();
  return saved
    .map(migrateSavedPen)
    .filter(isValidSavedPen)
    .map((p, i) => {
      const base = {
        ...p,
        id: p.id || `pen-${p.penKind === 'ruminant' ? 'ruminant' : p.animalType}-${i + 1}`,
        level: (p.level ?? 1) as LivestockPenLevel,
      };
      if (base.state === 'unstocked') return base;
      if (isRuminantPen(base)) {
        const occupants = ensureRuminantOccupantLifecycle(
          base,
          normalizeRuminantOccupants(base),
          now
        );
        return syncPenAggregateFromAnimals({ ...base, ruminantOccupants: occupants }, now);
      }
      return ensureDedicatedPenAnimals(base, now);
    });
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

/** Sell price multiplier when pen or target animal is hungry (still sellable). */
export const LIVESTOCK_HUNGRY_SELL_MULTIPLIER = 0.95;

export function penActionLabel(
  pen: LivestockPenData,
  nowMs: number
): 'stock' | 'feed' | 'collect' | 'wait' | 'upgrade' | 'sell' | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (ticked.state === 'unstocked') return 'stock';
  if (livestockSellPrice(ticked, nowMs) > 0) return 'sell';
  if (ticked.state === 'ready') return 'collect';
  if (ticked.lifecycleState === 'hungry' || ticked.lifecycleState === 'adult') return 'feed';
  if (ticked.lifecycleState === 'baby' || ticked.lifecycleState === 'growing') return 'sell';
  if (ticked.state === 'producing') return 'wait';
  return null;
}

function isSellableAnimalLifecycle(state: AnimalLifecycleState | undefined): boolean {
  return state === 'baby' || state === 'growing' || state === 'hungry';
}

/** Same rules as single-slot sell: immature (≥50% growth), mature adults, or harvest-ready. */
export function isAnimalSellable(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): boolean {
  const ticked = tickAnimalInstance(animal, animalType, nowMs);
  if (isAnimalProductionReady(ticked, animalType)) return true;
  const growth = growthProgressRatioForAnimal(ticked, animalType, nowMs);
  if (growth >= 1) return true;
  return isSellableAnimalLifecycle(ticked.lifecycleState) && growth >= 0.5;
}

function applyHungrySellDiscount(
  price: number,
  animal: LivestockAnimalLifecycle,
  penHungry: boolean
): number {
  if (price <= 0) return 0;
  if (animal.lifecycleState === 'hungry' || penHungry) {
    return Math.floor(price * LIVESTOCK_HUNGRY_SELL_MULTIPLIER);
  }
  return price;
}

function findSellableAnimalIndex(pen: LivestockPenData, nowMs: number): number {
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const occupants = ticked.ruminantOccupants ?? [];
    for (let i = occupants.length - 1; i >= 0; i--) {
      const o = occupants[i]!;
      if (isAnimalSellable(o, o.animalType, nowMs)) return i;
    }
    return -1;
  }
  const animals = ticked.penAnimals ?? [];
  for (let i = animals.length - 1; i >= 0; i--) {
    if (isAnimalSellable(animals[i]!, ticked.animalType, nowMs)) return i;
  }
  return -1;
}

export function livestockSellPriceForAnimal(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number,
  options?: { penHungry?: boolean }
): number {
  const def = getLivestockDef(animalType);
  const ticked = tickAnimalInstance(animal, animalType, nowMs);
  if (!isAnimalSellable(ticked, animalType, nowMs)) return 0;
  const growth = growthProgressRatioForAnimal(ticked, animalType, nowMs);
  const growthRate =
    isAnimalProductionReady(ticked, animalType) || growth >= 1 ? 1 : 0.5;
  const happinessMultiplier = 0.5 + clampHappiness(animal.happiness ?? 100) / 200;
  const base = Math.floor(def.animalCost * 10 * growthRate * happinessMultiplier);
  return applyHungrySellDiscount(base, ticked, Boolean(options?.penHungry));
}

export function penHasStockedAnimals(pen: LivestockPenData): boolean {
  return pen.state !== 'unstocked' && penStockCount(pen) > 0;
}

export function isPenAtMaxLevel(pen: LivestockPenData): boolean {
  return (pen.level ?? 1) >= LIVESTOCK_PEN_MAX_LEVEL;
}

export type PenObjectEditAction = 'move' | 'upgrade' | 'feed' | 'sellAll' | 'remove';

export function getPenObjectEditHiddenActions(
  pen: LivestockPenData
): Array<'feed' | 'upgrade' | 'sellAll'> {
  const hidden: Array<'feed' | 'upgrade' | 'sellAll'> = [];
  if (!penHasStockedAnimals(pen)) {
    hidden.push('feed');
    hidden.push('sellAll');
  }
  if (isPenAtMaxLevel(pen)) hidden.push('upgrade');
  return hidden;
}

export function getPenMoveBlockMessage(pen: LivestockPenData): string | null {
  if (pen.state === 'producing') return 'Không di chuyển khi đang sản xuất';
  return null;
}

export function getPenObjectEditDisabledActions(
  pen: LivestockPenData,
  options: {
    upgradeBlocked: boolean;
    canAffordUpgrade: boolean;
    canSellAll: boolean;
  }
): Array<'move' | 'upgrade' | 'sellAll'> {
  const disabled: Array<'move' | 'upgrade' | 'sellAll'> = [];
  if (getPenMoveBlockMessage(pen)) disabled.push('move');
  if (!isPenAtMaxLevel(pen) && (options.upgradeBlocked || !options.canAffordUpgrade)) {
    disabled.push('upgrade');
  }
  if (!options.canSellAll) disabled.push('sellAll');
  return disabled;
}

/** Visible pen popup actions in display order (matches ObjectEditPopup pen mode). */
export function getPenObjectEditVisibleActions(pen: LivestockPenData): PenObjectEditAction[] {
  const hidden = new Set(getPenObjectEditHiddenActions(pen));
  const actions: PenObjectEditAction[] = ['move'];
  if (!hidden.has('upgrade')) actions.push('upgrade');
  if (!hidden.has('feed')) actions.push('feed');
  if (!hidden.has('sellAll')) actions.push('sellAll');
  if (!penHasStockedAnimals(pen)) actions.push('remove');
  return actions;
}

function penAnimalSlotCount(pen: LivestockPenData): number {
  if (pen.state === 'unstocked') return 0;
  if (isRuminantPen(pen)) {
    const occupants = normalizeRuminantOccupants(pen).length;
    return occupants > 0 ? occupants : 0;
  }
  const animals = pen.penAnimals?.length ?? 0;
  if (animals > 0) return animals;
  return Math.max(0, Math.floor(pen.stockCount ?? 0));
}

function tickedAnimalAtSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): { animal: LivestockAnimalLifecycle; animalType: AnimalType } | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const o = normalizeRuminantOccupants(ticked)[slotIndex];
    if (!o) return null;
    return {
      animal: tickAnimalInstance(o, o.animalType, nowMs),
      animalType: o.animalType,
    };
  }
  const prepared = ensureDedicatedPenAnimals(ticked, nowMs);
  const a = prepared.penAnimals?.[slotIndex];
  if (!a) return null;
  return {
    animal: tickAnimalInstance(a, prepared.animalType, nowMs),
    animalType: prepared.animalType,
  };
}

export function isAnimalSellableAtSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): boolean {
  const entry = tickedAnimalAtSlot(pen, slotIndex, nowMs);
  if (!entry) return false;
  return isAnimalSellable(entry.animal, entry.animalType, nowMs);
}

export function canSellAllAnimalsInPen(pen: LivestockPenData, nowMs: number): boolean {
  const count = penAnimalSlotCount(pen);
  if (count <= 0) return false;
  for (let i = 0; i < count; i++) {
    if (!isAnimalSellableAtSlot(pen, i, nowMs)) return false;
  }
  return true;
}

export function livestockSellPriceForPenAnimalAt(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): number {
  const entry = tickedAnimalAtSlot(pen, slotIndex, nowMs);
  if (!entry) return 0;
  if (!isAnimalSellable(entry.animal, entry.animalType, nowMs)) return 0;
  return livestockSellPriceForAnimal(entry.animal, entry.animalType, nowMs, {
    penHungry: false,
  });
}

export function totalSellAllAnimalsPrice(pen: LivestockPenData, nowMs: number): number {
  if (!canSellAllAnimalsInPen(pen, nowMs)) return 0;
  const count = penAnimalSlotCount(pen);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += livestockSellPriceForPenAnimalAt(pen, i, nowMs);
  }
  return total;
}

export function canFeedPenAnimalAt(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): boolean {
  return canFeedAnimalAtSlot(pen, slotIndex, nowMs);
}

/** Per-slot feed when hungry or almost hungry (low satiation). */
export function canFeedAnimalAtSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): boolean {
  const entry = tickedAnimalAtSlot(pen, slotIndex, nowMs);
  if (!entry) return false;
  return isAnimalFeedable(entry.animal, entry.animalType);
}

/** True when the animal in this slot is hungry (ignores pen-level hungry flag). */
export function isAnimalHungryAtSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): boolean {
  const entry = tickedAnimalAtSlot(pen, slotIndex, nowMs);
  return entry?.animal.lifecycleState === 'hungry';
}

/** Feed-button hungry badge for a single-animal edit popup. */
export function shouldShowHungryFeedWarningForSlot(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): boolean {
  return isAnimalHungryAtSlot(pen, slotIndex, nowMs);
}

/** Feed-button hungry badge when tapping the pen (any stocked animal hungry). */
export function shouldShowHungryFeedWarningForPen(
  pen: LivestockPenData,
  nowMs: number
): boolean {
  return tickLivestockPen(pen, nowMs).lifecycleState === 'hungry';
}

export function feedPenAnimalAt(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): LivestockPenData | null {
  if (!canFeedPenAnimalAt(pen, slotIndex, nowMs)) return null;
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const occupants = ticked.ruminantOccupants ?? [];
    const target = occupants[slotIndex];
    if (!target || !isAnimalFeedable(target, target.animalType)) return null;
    const nextOccupants = occupants.map((o, i) =>
      i === slotIndex ? { ...o, ...feedAnimalInstance(o, nowMs) } : o
    );
    return syncPenAggregateFromAnimals({ ...ticked, ruminantOccupants: nextOccupants }, nowMs);
  }
  const animals = ticked.penAnimals ?? [];
  const target = animals[slotIndex];
  if (!target || !isAnimalFeedable(target, ticked.animalType)) return null;
  const nextAnimals = animals.map((a, i) =>
    i === slotIndex ? { ...a, ...feedAnimalInstance(a, nowMs) } : a
  );
  return syncPenAggregateFromAnimals({ ...ticked, penAnimals: nextAnimals }, nowMs);
}

export function removeSoldAnimalFromPenAt(
  pen: LivestockPenData,
  slotIndex: number,
  nowMs: number
): LivestockPenData | null {
  if (!isAnimalSellableAtSlot(pen, slotIndex, nowMs)) return null;
  if (isRuminantPen(pen)) {
    const occupants = normalizeRuminantOccupants(pen);
    if (!occupants[slotIndex]) return null;
    const nextOccupants = occupants.filter((_, i) => i !== slotIndex);
    if (nextOccupants.length === 0) {
      return {
        ...pen,
        animalType: 'sheep',
        stockCount: 0,
        state: 'unstocked',
        ruminantOccupants: [],
        lifecycleState: undefined,
        readyAt: undefined,
      };
    }
    return syncPenAggregateFromAnimals({ ...pen, ruminantOccupants: nextOccupants }, nowMs);
  }
  const prepared = ensureDedicatedPenAnimals(pen, nowMs);
  const animals = prepared.penAnimals ?? [];
  if (!animals[slotIndex]) return null;
  const nextAnimals = animals.filter((_, i) => i !== slotIndex);
  if (nextAnimals.length === 0) {
    return {
      ...prepared,
      penAnimals: [],
      stockCount: 0,
      state: 'unstocked',
      lifecycleState: undefined,
      readyAt: undefined,
    };
  }
  return syncPenAggregateFromAnimals({ ...prepared, penAnimals: nextAnimals }, nowMs);
}

export function sellAllAnimalsFromPen(
  pen: LivestockPenData,
  nowMs: number
): { pen: LivestockPenData; totalPrice: number } | null {
  const totalPrice = totalSellAllAnimalsPrice(pen, nowMs);
  if (totalPrice <= 0) return null;
  let current = tickLivestockPen(pen, nowMs);
  const count = penAnimalSlotCount(current);
  for (let i = count - 1; i >= 0; i--) {
    const next = removeSoldAnimalFromPenAt(current, i, nowMs);
    if (!next) return null;
    current = next;
  }
  return { pen: current, totalPrice };
}

export function livestockSellPrice(pen: LivestockPenData, nowMs: number): number {
  const ticked = tickLivestockPen(pen, nowMs);
  const idx = findSellableAnimalIndex(ticked, nowMs);
  if (idx < 0) return 0;
  const penHungry = ticked.lifecycleState === 'hungry';
  if (isRuminantPen(ticked)) {
    const o = ticked.ruminantOccupants?.[idx];
    if (!o) return 0;
    const tickedAnimal = tickAnimalInstance(o, o.animalType, nowMs);
    return livestockSellPriceForAnimal(tickedAnimal, o.animalType, nowMs, { penHungry });
  }
  const a = ticked.penAnimals?.[idx];
  if (!a) return 0;
  const tickedAnimal = tickAnimalInstance(a, ticked.animalType, nowMs);
  return livestockSellPriceForAnimal(tickedAnimal, ticked.animalType, nowMs, { penHungry });
}

/** Remove one sellable (immature) animal from pen data after a sale. */
export function removeSoldAnimalFromPen(pen: LivestockPenData, nowMs: number): LivestockPenData {
  const idx = findSellableAnimalIndex(pen, nowMs);
  if (idx < 0) return pen;
  if (isRuminantPen(pen)) {
    const occupants = normalizeRuminantOccupants(pen);
    const nextOccupants = occupants.filter((_, i) => i !== idx);
    if (nextOccupants.length === 0) {
      return {
        ...pen,
        animalType: 'sheep',
        stockCount: 0,
        state: 'unstocked',
        ruminantOccupants: [],
        lifecycleState: undefined,
        readyAt: undefined,
      };
    }
    return syncPenAggregateFromAnimals({ ...pen, ruminantOccupants: nextOccupants }, nowMs);
  }
  const prepared = ensureDedicatedPenAnimals(pen, nowMs);
  const nextAnimals = (prepared.penAnimals ?? []).filter((_, i) => i !== idx);
  if (nextAnimals.length === 0) {
    return {
      ...prepared,
      penAnimals: [],
      stockCount: 0,
      state: 'unstocked',
      lifecycleState: undefined,
      readyAt: undefined,
    };
  }
  return syncPenAggregateFromAnimals({ ...prepared, penAnimals: nextAnimals }, nowMs);
}

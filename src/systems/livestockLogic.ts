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
    const snapshots = tickedOccupants.map((ticked) => {
      const def = getLivestockDef(ticked.animalType);
      const ready =
        ticked.lifecycleState === 'producing' &&
        (ticked.productionProgressMs ?? 0) >= def.produceMs;
      return { ticked, ready };
    });
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
  const snapshots = tickedAnimals.map((ticked) => {
    const def = getLivestockDef(pen.animalType);
    const ready =
      ticked.lifecycleState === 'producing' &&
      (ticked.productionProgressMs ?? 0) >= def.produceMs;
    return { ticked, ready };
  });
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

export type LivestockTimerKind = 'ready' | 'grow' | 'produce' | 'hungry';

export interface LivestockTimerInfo {
  kind: LivestockTimerKind;
  /** Satiation bar 0..1 (1 = fed/full, 0 = starving). */
  hungerProgress: number;
  /** Label above bar (maturation/production countdown); empty when hungry. */
  growthTimeText: string;
}

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

function buildLivestockTimerInfo(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): LivestockTimerInfo | null {
  const def = getLivestockDef(animalType);
  const hungerProgress = hungerProgressRatioForAnimal(animal, animalType);

  if (animal.lifecycleState === 'producing' && (animal.productionProgressMs ?? 0) >= def.produceMs) {
    return { kind: 'ready', hungerProgress, growthTimeText: 'Ready' };
  }
  if (animal.lifecycleState === 'hungry') {
    return { kind: 'hungry', hungerProgress: 0, growthTimeText: '' };
  }
  if (animal.lifecycleState === 'baby' || animal.lifecycleState === 'growing') {
    const duration = Math.max(1, animal.growthDurationMs ?? def.growthMs);
    const start = animal.growthStartAt ?? nowMs;
    const remainingSec = Math.max(0, (duration - (nowMs - start)) / 1000);
    return {
      kind: 'grow',
      hungerProgress,
      growthTimeText: formatGrowthTime(remainingSec),
    };
  }
  if (animal.lifecycleState === 'producing') {
    const remainingMs = Math.max(0, def.produceMs - (animal.productionProgressMs ?? 0));
    return {
      kind: 'produce',
      hungerProgress,
      growthTimeText: formatGrowthTime(remainingMs / 1000),
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

/** Direct pen tap stock (non-ruminant species pens only; ruminant uses shop). */
export function canStockAnimal(pen: LivestockPenData): boolean {
  if (isRuminantPen(pen)) return false;
  if (penStockCount(pen) >= penCapacity(pen)) return false;
  const def = getLivestockDef(pen.animalType);
  if (def.houseOnly) return false;
  return speciesHasAnimalSprites(pen.animalType);
}

export function canFeedPen(pen: LivestockPenData): boolean {
  return pen.state !== 'unstocked' && (pen.lifecycleState === 'hungry' || pen.lifecycleState === 'adult');
}

export function canUpgradePen(pen: LivestockPenData): boolean {
  return (pen.level ?? 1) === 1 && pen.state !== 'producing';
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
  if (!canFeedPen(pen)) return null;
  if (isRuminantPen(pen)) {
    const occupants = ensureRuminantOccupantLifecycle(
      pen,
      normalizeRuminantOccupants(pen),
      nowMs
    ).map((o) =>
      o.lifecycleState === 'hungry' ? { ...o, ...feedAnimalInstance(o, nowMs) } : o
    );
    return syncPenAggregateFromAnimals({ ...pen, ruminantOccupants: occupants }, nowMs);
  }
  const prepared = ensureDedicatedPenAnimals(pen, nowMs);
  const animals = (prepared.penAnimals ?? []).map((a) =>
    a.lifecycleState === 'hungry' ? { ...a, ...feedAnimalInstance(a, nowMs) } : a
  );
  return syncPenAggregateFromAnimals({ ...prepared, penAnimals: animals }, nowMs);
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
      const def = getLivestockDef(o.animalType);
      const ready =
        instance.lifecycleState === 'producing' &&
        (instance.productionProgressMs ?? 0) >= def.produceMs;
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
    const def = getLivestockDef(ticked.animalType);
    const ready =
      instance.lifecycleState === 'producing' &&
      (instance.productionProgressMs ?? 0) >= def.produceMs;
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

export function penActionLabel(
  pen: LivestockPenData,
  nowMs: number
): 'stock' | 'feed' | 'collect' | 'wait' | 'upgrade' | 'sell' | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (ticked.state === 'unstocked') return 'stock';
  if (ticked.lifecycleState === 'hungry' || ticked.lifecycleState === 'adult') return 'feed';
  if (ticked.state === 'ready') return 'collect';
  if (ticked.lifecycleState === 'baby' || ticked.lifecycleState === 'growing') return 'sell';
  if (ticked.state === 'producing') return 'wait';
  return null;
}

function findSellableAnimalIndex(pen: LivestockPenData, nowMs: number): number {
  const ticked = tickLivestockPen(pen, nowMs);
  if (isRuminantPen(ticked)) {
    const occupants = ticked.ruminantOccupants ?? [];
    for (let i = occupants.length - 1; i >= 0; i--) {
      const o = occupants[i]!;
      const state = tickAnimalInstance(o, o.animalType, nowMs).lifecycleState;
      if (state === 'baby' || state === 'growing') return i;
    }
    return -1;
  }
  const animals = ticked.penAnimals ?? [];
  for (let i = animals.length - 1; i >= 0; i--) {
    const state = tickAnimalInstance(animals[i]!, ticked.animalType, nowMs).lifecycleState;
    if (state === 'baby' || state === 'growing') return i;
  }
  return -1;
}

export function livestockSellPriceForAnimal(
  animal: LivestockAnimalLifecycle,
  animalType: AnimalType,
  nowMs: number
): number {
  const def = getLivestockDef(animalType);
  const growth = growthProgressRatioForAnimal(animal, animalType, nowMs);
  if (growth < 0.5) return 0;
  const growthRate = growth < 1 ? 0.5 : 1;
  const happinessMultiplier = 0.5 + clampHappiness(animal.happiness ?? 100) / 200;
  return Math.floor(def.sellBasePrice * growthRate * happinessMultiplier);
}

export function livestockSellPrice(pen: LivestockPenData, nowMs: number): number {
  const ticked = tickLivestockPen(pen, nowMs);
  const idx = findSellableAnimalIndex(ticked, nowMs);
  if (idx < 0) return 0;
  if (isRuminantPen(ticked)) {
    const o = ticked.ruminantOccupants?.[idx];
    if (!o) return 0;
    return livestockSellPriceForAnimal(o, o.animalType, nowMs);
  }
  const a = ticked.penAnimals?.[idx];
  if (!a) return 0;
  return livestockSellPriceForAnimal(a, ticked.animalType, nowMs);
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

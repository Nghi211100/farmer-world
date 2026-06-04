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
  type LivestockPenData,
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
  return Math.max(1, Math.floor(pen.stockCount ?? 1));
}

function clampHappiness(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function growthProgressRatio(pen: LivestockPenData, nowMs: number): number {
  const def = getLivestockDef(pen.animalType);
  const start = pen.growthStartAt ?? nowMs;
  const duration = Math.max(1, pen.growthDurationMs ?? def.growthMs);
  return Math.max(0, Math.min(1, (nowMs - start) / duration));
}

/** Offline-capable lifecycle tick for baby/growing/adult/producing/hungry. */
export function tickLivestockPen(
  pen: LivestockPenData,
  nowMs: number
): LivestockPenData {
  if (pen.state === 'unstocked') return pen;
  const def = getLivestockDef(pen.animalType);
  const lastUpdatedAt = pen.lastUpdatedAt ?? pen.growthStartAt ?? nowMs;
  const elapsed = Math.max(0, nowMs - lastUpdatedAt);
  const happiness = clampHappiness(pen.happiness ?? 100);
  let lifecycleState: AnimalLifecycleState = pen.lifecycleState ?? 'baby';
  let productionProgressMs = pen.productionProgressMs ?? 0;
  let hungrySince = pen.hungrySince;
  let hungerSinceFeedMs = pen.hungerSinceFeedMs ?? 0;
  let nextHappiness = happiness;

  const growthRatio = growthProgressRatio(pen, nowMs);
  if (lifecycleState === 'baby' || lifecycleState === 'growing') {
    lifecycleState = growthRatio >= 1 ? 'adult' : growthRatio >= 0.5 ? 'growing' : 'baby';
  }
  if (lifecycleState === 'adult') {
    lifecycleState = 'producing';
  }

  if (lifecycleState === 'hungry') {
    const hungryMs = Math.max(0, nowMs - (hungrySince ?? nowMs));
    if (hungryMs > 120 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.5);
    else if (hungryMs > 60 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.75);
    else if (hungryMs > 30 * 60 * 1000) nextHappiness = clampHappiness(happiness * 0.9);
  } else if (lifecycleState === 'producing') {
    const speedMultiplier = 0.5 + happiness / 200;
    productionProgressMs += elapsed * speedMultiplier;
    hungerSinceFeedMs += elapsed;
    if (hungerSinceFeedMs >= def.hungryAfterMs) {
      lifecycleState = 'hungry';
      hungrySince = nowMs;
    }
  }

  const isReady = lifecycleState === 'producing' && productionProgressMs >= def.produceMs;
  return {
    ...pen,
    lifecycleState,
    happiness: nextHappiness,
    productionProgressMs,
    hungerSinceFeedMs,
    hungrySince,
    state: isReady ? 'ready' : lifecycleState === 'hungry' ? 'idle' : 'producing',
    readyAt: isReady ? nowMs : undefined,
    lastUpdatedAt: nowMs,
  };
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

export function feedPen(pen: LivestockPenData, nowMs: number): LivestockPenData | null {
  if (!canFeedPen(pen)) return null;
  return {
    ...pen,
    state: 'producing',
    lifecycleState: 'producing',
    readyAt: undefined,
    hungrySince: undefined,
    hungerSinceFeedMs: 0,
    lastUpdatedAt: nowMs,
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
  const quantityMultiplier = 0.5 + clampHappiness(ticked.happiness ?? 100) / 200;
  return {
    pen: {
      ...ticked,
      state: 'producing',
      lifecycleState: 'producing',
      readyAt: undefined,
      productionProgressMs: 0,
      lastUpdatedAt: nowMs,
    },
    productItemId: def.productItemId,
    qty: Math.max(1, Math.floor(penStockCount(ticked) * quantityMultiplier)),
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
  const now = Date.now();
  const def = getLivestockDef(animalType);
  if (isRuminantPen(pen) && isRuminantSpecies(animalType)) {
    const nextOccupants = [
      ...normalizeRuminantOccupants(pen),
      { animalType, stage, variant, animalTextureKey } satisfies RuminantOccupantData,
    ].sort((a, b) => (a.animalType === b.animalType ? 0 : a.animalType === 'goat' ? -1 : 1));
    const primary = nextOccupants[0] ?? null;
    if (!primary) return null;
    return {
      ...pen,
      animalType: primary.animalType,
      state: 'idle',
      readyAt: undefined,
      stage: primary.stage,
      variant: primary.variant,
      animalTextureKey: primary.animalTextureKey,
      stockCount: nextOccupants.length,
      ruminantOccupants: nextOccupants,
      lifecycleState: 'baby',
      growthStartAt: now,
      growthDurationMs: getLivestockDef(primary.animalType).growthMs,
      productionProgressMs: 0,
      hungerSinceFeedMs: 0,
      happiness: 100,
      lastUpdatedAt: now,
    };
  }
  return {
    ...pen,
    animalType,
    state: 'idle',
    readyAt: undefined,
    stage,
    variant,
    animalTextureKey,
    stockCount: penStockCount(pen) + 1,
    lifecycleState: 'baby',
    growthStartAt: now,
    growthDurationMs: def.growthMs,
    productionProgressMs: 0,
    hungerSinceFeedMs: 0,
    happiness: 100,
    lastUpdatedAt: now,
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
    .map((p, i) => ({
      ...p,
      id: p.id || `pen-${p.penKind === 'ruminant' ? 'ruminant' : p.animalType}-${i + 1}`,
      level: (p.level ?? 1) as LivestockPenLevel,
      lifecycleState:
        p.state === 'unstocked' ? p.lifecycleState : (p.lifecycleState ?? 'baby'),
      growthStartAt: p.growthStartAt ?? now,
      growthDurationMs: p.growthDurationMs ?? getLivestockDef(p.animalType).growthMs,
      productionProgressMs: p.productionProgressMs ?? 0,
      hungerSinceFeedMs: p.hungerSinceFeedMs ?? 0,
      happiness: clampHappiness(p.happiness ?? 100),
      lastUpdatedAt: p.lastUpdatedAt ?? now,
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
): 'stock' | 'feed' | 'collect' | 'wait' | 'upgrade' | 'sell' | null {
  const ticked = tickLivestockPen(pen, nowMs);
  if (ticked.state === 'unstocked') return 'stock';
  if (ticked.lifecycleState === 'hungry' || ticked.lifecycleState === 'adult') return 'feed';
  if (ticked.state === 'ready') return 'collect';
  if (ticked.lifecycleState === 'baby' || ticked.lifecycleState === 'growing') return 'sell';
  if (ticked.state === 'producing') return 'wait';
  return null;
}

export function livestockSellPrice(pen: LivestockPenData, nowMs: number): number {
  const def = getLivestockDef(pen.animalType);
  const growth = growthProgressRatio(pen, nowMs);
  if (growth < 0.5) return 0;
  const growthRate = growth < 1 ? 0.5 : 1;
  const happinessMultiplier = 0.5 + clampHappiness(pen.happiness ?? 100) / 200;
  return Math.floor(def.sellBasePrice * growthRate * happinessMultiplier);
}

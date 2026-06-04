import { describe, expect, it } from 'vitest';
import { formatGrowthTime } from '../../src/utils/iso';
import {
  canSellAllAnimalsInPen,
  collectFromPen,
  createNewPen,
  createRuminantPen,
  feedPen,
  feedPenAnimalAt,
  canFeedAnimalAtSlot,
  isAnimalFeedable,
  growthProgressRatio,
  isAnimalHungryAtSlot,
  shouldShowHungryFeedWarningForPen,
  shouldShowHungryFeedWarningForSlot,
  isAnimalSellableAtSlot,
  livestockSellPrice,
  livestockSellPriceForAnimal,
  livestockSellPriceForPenAnimalAt,
  getPenObjectEditHiddenActions,
  getPenObjectEditVisibleActions,
  isPenAtMaxLevel,
  penHasStockedAnimals,
  sellAllAnimalsFromPen,
  stockPenWithAnimal,
  tickLivestockPen,
  tickAllLivestockPens,
  getLivestockTimerInfo,
  getLivestockTimerInfoForAnimal,
  getLivestockTimerInfoForSlot,
  isAnimalProductionReady,
  isAnimalSellable,
  tickAnimalInstance,
} from '../../src/systems/livestockLogic';
import {
  getLivestockDef,
  LIVESTOCK_PEN_MAX_LEVEL,
  livestockPenCapacity,
} from '../../src/config/LivestockConfig';
import { ITEM_IDS } from '../../src/config/items';

describe('livestockLogic', () => {
  it('growthMs is 10× baseline maturation; hungryAfterMs is 3× hunger window', () => {
    expect(getLivestockDef('goat').growthMs).toBe(400_000);
    expect(getLivestockDef('chicken').growthMs).toBe(300_000);
    expect(getLivestockDef('cow').growthMs).toBe(550_000);
    expect(getLivestockDef('cow').hungryAfterMs).toBe(825_000);
    expect(getLivestockDef('pig').hungryAfterMs).toBe(675_000);
    expect(getLivestockDef('chicken').hungryAfterMs).toBe(450_000);
    expect(getLivestockDef('duck').hungryAfterMs).toBe(480_000);
  });

  it('follows lifecycle baby -> growing -> adult/producing', () => {
    let pen = createNewPen('p1', 'chicken', 3, 4);
    const stocked = stockPenWithAnimal(pen, 'chicken', () => 0);
    expect(stocked?.lifecycleState).toBe('baby');
    pen = stocked!;
    const start = pen.growthStartAt!;
    const half = tickLivestockPen(pen, start + Math.floor((pen.growthDurationMs ?? 0) * 0.6));
    expect(half.lifecycleState).toBe('growing');
    const done = tickLivestockPen(pen, start + (pen.growthDurationMs ?? 0) + 1);
    expect(done.lifecycleState).toBe('producing');
  });

  it('enters hungry after hungryAfterMs since last feed', () => {
    let pen = stockPenWithAnimal(createNewPen('p2b', 'duck', 1, 1), 'duck', () => 0)!;
    const start = pen.growthStartAt!;
    pen = tickLivestockPen(pen, start + (pen.growthDurationMs ?? 0) + 1);
    const hungryAfter = getLivestockDef('duck').hungryAfterMs;
    const hungry = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + hungryAfter + 1);
    expect(hungry.lifecycleState).toBe('hungry');
  });

  it('getLivestockTimerInfo shows growth countdown and hides hunger timer', () => {
    const chickenDef = getLivestockDef('chicken');
    const chickenHungryAfter = chickenDef.hungryAfterMs;
    let pen = stockPenWithAnimal(createNewPen('t1', 'chicken', 0, 0), 'chicken', () => 0)!;
    const growNow = pen.growthStartAt! + 1;
    const growInfo = getLivestockTimerInfo(tickLivestockPen(pen, growNow), growNow);
    expect(growInfo?.kind).toBe('grow');
    expect(growInfo?.hungerProgress).toBe(1);
    expect(growInfo?.barProgress).toBe(1);
    const growDurationMs = pen.penAnimals?.[0]?.growthDurationMs ?? chickenDef.growthMs;
    expect(growInfo?.growthTimeText).toBe(
      formatGrowthTime((growDurationMs - (growNow - pen.growthStartAt!)) / 1000)
    );
    expect(growInfo?.growthTimeText).not.toBe(formatGrowthTime(chickenHungryAfter / 1000));

    pen = tickLivestockPen(pen, pen.growthStartAt! + (pen.growthDurationMs ?? 0) + 1);
    const animal = pen.penAnimals?.[0];
    const producing = {
      ...pen,
      lifecycleState: 'producing' as const,
      state: 'producing' as const,
      penAnimals: animal
        ? [
            {
              ...animal,
              lifecycleState: 'producing' as const,
              growthStartAt: 1_000_000,
              productionProgressMs: 1000,
              hungerSinceFeedMs: 50_000,
              lastUpdatedAt: 1_100_000,
            },
          ]
        : pen.penAnimals,
      productionProgressMs: 1000,
      hungerSinceFeedMs: 50_000,
      lastUpdatedAt: 1_100_000,
    };
    const produceInfo = getLivestockTimerInfo(
      tickLivestockPen(producing, 1_100_001),
      1_100_001
    );
    expect(produceInfo?.kind).toBe('produce');
    expect(produceInfo?.growthTimeText).toBe('');
    expect(produceInfo?.barProgress).toBeCloseTo(1 - 50_000 / chickenHungryAfter, 5);
    expect(produceInfo?.hungerProgress).toBe(produceInfo?.barProgress);

    const hungryAnimal = pen.penAnimals?.[0];
    const hungryNotReadyPen = {
      ...pen,
      lifecycleState: 'hungry' as const,
      state: 'idle' as const,
      penAnimals: hungryAnimal
        ? [
            {
              ...hungryAnimal,
              lifecycleState: 'hungry' as const,
              productionProgressMs: 1000,
              hungerSinceFeedMs: chickenHungryAfter,
              hungrySince: 1_150_000,
              lastUpdatedAt: 1_150_000,
            },
          ]
        : pen.penAnimals,
      lastUpdatedAt: 1_150_000,
    };
    const hungryInfo = getLivestockTimerInfo(hungryNotReadyPen, 1_150_001);
    expect(hungryInfo?.kind).toBe('hungry');
    expect(hungryInfo?.hungerProgress).toBe(0);
    expect(hungryInfo?.barProgress).toBe(0);
    expect(hungryInfo?.growthTimeText).toBe('');

    const produceMs = getLivestockDef('chicken').produceMs;
    const readyAnimal = producing.penAnimals?.[0]
      ? { ...producing.penAnimals[0], productionProgressMs: produceMs, lastUpdatedAt: 1_200_000 }
      : undefined;
    const readyPen = {
      ...producing,
      state: 'ready' as const,
      lifecycleState: 'producing' as const,
      penAnimals: readyAnimal ? [readyAnimal] : producing.penAnimals,
      productionProgressMs: produceMs,
      lastUpdatedAt: 1_200_000,
    };
    const readyInfo = getLivestockTimerInfo(
      tickLivestockPen(readyPen, 1_200_001),
      1_200_001
    );
    expect(readyInfo?.kind).toBe('ready');
    expect(readyInfo?.growthTimeText).toBe('Ready');
    expect(readyInfo?.barProgress).toBeCloseTo(1 - 50_000 / chickenHungryAfter, 5);
    expect(readyInfo?.hungerProgress).toBe(readyInfo?.barProgress);
  });

  it('shows Ready overlay when hungry but production is complete', () => {
    const t0 = 4_000_000;
    let pen = stockPenWithAnimal(createNewPen('pig-ready-hungry', 'pig', 3, 3), 'pig', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? getLivestockDef('pig').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const produceMs = getLivestockDef('pig').produceMs;
    const hungryAfter = getLivestockDef('pig').hungryAfterMs;
    pen = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + hungryAfter + produceMs + 1);
    expect(pen.lifecycleState).toBe('hungry');
    const animal = pen.penAnimals![0]!;
    expect(isAnimalProductionReady(animal, 'pig')).toBe(true);
    const info = getLivestockTimerInfo(pen, (pen.lastUpdatedAt ?? 0) + 1);
    expect(info?.kind).toBe('ready');
    expect(info?.growthTimeText).toBe('Ready');
    expect(info?.hungerProgress).toBe(0);
    expect(pen.state).toBe('ready');
  });

  it('collects from hungry pen when production is complete', () => {
    const t0 = 5_000_000;
    let pen = stockPenWithAnimal(createNewPen('pig-collect-hungry', 'pig', 4, 4), 'pig', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? getLivestockDef('pig').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const produceMs = getLivestockDef('pig').produceMs;
    const hungryAfter = getLivestockDef('pig').hungryAfterMs;
    pen = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + hungryAfter + produceMs + 1);
    const out = collectFromPen(pen, (pen.lastUpdatedAt ?? 0) + 1);
    expect(out?.productItemId).toBe(ITEM_IDS.PORK);
  });

  it('hungry pauses production and feeding resumes', () => {
    let pen = stockPenWithAnimal(createNewPen('p2', 'duck', 1, 1), 'duck', () => 0)!;
    const start = pen.growthStartAt!;
    pen = tickLivestockPen(pen, start + (pen.growthDurationMs ?? 0) + 1);
    const hungryAfter = getLivestockDef('duck').hungryAfterMs;
    const hungry = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + hungryAfter + 1);
    expect(hungry.lifecycleState).toBe('hungry');
    const fed = feedPen(hungry, hungry.lastUpdatedAt! + 1);
    expect(fed?.lifecycleState).toBe('producing');
  });

  it('feeding at 90% hunger depletion resets satiation bar not production timer', () => {
    const def = getLivestockDef('pig');
    const t0 = 10_000_000;
    let pen = stockPenWithAnimal(createNewPen('feed-90', 'pig', 2, 2), 'pig', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? def.growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const almostAt = (pen.lastUpdatedAt ?? 0) + 5_000;
    const baseAnimal = pen.penAnimals![0]!;
    pen = {
      ...pen,
      penAnimals: [
        {
          ...baseAnimal,
          lifecycleState: 'producing' as const,
          productionProgressMs: 5_000,
          hungerSinceFeedMs: Math.floor(def.hungryAfterMs * 0.9),
          lastUpdatedAt: almostAt,
        },
      ],
      productionProgressMs: 5_000,
      hungerSinceFeedMs: Math.floor(def.hungryAfterMs * 0.9),
      lastUpdatedAt: almostAt,
    };
    expect(isAnimalFeedable(pen.penAnimals![0]!, 'pig')).toBe(true);
    expect(canFeedAnimalAtSlot(pen, 0, almostAt + 1)).toBe(true);

    const feedAt = almostAt + 2;
    const fed = feedPenAnimalAt(pen, 0, feedAt);
    expect(fed).not.toBeNull();
    const info = getLivestockTimerInfoForSlot(tickLivestockPen(fed!, feedAt + 1), 0, feedAt + 1);
    expect(info?.growthTimeText).toBe('');
    expect(info?.kind).toBe('produce');
    expect(info?.hungerProgress).toBeCloseTo(1, 5);
  });

  it('at 40% satiation uses hunger bar not production and cannot feed yet', () => {
    const def = getLivestockDef('pig');
    const t0 = 11_000_000;
    let pen = stockPenWithAnimal(createNewPen('feed-40', 'pig', 2, 2), 'pig', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? def.growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const at = (pen.lastUpdatedAt ?? 0) + 5_000;
    const hungerMs = Math.floor(def.hungryAfterMs * 0.6);
    const animal = {
      ...pen.penAnimals![0]!,
      lifecycleState: 'producing' as const,
      productionProgressMs: 5_000,
      hungerSinceFeedMs: hungerMs,
      lastUpdatedAt: at,
    };
    pen = { ...pen, penAnimals: [animal], hungerSinceFeedMs: hungerMs, lastUpdatedAt: at };
    expect(isAnimalFeedable(animal, 'pig')).toBe(false);
    expect(canFeedAnimalAtSlot(pen, 0, at + 1)).toBe(false);
    const info = getLivestockTimerInfoForSlot(tickLivestockPen(pen, at + 1), 0, at + 1);
    expect(info?.kind).toBe('produce');
    expect(info?.growthTimeText).toBe('');
    expect(info?.hungerProgress).toBeCloseTo(0.4, 2);
  });

  it('pig satiation at ~25% bar reflects hunger progress without countdown label', () => {
    const def = getLivestockDef('pig');
    const t0 = 12_000_000;
    let pen = stockPenWithAnimal(createNewPen('pig-168', 'pig', 2, 2), 'pig', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? def.growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const at = (pen.lastUpdatedAt ?? 0) + 5_000;
    const hungerMs = def.hungryAfterMs - 168_000;
    pen = {
      ...pen,
      penAnimals: [
        {
          ...pen.penAnimals![0]!,
          lifecycleState: 'producing' as const,
          productionProgressMs: 0,
          hungerSinceFeedMs: hungerMs,
          lastUpdatedAt: at,
        },
      ],
      hungerSinceFeedMs: hungerMs,
      lastUpdatedAt: at,
    };
    const info = getLivestockTimerInfoForSlot(tickLivestockPen(pen, at + 1), 0, at + 1);
    expect(info?.growthTimeText).toBe('');
    expect(info?.hungerProgress).toBeCloseTo(0.25, 2);
  });

  it('production output uses species product', () => {
    const t0 = 2_000_000;
    let pen = stockPenWithAnimal(createNewPen('c1', 'cow', 1, 1), 'cow', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? getLivestockDef('cow').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const produceMs = getLivestockDef('cow').produceMs;
    const readyAnimal = {
      ...pen.penAnimals![0]!,
      lifecycleState: 'producing' as const,
      productionProgressMs: produceMs,
      lastUpdatedAt: t0 + growMs + 2,
    };
    const ready = {
      ...pen,
      state: 'ready' as const,
      penAnimals: [readyAnimal],
      productionProgressMs: produceMs,
      lastUpdatedAt: readyAnimal.lastUpdatedAt,
    };
    const out = collectFromPen(ready, readyAnimal.lastUpdatedAt! + 1);
    expect(out?.productItemId).toBe(ITEM_IDS.MILK);
  });

  it('sell price base is 10× animal purchase cost', () => {
    const pen = stockPenWithAnimal(createNewPen('cost10', 'pig', 2, 2), 'pig', () => 0)!;
    const animal = pen.penAnimals![0]!;
    const def = getLivestockDef('pig');
    const start = animal.growthStartAt!;
    const duration = animal.growthDurationMs ?? def.growthMs;
    const atHalf = start + Math.floor(duration * 0.5);
    const price = livestockSellPriceForAnimal(animal, 'pig', atHalf);
    const happinessMultiplier = 0.5 + 100 / 200;
    expect(price).toBe(Math.floor(def.animalCost * 10 * 0.5 * happinessMultiplier));
  });

  it('hungry sell price is 95% of normal at same growth and happiness', () => {
    const pen = stockPenWithAnimal(createNewPen('hungry-sell', 'pig', 2, 2), 'pig', () => 0)!;
    const animal = pen.penAnimals![0]!;
    const start = animal.growthStartAt!;
    const duration = animal.growthDurationMs ?? getLivestockDef('pig').growthMs;
    const now = start + Math.floor(duration * 0.6);
    const normal = livestockSellPriceForAnimal(animal, 'pig', now);
    const hungryAnimal = {
      ...animal,
      lifecycleState: 'hungry' as const,
      hungrySince: now,
      lastUpdatedAt: now,
    };
    const hungry = livestockSellPriceForAnimal(hungryAnimal, 'pig', now);
    expect(normal).toBeGreaterThan(0);
    expect(hungry).toBe(Math.floor(normal * 0.95));
  });

  it('hungry pen applies 5% sell discount to immature animals', () => {
    const t0 = 3_000_000;
    let pen = stockPenWithAnimal(createNewPen('h2', 'chicken', 0, 0), 'chicken', () => 0, t0)!;
    const growMs = pen.penAnimals![0]!.growthDurationMs ?? getLivestockDef('chicken').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    pen = tickLivestockPen(
      pen,
      (pen.lastUpdatedAt ?? 0) + getLivestockDef('chicken').hungryAfterMs + 1
    );
    expect(pen.lifecycleState).toBe('hungry');
    const t1 = (pen.lastUpdatedAt ?? 0) + 1;
    pen = stockPenWithAnimal(pen, 'chicken', () => 0, t1)!;
    expect(pen.lifecycleState).toBe('hungry');
    const immature = pen.penAnimals!.find((a) => a.lifecycleState === 'baby')!;
    const atHalf = t1 + Math.floor((immature.growthDurationMs ?? growMs) * 0.55);
    const withoutHungryPen = livestockSellPriceForAnimal(immature, 'chicken', atHalf);
    const withHungryPen = livestockSellPrice(pen, atHalf);
    expect(withoutHungryPen).toBeGreaterThan(0);
    expect(withHungryPen).toBe(Math.floor(withoutHungryPen * 0.95));
  });

  it('early sell thresholds enforce 50% growth gate', () => {
    const pen = stockPenWithAnimal(createNewPen('s1', 'pig', 2, 2), 'pig', () => 0)!;
    const animal = pen.penAnimals![0]!;
    const start = animal.growthStartAt!;
    const duration = animal.growthDurationMs ?? getLivestockDef('pig').growthMs;
    const tooEarly = livestockSellPriceForAnimal(
      animal,
      'pig',
      start + Math.floor(duration * 0.49)
    );
    const half = livestockSellPriceForAnimal(animal, 'pig', start + Math.floor(duration * 0.5));
    const full = livestockSellPriceForAnimal(animal, 'pig', start + duration + 1);
    expect(tooEarly).toBe(0);
    expect(half).toBeGreaterThan(0);
    expect(full).toBeGreaterThanOrEqual(half);
  });

  it('happiness decreases under prolonged hunger', () => {
    let pen = stockPenWithAnimal(createNewPen('h1', 'sheep', 0, 0), 'sheep', () => 0)!;
    const hungryAnimal = {
      ...pen.penAnimals![0]!,
      lifecycleState: 'hungry' as const,
      hungrySince: 0,
      lastUpdatedAt: 0,
      happiness: 100,
    };
    pen = { ...pen, penAnimals: [hungryAnimal], lifecycleState: 'hungry', hungrySince: 0, lastUpdatedAt: 0 };
    const ticked = tickLivestockPen(pen, 250 * 60 * 1000);
    expect(ticked.penAnimals?.[0]?.happiness).toBeLessThanOrEqual(50);
  });

  it('offline tick advances all pens', () => {
    const pen = stockPenWithAnimal(createNewPen('o1', 'fish', 0, 0), 'fish', () => 0)!;
    const updated = tickAllLivestockPens([pen], pen.growthStartAt! + (pen.growthDurationMs ?? 0) + 1)[0]!;
    expect(updated.lifecycleState).toBe('producing');
  });

  it('sell-all allows three harvest-ready hungry animals in ruminant pen', () => {
    const t0 = 7_000_000;
    let pen = createRuminantPen('rum-all-hungry', 0, 0);
    pen = stockPenWithAnimal(pen, 'sheep', () => 0, t0)!;
    pen = stockPenWithAnimal(pen, 'sheep', () => 0, t0)!;
    pen = stockPenWithAnimal(pen, 'goat', () => 0, t0)!;
    const growMs = getLivestockDef('sheep').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const produceMs = getLivestockDef('sheep').produceMs;
    const hungryAfter = getLivestockDef('sheep').hungryAfterMs;
    const now = (pen.lastUpdatedAt ?? 0) + hungryAfter + produceMs + 1;
    pen = tickLivestockPen(pen, now);
    expect(pen.state).toBe('ready');
    expect(pen.ruminantOccupants?.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      const o = pen.ruminantOccupants![i]!;
      const ticked = tickAnimalInstance(o, o.animalType, now);
      expect(ticked.lifecycleState).toBe('hungry');
      expect(isAnimalProductionReady(ticked, o.animalType)).toBe(true);
      expect(getLivestockTimerInfoForSlot(pen, i, now)?.growthTimeText).toBe('Ready');
      expect(isAnimalSellable(ticked, o.animalType, now)).toBe(true);
    }
    expect(canSellAllAnimalsInPen(pen, now)).toBe(true);
    const sold = sellAllAnimalsFromPen(pen, now);
    expect(sold?.totalPrice).toBeGreaterThan(0);
    expect(sold?.pen.state).toBe('unstocked');
  });

  it('sell-all allows harvest-ready producing animals (Ready overlay, not hungry)', () => {
    const t0 = 8_000_000;
    let pen = createRuminantPen('rum-all-producing', 1, 1);
    pen = stockPenWithAnimal(pen, 'sheep', () => 0, t0)!;
    pen = stockPenWithAnimal(pen, 'sheep', () => 0, t0)!;
    const growMs = getLivestockDef('sheep').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const produceMs = getLivestockDef('sheep').produceMs;
    const now = (pen.lastUpdatedAt ?? 0) + produceMs + 1;
    pen = tickLivestockPen(pen, now);
    expect(pen.state).toBe('ready');
    for (const o of pen.ruminantOccupants ?? []) {
      const ticked = tickAnimalInstance(o, o.animalType, now);
      expect(ticked.lifecycleState).toBe('producing');
      expect(isAnimalProductionReady(ticked, o.animalType)).toBe(true);
      expect(getLivestockTimerInfoForSlot(pen, 0, now)?.growthTimeText).toBe('Ready');
      expect(isAnimalSellable(ticked, o.animalType, now)).toBe(true);
    }
    expect(canSellAllAnimalsInPen(pen, now)).toBe(true);
    expect(sellAllAnimalsFromPen(pen, now)?.totalPrice).toBeGreaterThan(0);
  });

  it('sell-all requires every stocked animal to be sellable', () => {
    const pen = stockPenWithAnimal(createNewPen('all-sell', 'chicken', 0, 0), 'chicken', () => 0)!;
    const animal = pen.penAnimals![0]!;
    const start = animal.growthStartAt!;
    const duration = animal.growthDurationMs ?? getLivestockDef('chicken').growthMs;
    const tooEarly = start + Math.floor(duration * 0.49);
    expect(isAnimalSellableAtSlot(pen, 0, tooEarly)).toBe(false);
    expect(canSellAllAnimalsInPen(pen, tooEarly)).toBe(false);
    const atHalf = start + Math.floor(duration * 0.5);
    expect(canSellAllAnimalsInPen(pen, atHalf)).toBe(true);
    const sold = sellAllAnimalsFromPen(pen, atHalf);
    expect(sold?.totalPrice).toBeGreaterThan(0);
    expect(sold?.pen.state).toBe('unstocked');
  });

  it('penHasStockedAnimals is false for empty pens', () => {
    const empty = createNewPen('empty', 'cow', 1, 1);
    expect(penHasStockedAnimals(empty)).toBe(false);
    const stocked = stockPenWithAnimal(empty, 'cow', () => 0)!;
    expect(penHasStockedAnimals(stocked)).toBe(true);
  });

  it('pen object-edit popup omits feed and sellAll when empty and upgrade at max level', () => {
    const empty = createNewPen('empty-popup', 'chicken', 0, 0);
    expect(getPenObjectEditHiddenActions(empty)).toEqual(['feed', 'sellAll']);
    expect(getPenObjectEditVisibleActions(empty)).toEqual(['move', 'upgrade', 'remove']);

    const stocked = stockPenWithAnimal(
      createNewPen('stocked-popup', 'chicken', 1, 1),
      'chicken',
      () => 0
    )!;
    expect(getPenObjectEditHiddenActions(stocked)).toEqual([]);
    expect(getPenObjectEditVisibleActions(stocked)).toEqual(['move', 'upgrade', 'feed', 'sellAll']);

    const maxPen = { ...stocked, level: LIVESTOCK_PEN_MAX_LEVEL };
    expect(isPenAtMaxLevel(maxPen)).toBe(true);
    expect(getPenObjectEditHiddenActions(maxPen)).toEqual(['upgrade']);
    expect(getPenObjectEditVisibleActions(maxPen)).toEqual(['move', 'feed', 'sellAll']);
  });

  it('livestockSellPriceForPenAnimalAt matches per-slot sell rules', () => {
    const pen = stockPenWithAnimal(createNewPen('slot-sell', 'pig', 2, 2), 'pig', () => 0)!;
    const animal = pen.penAnimals![0]!;
    const start = animal.growthStartAt!;
    const duration = animal.growthDurationMs ?? getLivestockDef('pig').growthMs;
    const atHalf = start + Math.floor(duration * 0.5);
    expect(livestockSellPriceForPenAnimalAt(pen, 0, atHalf)).toBe(
      livestockSellPriceForAnimal(animal, 'pig', atHalf)
    );
  });

  it('per-slot hungry warning when only one animal in a hungry pen is hungry', () => {
    const t0 = 9_000_000;
    let pen = stockPenWithAnimal(createNewPen('mix-hungry', 'duck', 0, 0), 'duck', () => 0, t0)!;
    const growMs = getLivestockDef('duck').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    const t1 = t0 + growMs + 1_000;
    pen = stockPenWithAnimal(pen, 'duck', () => 0, t1)!;
    pen = tickLivestockPen(pen, t1 + growMs + 1);
    const hungryAfter = getLivestockDef('duck').hungryAfterMs;
    const now = t0 + growMs + hungryAfter + 2;
    pen = tickLivestockPen(pen, now);
    expect(pen.lifecycleState).toBe('hungry');
    expect(pen.penAnimals?.[0]?.lifecycleState).toBe('hungry');
    expect(pen.penAnimals?.[1]?.lifecycleState).toBe('producing');
    expect(getLivestockTimerInfoForSlot(pen, 1, now)?.growthTimeText).toBe('Ready');
    expect(shouldShowHungryFeedWarningForPen(pen, now)).toBe(true);
    expect(shouldShowHungryFeedWarningForSlot(pen, 0, now)).toBe(true);
    expect(shouldShowHungryFeedWarningForSlot(pen, 1, now)).toBe(false);
    expect(isAnimalHungryAtSlot(pen, 1, now)).toBe(false);
    expect(canFeedAnimalAtSlot(pen, 0, now)).toBe(true);
    expect(canFeedAnimalAtSlot(pen, 1, now)).toBe(false);
  });

  it('feedPenAnimalAt feeds only the targeted slot', () => {
    let pen = stockPenWithAnimal(createNewPen('feed-slot', 'duck', 1, 1), 'duck', () => 0)!;
    const start = pen.growthStartAt!;
    pen = tickLivestockPen(pen, start + (pen.growthDurationMs ?? 0) + 1);
    const hungryAfter = getLivestockDef('duck').hungryAfterMs;
    pen = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + hungryAfter + 1);
    expect(pen.penAnimals?.[0]?.lifecycleState).toBe('hungry');
    const fed = feedPenAnimalAt(pen, 0, (pen.lastUpdatedAt ?? 0) + 1);
    expect(fed?.penAnimals?.[0]?.lifecycleState).toBe('producing');
  });

  it('preserves global capacity by level (lv1=4, lv2=8)', () => {
    expect(livestockPenCapacity(1)).toBe(4);
    expect(livestockPenCapacity(2)).toBe(8);
  });

  it('each stocked animal keeps independent growth timers', () => {
    const t0 = 1_000_000;
    let pen = stockPenWithAnimal(createNewPen('multi', 'chicken', 0, 0), 'chicken', () => 0, t0)!;
    const first = pen.penAnimals![0]!;
    const growMs = first.growthDurationMs ?? getLivestockDef('chicken').growthMs;
    pen = tickLivestockPen(pen, t0 + growMs + 1);
    expect(pen.penAnimals![0]?.lifecycleState).toBe('producing');

    const t1 = t0 + growMs + 2_000;
    pen = stockPenWithAnimal(pen, 'chicken', () => 0, t1)!;
    expect(pen.penAnimals?.length).toBe(2);
    const second = pen.penAnimals![1]!;
    expect(second.growthStartAt).toBe(t1);
    expect(second.lifecycleState).toBe('baby');

    const infoFirst = getLivestockTimerInfoForAnimal(pen.penAnimals![0]!, 'chicken', t1);
    const infoSecond = getLivestockTimerInfoForAnimal(second, 'chicken', t1);
    expect(infoFirst?.kind).toBe('produce');
    expect(infoSecond?.kind).toBe('grow');
    expect(infoFirst?.growthTimeText).toBe('');
    expect(infoSecond?.growthTimeText).toBe(formatGrowthTime(growMs / 1000));
    expect(infoFirst?.barProgress).toBe(infoFirst?.hungerProgress);
    expect(infoSecond?.barProgress).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  collectFromPen,
  createNewPen,
  createRuminantPen,
  feedPen,
  growthProgressRatio,
  livestockSellPrice,
  stockPenWithAnimal,
  tickLivestockPen,
  tickAllLivestockPens,
  getLivestockTimerInfo,
} from '../../src/systems/livestockLogic';
import { getLivestockDef, livestockPenCapacity } from '../../src/config/LivestockConfig';
import { ITEM_IDS } from '../../src/config/items';

describe('livestockLogic', () => {
  it('hungryAfterMs is at least ~5× growthMs per species', () => {
    for (const type of ['cow', 'pig', 'chicken', 'fish', 'goat', 'duck', 'sheep'] as const) {
      const def = getLivestockDef(type);
      expect(def.hungryAfterMs).toBeGreaterThanOrEqual(def.growthMs * 5);
    }
    expect(getLivestockDef('cow').hungryAfterMs).toBe(275_000);
    expect(getLivestockDef('chicken').hungryAfterMs).toBe(150_000);
    expect(getLivestockDef('duck').hungryAfterMs).toBe(160_000);
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

  it('getLivestockTimerInfo uses hunger bar and maturation/production labels', () => {
    let pen = stockPenWithAnimal(createNewPen('t1', 'chicken', 0, 0), 'chicken', () => 0)!;
    const growInfo = getLivestockTimerInfo(pen, pen.growthStartAt! + 1);
    expect(growInfo?.kind).toBe('grow');
    expect(growInfo?.hungerProgress).toBe(1);
    expect(growInfo?.growthTimeText).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    pen = tickLivestockPen(pen, pen.growthStartAt! + (pen.growthDurationMs ?? 0) + 1);
    const producing = {
      ...pen,
      lifecycleState: 'producing' as const,
      state: 'producing' as const,
      productionProgressMs: 1000,
      hungerSinceFeedMs: 50_000,
    };
    const produceInfo = getLivestockTimerInfo(producing, producing.lastUpdatedAt! + 1);
    expect(produceInfo?.kind).toBe('produce');
    expect(produceInfo?.growthTimeText).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(produceInfo?.hungerProgress).toBeGreaterThan(0);
    expect(produceInfo?.hungerProgress).toBeLessThan(1);

    const hungry = tickLivestockPen(
      pen,
      (pen.lastUpdatedAt ?? 0) + getLivestockDef('chicken').hungryAfterMs + 1
    );
    const hungryInfo = getLivestockTimerInfo(hungry, hungry.lastUpdatedAt! + 1);
    expect(hungryInfo?.kind).toBe('hungry');
    expect(hungryInfo?.hungerProgress).toBe(0);
    expect(hungryInfo?.growthTimeText).toBe('');

    const readyPen = {
      ...producing,
      state: 'ready' as const,
      lifecycleState: 'producing' as const,
      productionProgressMs: getLivestockDef('chicken').produceMs,
    };
    const readyInfo = getLivestockTimerInfo(readyPen, readyPen.lastUpdatedAt! + 1);
    expect(readyInfo?.kind).toBe('ready');
    expect(readyInfo?.growthTimeText).toBe('Ready');
  });

  it('hungry pauses production and feeding resumes', () => {
    let pen = stockPenWithAnimal(createNewPen('p2', 'duck', 1, 1), 'duck', () => 0)!;
    const start = pen.growthStartAt!;
    pen = tickLivestockPen(pen, start + (pen.growthDurationMs ?? 0) + 1);
    const hungry = tickLivestockPen(pen, (pen.lastUpdatedAt ?? 0) + 200_000);
    expect(hungry.lifecycleState).toBe('hungry');
    const fed = feedPen(hungry, hungry.lastUpdatedAt! + 1);
    expect(fed?.lifecycleState).toBe('producing');
  });

  it('production output uses species product', () => {
    let pen = createNewPen('c1', 'cow', 1, 1);
    pen = stockPenWithAnimal(pen, 'cow')!;
    pen = tickLivestockPen(pen, pen.growthStartAt! + (pen.growthDurationMs ?? 0) + 1);
    const ready = tickLivestockPen(
      { ...pen, productionProgressMs: 1_000_000, state: 'producing', lifecycleState: 'producing' },
      (pen.lastUpdatedAt ?? 0) + 1
    );
    const out = collectFromPen(ready, (ready.lastUpdatedAt ?? 0) + 1);
    expect(out?.productItemId).toBe(ITEM_IDS.MILK);
  });

  it('early sell thresholds enforce 50% growth gate', () => {
    const pen = stockPenWithAnimal(createNewPen('s1', 'pig', 2, 2), 'pig', () => 0)!;
    const start = pen.growthStartAt!;
    const tooEarly = livestockSellPrice(pen, start + Math.floor((pen.growthDurationMs ?? 0) * 0.49));
    const half = livestockSellPrice(pen, start + Math.floor((pen.growthDurationMs ?? 0) * 0.5));
    const full = livestockSellPrice(pen, start + (pen.growthDurationMs ?? 0) + 1);
    expect(tooEarly).toBe(0);
    expect(half).toBeGreaterThan(0);
    expect(full).toBeGreaterThanOrEqual(half);
  });

  it('happiness decreases under prolonged hunger', () => {
    let pen = stockPenWithAnimal(createNewPen('h1', 'sheep', 0, 0), 'sheep', () => 0)!;
    pen = { ...pen, lifecycleState: 'hungry', hungrySince: 0, lastUpdatedAt: 0, happiness: 100 };
    const ticked = tickLivestockPen(pen, 250 * 60 * 1000);
    expect(ticked.happiness).toBeLessThanOrEqual(50);
  });

  it('offline tick advances all pens', () => {
    const pen = stockPenWithAnimal(createNewPen('o1', 'fish', 0, 0), 'fish', () => 0)!;
    const updated = tickAllLivestockPens([pen], pen.growthStartAt! + (pen.growthDurationMs ?? 0) + 1)[0]!;
    expect(updated.lifecycleState).toBe('producing');
  });

  it('preserves global capacity by level (lv1=4, lv2=8)', () => {
    expect(livestockPenCapacity(1)).toBe(4);
    expect(livestockPenCapacity(2)).toBe(8);
  });
});

import { describe, expect, it } from 'vitest';
import { getLivestockAnimalRenderBox } from '../../src/config/livestockAssets';
import {
  livestockRenderSlotPositions,
  visibleLivestockRenderCount,
} from '../../src/config/livestockPenRenderSlots';

describe('livestock pen render sizing', () => {
  it('uses tighter render box for shared ruminant species', () => {
    const chicken = getLivestockAnimalRenderBox('chicken');
    const goat = getLivestockAnimalRenderBox('goat');
    const sheep = getLivestockAnimalRenderBox('sheep');

    expect(goat.width).toBeLessThan(chicken.width);
    expect(goat.height).toBeLessThan(chicken.height);
    expect(sheep).toEqual(goat);
    expect(goat.yRatio).toBeLessThan(chicken.yRatio);
  });

  it('returns stable slots for pig count=2', () => {
    const slots = livestockRenderSlotPositions(2, 200, 140, 'pig');
    expect(slots).toHaveLength(2);
    expect(slots[0]?.x).toBeLessThan(0);
    expect(slots[1]?.x).toBeGreaterThan(0);
    expect(slots[0]?.y).toBe(slots[1]?.y);
  });

  it('returns stable slots for fish count=3', () => {
    const slots = livestockRenderSlotPositions(3, 200, 140, 'fish');
    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`)).size).toBe(3);
  });

  it('resolves visible sprite count from stockCount for pig=2 and fish=3', () => {
    expect(visibleLivestockRenderCount(2, 4)).toBe(2);
    expect(visibleLivestockRenderCount(3, 4)).toBe(3);
  });

  it('caps visible sprite count to 4', () => {
    expect(visibleLivestockRenderCount(8, 8)).toBe(4);
  });
});

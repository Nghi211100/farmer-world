import { describe, expect, it } from 'vitest';
import {
  clampScrollToFarmPlayable,
  computeFarmCameraScrollLimits,
  type FarmFootprintBounds,
} from '../../src/farmCameraScroll';

const phonePlayable = {
  playableLeft: 10,
  playableTop: 68,
  playableRight: 300,
  playableBottom: 760,
};

/** Footprint-sized AABB similar to 390×844 layout (576×304 world px at zoom 1). */
const phoneFootprint: FarmFootprintBounds = {
  minX: 42,
  minY: 214,
  maxX: 618,
  maxY: 518,
};

describe('computeFarmCameraScrollLimits', () => {
  it('marks X oversize and Y in-band at zoom 1.7 on a phone-sized playable rect', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);
    expect(limits.x.minScroll).toBeLessThanOrEqual(limits.x.maxScroll);
    expect(limits.y.minScroll).toBeLessThanOrEqual(limits.y.maxScroll);
  });

  it('marks neither axis oversize when zoomed out enough to fit', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 0.4);
    expect(limits.x.oversize).toBe(false);
    expect(limits.y.oversize).toBe(false);
  });

  it('orders min/max scroll so clamp uses a non-inverted interval when X oversize', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeCloseTo(
      phoneFootprint.maxX -
        phonePlayable.playableRight / 1.7 -
        (phoneFootprint.minX - phonePlayable.playableLeft / 1.7),
      5
    );
    expect(limits.x.maxScroll).toBeGreaterThan(limits.x.minScroll);
  });
});

describe('clampScrollToFarmPlayable', () => {
  const zoomLevels = [1.2, 1.5, 1.7, 2.0];

  it.each(zoomLevels)('preserves in-range pan at zoom %s', (zoom) => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, zoom);
    const inRangeX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const inRangeY = (limits.y.minScroll + limits.y.maxScroll) / 2;
    const after = clampScrollToFarmPlayable(inRangeX, inRangeY, limits);
    expect(after.scrollX).toBeCloseTo(inRangeX, 5);
    expect(after.scrollY).toBeCloseTo(inRangeY, 5);
  });

  it.each(zoomLevels)('clamps out-of-range pan to nearest edge at zoom %s', (zoom) => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, zoom);
    const low = clampScrollToFarmPlayable(
      limits.x.minScroll - 500,
      limits.y.minScroll - 500,
      limits
    );
    const high = clampScrollToFarmPlayable(
      limits.x.maxScroll + 500,
      limits.y.maxScroll + 500,
      limits
    );
    expect(low.scrollX).toBeCloseTo(
      limits.x.oversize ? limits.x.minScroll : limits.x.minScroll - 500,
      5
    );
    expect(low.scrollY).toBeCloseTo(
      limits.y.oversize ? limits.y.minScroll : limits.y.minScroll - 500,
      5
    );
    expect(high.scrollX).toBeCloseTo(
      limits.x.oversize ? limits.x.maxScroll : limits.x.maxScroll + 500,
      5
    );
    expect(high.scrollY).toBeCloseTo(
      limits.y.oversize ? limits.y.maxScroll : limits.y.maxScroll + 500,
      5
    );
  });

  it('clamps X to the nearest edge when oversize and scroll is outside limits', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    const low = clampScrollToFarmPlayable(-500, 128, limits);
    const high = clampScrollToFarmPlayable(500, 128, limits);
    expect(low.scrollX).toBeCloseTo(limits.x.minScroll, 5);
    expect(high.scrollX).toBeCloseTo(limits.x.maxScroll, 5);
    expect(low.scrollY).toBe(128);
    expect(high.scrollY).toBe(128);
  });

  it('keeps centered scroll inside the X interval after a small pan', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    const centered = clampScrollToFarmPlayable(80, 128, limits);
    const nudged = clampScrollToFarmPlayable(95, 145, limits);
    expect(centered.scrollX).toBeCloseTo(80, 5);
    expect(centered.scrollY).toBeCloseTo(128, 5);
    expect(nudged.scrollX).toBeCloseTo(95, 5);
    expect(nudged.scrollY).toBeCloseTo(145, 5);
  });

  it('keeps both axes unchanged when farm fits playable area on both axes', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 0.4);
    const before = { x: -321, y: 654 };
    const after = clampScrollToFarmPlayable(before.x, before.y, limits);
    expect(limits.x.oversize).toBe(false);
    expect(limits.y.oversize).toBe(false);
    expect(after.scrollX).toBe(before.x);
    expect(after.scrollY).toBe(before.y);
  });

  it('clamps only the oversize axis and preserves the fit axis', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);

    const low = clampScrollToFarmPlayable(limits.x.minScroll - 300, 900, limits);
    const high = clampScrollToFarmPlayable(limits.x.maxScroll + 300, -200, limits);

    expect(low.scrollX).toBeCloseTo(limits.x.minScroll, 5);
    expect(high.scrollX).toBeCloseTo(limits.x.maxScroll, 5);
    expect(low.scrollY).toBe(900);
    expect(high.scrollY).toBe(-200);
  });
});

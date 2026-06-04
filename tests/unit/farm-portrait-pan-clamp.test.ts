import { describe, expect, it } from 'vitest';
import {
  clampScrollToFarmPlayable,
  clampScrollSoFootprintOverlapsViewport,
  computeFarmCameraScrollLimits,
  type FarmFootprintBounds,
} from '../../src/farmCameraScroll';
import {
  computePlayableFarmViewportLayout,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';

/** Snapshot from live portrait 390×844 @ zoom 2.8 (Playwright probe). */
const portraitPanBounds: FarmFootprintBounds = {
  minX: -385.14,
  minY: 2452.84,
  maxX: 254.86,
  maxY: 2663.36,
};
const portraitSoil: FarmFootprintBounds = {
  minX: -385.14,
  minY: 2452.84,
  maxX: 254.86,
  maxY: 2772.84,
};

describe('portrait zoom 2.8 pan clamp (live bounds snapshot)', () => {
  const viewW = 390;
  const viewH = 844;
  const zoom = 2.8;
  const playable = shiftPlayableBandForPanBoundsCenter(
    computePlayableFarmViewportLayout(viewW, viewH),
    viewW,
    viewH
  );
  const limits = computeFarmCameraScrollLimits(portraitPanBounds, playable, zoom);

  it('matches live axis oversize flags', () => {
    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeGreaterThan(100);
  });

  it('horizontal pan steps change scrollX through playable-only clamp', () => {
    let scrollX = -204.69785714285715;
    const scrollY = 1939.6157142857141;
    const start = scrollX;
    for (let i = 0; i < 20; i++) {
      scrollX += 12 / zoom;
      scrollX = clampScrollToFarmPlayable(scrollX, scrollY, limits).scrollX;
    }
    expect(scrollX - start).toBeGreaterThan(50);
  });

  it('horizontal pan steps change scrollX through footprint overlap clamp', () => {
    let scrollX = -204.69785714285715;
    const scrollY = 1939.6157142857141;
    const start = scrollX;
    for (let i = 0; i < 20; i++) {
      scrollX += 12 / zoom;
      const next = clampScrollSoFootprintOverlapsViewport(
        portraitSoil,
        limits,
        viewW,
        viewH,
        zoom,
        { scrollX, scrollY },
        playable
      );
      scrollX = next.scrollX;
    }
    expect(scrollX - start).toBeGreaterThan(50);
  });
});

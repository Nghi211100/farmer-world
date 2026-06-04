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

const phoneFootprint: FarmFootprintBounds = {
  minX: 42,
  minY: 214,
  maxX: 618,
  maxY: 518,
};

function playableFor(viewW: number, viewH: number) {
  const geom = computePlayableFarmViewportLayout(viewW, viewH);
  return shiftPlayableBandForPanBoundsCenter(
    {
      playableLeft: geom.playableLeft,
      playableTop: geom.playableTop,
      playableRight: geom.playableRight,
      playableBottom: geom.playableBottom,
    },
    viewW,
    viewH
  );
}

/** Simulates repeated pointer pan steps + clamp (playable only, like FarmScene user pan). */
function simulateHorizontalPan(
  farm: FarmFootprintBounds,
  playable: ReturnType<typeof playableFor>,
  viewW: number,
  viewH: number,
  zoom: number,
  steps: number,
  dxScreen: number,
  useFootprintOverlap: boolean
): { start: number; end: number } {
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  let scrollX = (limits.x.minScroll + limits.x.maxScroll) / 2;
  const scrollY = 128;
  const start = scrollX;
  for (let i = 0; i < steps; i++) {
    scrollX -= dxScreen / zoom;
    let next = clampScrollToFarmPlayable(scrollX, scrollY, limits);
    if (useFootprintOverlap) {
      next = clampScrollSoFootprintOverlapsViewport(
        phoneFootprint,
        limits,
        viewW,
        viewH,
        zoom,
        next,
        playable
      );
    }
    scrollX = next.scrollX;
  }
  return { start, end: scrollX };
}

describe('horizontal pan clamp at zoom 2.8', () => {
  it('playable-only clamp allows large scrollX delta on phone portrait', () => {
    const viewW = 390;
    const viewH = 844;
    const playable = playableFor(viewW, viewH);
    const limits = computeFarmCameraScrollLimits(phoneFootprint, playable, 2.8);
    expect(limits.x.oversize).toBe(true);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeGreaterThan(10);

    const { start, end } = simulateHorizontalPan(
      phoneFootprint,
      playable,
      viewW,
      viewH,
      2.8,
      80,
      -8,
      false
    );
    expect(Math.abs(end - start)).toBeGreaterThan(12);
  });

  it('footprint overlap clamp still allows horizontal travel at zoom 2.8', () => {
    const viewW = 390;
    const viewH = 844;
    const playable = playableFor(viewW, viewH);
    const { start, end } = simulateHorizontalPan(
      phoneFootprint,
      playable,
      viewW,
      viewH,
      2.8,
      80,
      -8,
      true
    );
    expect(Math.abs(end - start)).toBeGreaterThan(12);
  });

  it('footprint overlap preserves off-center scrollX after simulated user pan', () => {
    const viewW = 390;
    const viewH = 844;
    const playable = playableFor(viewW, viewH);
    const zoom = 2.8;
    const limits = computeFarmCameraScrollLimits(phoneFootprint, playable, zoom);
    const pannedX = limits.x.minScroll + (limits.x.maxScroll - limits.x.minScroll) * 0.2;
    const after = clampScrollSoFootprintOverlapsViewport(
      phoneFootprint,
      limits,
      viewW,
      viewH,
      zoom,
      { scrollX: pannedX, scrollY: 128 },
      playable
    );
    expect(Math.abs(after.scrollX - pannedX)).toBeLessThan(2);
  });
});

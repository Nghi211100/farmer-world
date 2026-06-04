import { describe, expect, it } from 'vitest';
import {
  computeFarmCameraScrollLimits,
  intersectFarmFootprintBounds,
  resolveFarmPanClampBounds,
} from '../../src/farmCameraScroll';
import {
  computeFarmIslandScreenBounds,
  FARM_ISLAND_SCALE_BOOST,
  getFarmIslandPanClampBounds,
} from '../../src/farmIslandLayout';
import { mergeFarmAndMapScrollLimits } from '../../src/farmCameraMotion';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_FIT_PAD_X,
  FARM_FIT_PAD_Y,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import { FARM_CAMERA_DEFAULT_ZOOM } from '../../src/config/farmCameraConfig';

const zoom = FARM_CAMERA_DEFAULT_ZOOM;

describe('resolveFarmPanClampBounds', () => {
  it('falls back to soil footprint when island inset overlap is too narrow on X', () => {
    const viewW = 390;
    const viewH = 844;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
    const footprint = grid.getFarmFootprintScreenBounds();
    const soilW = footprint.maxX - footprint.minX;
    const narrowIsland = {
      minX: footprint.minX + soilW * 0.4,
      minY: footprint.minY,
      maxX: footprint.minX + soilW * 0.4 + 40,
      maxY: footprint.maxY,
    };
    const resolved = resolveFarmPanClampBounds(footprint, narrowIsland);
    expect(resolved.maxX - resolved.minX).toBeCloseTo(soilW, 0);

    const viewport = computePlayableFarmViewportLayout(
      viewW,
      viewH,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y
    );
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(
      {
        playableLeft: viewport.playableLeft,
        playableTop: viewport.playableTop,
        playableRight: viewport.playableRight,
        playableBottom: viewport.playableBottom,
      },
      viewW,
      viewH
    );
    const limits = computeFarmCameraScrollLimits(resolved, scrollPlayable, zoom);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeGreaterThan(200);
  });

  it('uses island inset when it covers most of the footprint', () => {
    const grid = new GridSystem();
    grid.centerInViewport(390, 844, 10, 10);
    const footprint = grid.getFarmFootprintScreenBounds();
    const island = computeFarmIslandScreenBounds(
      grid.getFarmSoilScreenRhombus(),
      2048,
      2048,
      { scaleBoost: FARM_ISLAND_SCALE_BOOST }
    );
    const inset = getFarmIslandPanClampBounds(island);
    const overlap = intersectFarmFootprintBounds(inset, footprint)!;
    const resolved = resolveFarmPanClampBounds(footprint, island);
    expect(resolved.maxX - resolved.minX).toBeCloseTo(
      overlap.maxX - overlap.minX,
      0
    );
  });
});

describe('mergeFarmAndMapScrollLimits', () => {
  it('keeps farm X range when map intersection collapses horizontal pan', () => {
    const farm = {
      x: { minScroll: -250, maxScroll: 220, oversize: true },
      y: { minScroll: 10, maxScroll: 400, oversize: true },
    };
    const map = {
      x: { minScroll: -20, maxScroll: 20, oversize: true },
      y: { minScroll: 0, maxScroll: 500, oversize: true },
    };
    const merged = mergeFarmAndMapScrollLimits(farm, map);
    expect(merged.x.minScroll).toBe(-250);
    expect(merged.x.maxScroll).toBe(220);
    expect(merged.y.minScroll).toBe(10);
    expect(merged.y.maxScroll).toBe(400);
  });
});

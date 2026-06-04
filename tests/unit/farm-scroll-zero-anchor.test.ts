import { describe, expect, it } from 'vitest';
import {
  applyFarmCameraScrollZeroAnchor,
  finalizeFarmLayoutAtScrollZero,
  getFarmMapCenterWorldTargetAtDefaultScroll,
  getFarmMapCenterWorldTargetAtScrollZero,
} from '../../src/farmWorldScrollAnchor';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
} from '../../src/config/farmCameraConfig';
import { measureMapTopAbovePanBoundsPx } from '../../src/farmMapTopCamera';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenYFromPanBounds,
  getFarmPanBoundsScrollTargetScreen,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import { computeFarmIslandScreenBounds, FARM_ISLAND_SCALE_BOOST } from '../../src/farmIslandLayout';

const viewW = 390;
const viewH = 844;

describe('getFarmMapCenterWorldTargetAtDefaultScroll', () => {
  it('returns measured 1.9 playable map center world at scroll (0,0) on ref viewport', () => {
    const z = FARM_CAMERA_DEFAULT_ZOOM;
    const target = getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, z);
    expect(target.x).toBeCloseTo(554.7, 1);
    expect(target.y).toBeCloseTo(338.2, 1);
    expect(getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z)).toEqual(target);
  });
});

describe('applyFarmCameraScrollZeroAnchor', () => {
  it('bakes scroll Y into world so screen position is unchanged at scroll 0', () => {
    const grid = new GridSystem();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const before = grid.getFarmMapCenterScreen();
    const scrollX = -120;
    const scrollY = 890;
    const zoom = 1.7;

    const screenBeforeY = (before.y - scrollY) * zoom;

    applyFarmCameraScrollZeroAnchor(grid, scrollX, scrollY);

    const after = grid.getFarmMapCenterScreen();
    expect(after.y).toBeCloseTo(before.y - scrollY, 4);
    expect(after.y * zoom).toBeCloseTo(screenBeforeY, 2);
  });

  it('shifts world by negative scroll so screen position is unchanged at scroll 0', () => {
    const grid = new GridSystem();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const before = grid.getFarmMapCenterScreen();
    const scrollX = -223;
    const scrollY = 1555;
    const zoom = 1.7;

    const screenBeforeX = (before.x - scrollX) * zoom;
    const screenBeforeY = (before.y - scrollY) * zoom;

    applyFarmCameraScrollZeroAnchor(grid, scrollX, scrollY);

    const after = grid.getFarmMapCenterScreen();
    expect(after.x).toBeCloseTo(before.x - scrollX, 4);
    expect(after.y).toBeCloseTo(before.y - scrollY, 4);
    expect(after.x * zoom).toBeCloseTo(screenBeforeX, 2);
    expect(after.y * zoom).toBeCloseTo(screenBeforeY, 2);
  });

  it('is a no-op for near-zero scroll', () => {
    const grid = new GridSystem();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const originX = grid.originX;
    const originY = grid.originY;
    const out = applyFarmCameraScrollZeroAnchor(grid, 0, 0);
    expect(out).toEqual({ scrollX: 0, scrollY: 0 });
    expect(grid.originX).toBe(originX);
    expect(grid.originY).toBe(originY);
  });

  it('centers pan scroll limits on zero after baking midpoint scroll', () => {
    const grid = new GridSystem();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const layout = computePlayableFarmViewportLayout(viewW, viewH, 10, 10);
    const farm = grid.getFarmFootprintScreenBounds();
    const footprint = {
      minX: farm.minX,
      minY: farm.minY,
      maxX: farm.maxX,
      maxY: farm.maxY,
    };
    const midX = (footprint.minX + footprint.maxX) / 2;
    const midY = (footprint.minY + footprint.maxY) / 2;
    const scrollX = midX - layout.centerX;
    const scrollY = midY - layout.centerY;

    applyFarmCameraScrollZeroAnchor(grid, scrollX, scrollY);

    const shifted = grid.getFarmFootprintScreenBounds();
    const idealAtZeroX = (shifted.minX + shifted.maxX) / 2 - layout.centerX;
    const idealAtZeroY = (shifted.minY + shifted.maxY) / 2 - layout.centerY;
    expect(Math.abs(idealAtZeroX)).toBeLessThan(2);
    expect(Math.abs(idealAtZeroY)).toBeLessThan(2);
  });

  it('finalizeFarmLayoutAtScrollZero places playable center at keyframe world (Approach C)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const z = FARM_CAMERA_DEFAULT_ZOOM;
    const baked = finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, z);
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    expect(target.x).toBeCloseTo(554.7, 1);
    expect(target.y).toBeCloseTo(338.2, 1);
    expect(baked.layoutAnchorAtOrigin.x).toBeCloseTo(target.x, 4);
    expect(baked.layoutAnchorAtOrigin.y).toBeCloseTo(target.y, 4);
    expect(baked.mapCenterAtOrigin.x).toBeCloseTo(target.x, 4);
    expect(baked.mapCenterAtOrigin.y).toBeCloseTo(target.y, 4);
    expect(baked.layoutAnchorAtOrigin).toEqual(grid.getFarmPlayableMapCenterScreen());
    expect(baked.mapCenterAtOrigin).toEqual(baked.layoutAnchorAtOrigin);
    expect(baked.mapCenterAtOrigin).toEqual(grid.getFarmPlayerSpawnScreen());
    const screenX = (baked.layoutAnchorAtOrigin.x - baked.scrollX) * z;
    const screenY = (baked.layoutAnchorAtOrigin.y - baked.scrollY) * z;
    expect(screenX).toBeCloseTo(viewW / 2, 2);
    expect(screenY).toBeCloseTo(viewH / 2, 2);
    expect(Math.abs(baked.layoutAnchorAtOrigin.x)).toBeGreaterThan(1);
    expect(Math.abs(baked.layoutAnchorAtOrigin.y)).toBeGreaterThan(1);
  });

  it('map center matches getMapScreenBounds center', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const map = grid.getMapScreenBounds();
    const center = grid.getFarmMapCenterScreen();
    expect(center.x).toBeCloseTo(map.centerX, 4);
    expect(center.y).toBeCloseTo(map.centerY, 4);
    expect(grid.isFarmMapCenterTrueAabb()).toBe(true);
  });

  it('alignMapTopYToPanBoundsInset zeros map top error at scroll 0', () => {
    const grid = new GridSystem();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const pan = computeFarmIslandScreenBounds(
      grid.getFarmSoilScreenRhombus(),
      2048,
      2048,
      { scaleBoost: FARM_ISLAND_SCALE_BOOST }
    );
    const zoom = 1;
    const scrollY = 0;
    grid.alignMapTopYToPanBoundsInset(pan, FARM_MAP_TOP_PAN_BOUNDS_FRAC);
    const mapMinY = grid.getMapScreenBounds().minY;
    const target = getFarmMapTopTargetScreenYFromPanBounds(
      pan,
      scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    const metrics = measureMapTopAbovePanBoundsPx(
      mapMinY,
      pan,
      scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    expect(Math.abs(metrics.mapTopScreenY - target)).toBeLessThan(2);
    expect(Math.abs(metrics.mapTopErrorY)).toBeLessThan(2);
  });
});

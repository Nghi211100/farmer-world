import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
  MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM,
  MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM,
  MAP_CENTER_WORLD_X_OFFSET_AT_MAX_ZOOM,
  MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM,
  MAP_CENTER_WORLD_Y_OFFSET_AT_MAX_ZOOM,
  MAP_CENTER_WORLD_Y_OFFSET_AT_MIN_ZOOM,
  FARM_SPAWN_WORLD_AT_MIN_ZOOM_X,
  FARM_SPAWN_WORLD_AT_MIN_ZOOM_Y,
  getFarmMapCenterScreenOffsets,
  getFarmMapCenterWorldOffsets,
  piecewiseLerpFarmMapCenterKeyframe,
} from '../../src/config/farmCameraConfig';
import {
  applyFarmCameraScrollZeroAnchor,
  applyFarmMapCenterWorldOffsetDelta,
  computeScrollForMapCenterScreenTarget,
  enforceFarmMapCenterWorldAnchor,
  finalizeFarmLayoutAtScrollZero,
  getFarmMapCenterScreenTargetAtScrollZero,
  getFarmMapCenterWorldBaselineAtDefaultZoom,
  getFarmMapCenterWorldOffsetDelta,
  getFarmMapCenterWorldTargetAtScrollZero,
  getFarmSpawnTileWorld,
  syncFarmMapCenterWorldAndScrollAtZoom,
} from '../../src/farmWorldScrollAnchor';
import { GridSystem } from '../../src/systems/GridSystem';

const viewW = 390;
const viewH = 844;

/** Measured playable map-center world after 1.9 bake (scroll 0); offsets at 1.9 are 0. */
const MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM = { x: 554.7, y: 338.2 };

/** Measured playable map-center world at zoom keyframes (ref viewport 390×844). */
const MEASURED_MAP_CENTER_WORLD_AT_ZOOM = {
  1.2: { x: FARM_SPAWN_WORLD_AT_MIN_ZOOM_X, y: FARM_SPAWN_WORLD_AT_MIN_ZOOM_Y },
  1.9: MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM,
  2.5: { x: 421.6, y: 257.0 },
} as const;

describe('farm map center zoom keyframes', () => {
  it('piecewise lerp hits min, default, and max zoom anchors (screen Y)', () => {
    expect(
      piecewiseLerpFarmMapCenterKeyframe(
        FARM_CAMERA_MIN_ZOOM,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM,
        0,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM
      )
    ).toBeCloseTo(MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM, 6);
    expect(
      piecewiseLerpFarmMapCenterKeyframe(
        FARM_CAMERA_DEFAULT_ZOOM,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM,
        0,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM
      )
    ).toBeCloseTo(0, 6);
    expect(
      piecewiseLerpFarmMapCenterKeyframe(
        FARM_CAMERA_MAX_ZOOM,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM,
        0,
        MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM
      )
    ).toBeCloseTo(MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM, 6);
  });

  it('world offset keyframes: positive at min zoom, zero at 1.9, negative at max', () => {
    const atMin = getFarmMapCenterWorldOffsets(viewW, viewH, FARM_CAMERA_MIN_ZOOM);
    const atDef = getFarmMapCenterWorldOffsets(viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
    const atMax = getFarmMapCenterWorldOffsets(viewW, viewH, FARM_CAMERA_MAX_ZOOM);
    expect(atDef.x).toBe(0);
    expect(atDef.y).toBe(0);
    expect(atMin.x).toBeGreaterThan(0);
    expect(atMin.y).toBeGreaterThan(0);
    expect(atMax.x).toBeLessThan(0);
    expect(atMax.y).toBeLessThan(0);
    expect(atMin.x).toBeCloseTo(MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM, 1);
    expect(atMin.y).toBeCloseTo(MAP_CENTER_WORLD_Y_OFFSET_AT_MIN_ZOOM, 1);
    expect(atMax.x).toBeCloseTo(MAP_CENTER_WORLD_X_OFFSET_AT_MAX_ZOOM, 1);
    expect(atMax.y).toBeCloseTo(MAP_CENTER_WORLD_Y_OFFSET_AT_MAX_ZOOM, 1);
  });

  it.each([1.2, 1.9, 2.5] as const)(
    'enforceFarmMapCenterWorldAnchor at zoom %s hits measured spawn tile (10,10) keyframe (390×844)',
    (z) => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      grid.centerInViewport(viewW, viewH, 10, 10);
      finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
      grid.mapTopPanOffsetX = 90;
      grid.mapTopPanOffsetY = 60;
      const enforced = enforceFarmMapCenterWorldAnchor(grid, viewW, viewH, z);
      const measured = MEASURED_MAP_CENTER_WORLD_AT_ZOOM[z];
      const spawn = getFarmSpawnTileWorld(grid);
      expect(enforced.spawnWorld.x).toBeCloseTo(measured.x, 1);
      expect(enforced.spawnWorld.y).toBeCloseTo(measured.y, 1);
      expect(spawn.x).toBeCloseTo(measured.x, 1);
      expect(spawn.y).toBeCloseTo(measured.y, 1);
      expect(Math.abs(enforced.spawnWorldErrorX)).toBeLessThan(0.5);
      expect(Math.abs(enforced.spawnWorldErrorY)).toBeLessThan(0.5);
      expect(grid.mapTopPanOffsetX).toBe(0);
      expect(grid.mapTopPanOffsetY).toBe(0);
    }
  );

  it.each([1.2, 1.9, 2.5] as const)(
    'spawn tile (10,10) world at zoom %s = keyframe after enforce regardless of baked scroll',
    (z) => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      grid.centerInViewport(viewW, viewH, 10, 10);
      finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
      applyFarmCameraScrollZeroAnchor(grid, -280, 1555);
      const measured = MEASURED_MAP_CENTER_WORLD_AT_ZOOM[z];
      enforceFarmMapCenterWorldAnchor(grid, viewW, viewH, z);
      const spawn = getFarmSpawnTileWorld(grid);
      expect(spawn.x).toBeCloseTo(measured.x, 1);
      expect(spawn.y).toBeCloseTo(measured.y, 1);
    }
  );

  it.each([1.2, 1.9, 2.5] as const)(
    'measured world at zoom %s = 1.9 bake baseline + world offset (390×844)',
    (z) => {
      const off = getFarmMapCenterWorldOffsets(viewW, viewH, z);
      const measured = MEASURED_MAP_CENTER_WORLD_AT_ZOOM[z];
      expect(
        MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM.x + off.x
      ).toBeCloseTo(measured.x, 1);
      expect(
        MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM.y + off.y
      ).toBeCloseTo(measured.y, 1);
    }
  );

  it('at default zoom world target matches measured 1.9 playable bake (390×844)', () => {
    const z = FARM_CAMERA_DEFAULT_ZOOM;
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    expect(target.x).toBeCloseTo(MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM.x, 1);
    expect(target.y).toBeCloseTo(MEASURED_MAP_CENTER_WORLD_AT_DEFAULT_ZOOM.y, 1);
    const screen = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    expect(screen.x).toBeCloseTo(viewW / 2, 6);
    expect(screen.y).toBeCloseTo(viewH / 2, 6);
  });

  it('at max zoom screen target is above viewport center (negative Y offset)', () => {
    const z = FARM_CAMERA_MAX_ZOOM;
    const screen = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    const off = getFarmMapCenterScreenOffsets(z);
    expect(off.y).toBeLessThan(0);
    expect(screen.y).toBeCloseTo(viewH / 2 + off.y, 4);
    expect(screen.y).toBeLessThan(viewH / 2);
    const baseline = getFarmMapCenterWorldBaselineAtDefaultZoom(viewW, viewH);
    const world = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    expect(world.y).toBeLessThan(baseline.y);
    expect(world.x).toBeLessThan(baseline.x);
  });

  it('finalize at 2.5 places map center on world target; scroll hits screen target', () => {
    const z = FARM_CAMERA_MAX_ZOOM;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, z);
    const mapCenter = grid.getFarmPlayableMapCenterScreen();
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    expect(mapCenter.x).toBeCloseTo(target.x, 4);
    expect(mapCenter.y).toBeCloseTo(target.y, 4);
    const scroll = computeScrollForMapCenterScreenTarget(mapCenter, viewW, viewH, z);
    const screenY = (mapCenter.y - scroll.scrollY) * z;
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    expect(screenY).toBeCloseTo(screenTarget.y, 2);
  });

  const zoomLevels = [1.2, 1.9, 2.5] as const;

  it.each(zoomLevels)(
    'at zoom %s screen ≈ view/2 + offset; world shifts from 1.9 bake when offset applied',
    (z) => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      grid.centerInViewport(viewW, viewH, 10, 10);
      finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
      const worldAtBake = grid.getFarmPlayableMapCenterScreen();
      const worldOff = getFarmMapCenterWorldOffsets(viewW, viewH, z);
      applyFarmMapCenterWorldOffsetDelta(grid, worldOff.x, worldOff.y);
      const mapCenter = grid.getFarmPlayableMapCenterScreen();
      const scroll = computeScrollForMapCenterScreenTarget(mapCenter, viewW, viewH, z);
      const off = getFarmMapCenterScreenOffsets(z);
      const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
      expect(screenTarget.x).toBeCloseTo(viewW / 2 + off.x, 4);
      expect(screenTarget.y).toBeCloseTo(viewH / 2 + off.y, 4);
      const screenX = (mapCenter.x - scroll.scrollX) * z;
      const screenY = (mapCenter.y - scroll.scrollY) * z;
      expect(screenX).toBeCloseTo(screenTarget.x, 2);
      expect(screenY).toBeCloseTo(screenTarget.y, 2);
      if (z === FARM_CAMERA_DEFAULT_ZOOM) {
        expect(mapCenter.x).toBeCloseTo(worldAtBake.x, 4);
        expect(mapCenter.y).toBeCloseTo(worldAtBake.y, 4);
      } else if (z === FARM_CAMERA_MAX_ZOOM) {
        expect(mapCenter.x).toBeLessThan(worldAtBake.x);
        expect(mapCenter.y).toBeLessThan(worldAtBake.y);
      } else {
        expect(mapCenter.x).toBeGreaterThan(worldAtBake.x);
        expect(mapCenter.y).toBeGreaterThan(worldAtBake.y);
      }
    }
  );

  it('pan changes scroll only — map center world coords unchanged', () => {
    const z = FARM_CAMERA_DEFAULT_ZOOM;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, z);
    const worldBefore = grid.getFarmPlayableMapCenterScreen();
    const scrollAtCenter = computeScrollForMapCenterScreenTarget(worldBefore, viewW, viewH, z);
    const pannedScroll = {
      scrollX: scrollAtCenter.scrollX + 120,
      scrollY: scrollAtCenter.scrollY + 80,
    };
    const worldAfter = grid.getFarmPlayableMapCenterScreen();
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
    expect(pannedScroll.scrollX).not.toBeCloseTo(scrollAtCenter.scrollX, 0);
    const screenBefore =
      (worldBefore.x - scrollAtCenter.scrollX) * z;
    const screenAfterPan =
      (worldBefore.x - pannedScroll.scrollX) * z;
    expect(screenAfterPan).not.toBeCloseTo(screenBefore, 0);
  });

  it('zoom 1.2→2.5 shifts map center world; scroll-only pan does not', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
    const worldAtBake = grid.getFarmPlayableMapCenterScreen();
    const { dx, dy } = getFarmMapCenterWorldOffsetDelta(
      viewW,
      viewH,
      FARM_CAMERA_DEFAULT_ZOOM,
      1.2
    );
    applyFarmMapCenterWorldOffsetDelta(grid, dx, dy);
    const worldAt12 = grid.getFarmPlayableMapCenterScreen();
    expect(worldAt12.x).not.toBeCloseTo(worldAtBake.x, 2);
    const scrollPanOnly = { scrollX: 50, scrollY: 30 };
    expect(grid.getFarmPlayableMapCenterScreen().x).toBeCloseTo(worldAt12.x, 6);
    const { dx: dx25, dy: dy25 } = getFarmMapCenterWorldOffsetDelta(
      viewW,
      viewH,
      1.2,
      2.5
    );
    applyFarmMapCenterWorldOffsetDelta(grid, dx25, dy25);
    const worldAt25 = grid.getFarmPlayableMapCenterScreen();
    expect(worldAt25.x).not.toBeCloseTo(worldAt12.x, 2);
    expect(worldAt25.y).not.toBeCloseTo(worldAt12.y, 2);
    expect(scrollPanOnly.scrollX).toBe(50);
  });

  it('wide viewport: world X at 1.2 uses fixed delta, not viewport-scaled (~878 not ~2303)', () => {
    const wideW = 2108;
    const wideH = 844;
    const z = FARM_CAMERA_MIN_ZOOM;
    const off = getFarmMapCenterWorldOffsets(wideW, wideH, z);
    expect(off.x).toBeCloseTo(MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM, 1);
    expect(off.y).toBeCloseTo(MAP_CENTER_WORLD_Y_OFFSET_AT_MIN_ZOOM, 1);
    const baseline = getFarmMapCenterWorldBaselineAtDefaultZoom(wideW, wideH);
    const worldX = baseline.x + off.x;
    expect(worldX).toBeCloseTo(MEASURED_MAP_CENTER_WORLD_AT_ZOOM[1.2].x, 1);
    expect(worldX).not.toBeCloseTo(2303.8, 100);
    const wronglyScaledX =
      baseline.x +
      MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM * (wideW / viewW);
    expect(worldX).not.toBeCloseTo(wronglyScaledX, 50);
  });

  it('world target at zoom depends only on zoom, not camera scroll', () => {
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, 2.5);
    const baseline = getFarmMapCenterWorldBaselineAtDefaultZoom(viewW, viewH);
    const off = getFarmMapCenterWorldOffsets(viewW, viewH, 2.5);
    expect(target.x).toBeCloseTo(baseline.x + off.x, 6);
    expect(target.y).toBeCloseTo(baseline.y + off.y, 6);
  });

  it('syncFarmMapCenterWorldAndScrollAtZoom clears mapTopPanOffset and aligns playable center', () => {
    const z = 1.2;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    grid.mapTopPanOffsetX = 120;
    grid.mapTopPanOffsetY = 80;
    const synced = syncFarmMapCenterWorldAndScrollAtZoom(grid, viewW, viewH, z);
    expect(grid.mapTopPanOffsetX).toBe(0);
    expect(grid.mapTopPanOffsetY).toBe(0);
    const center = grid.getFarmPlayableMapCenterScreen();
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    expect(center.x).toBeCloseTo(target.x, 2);
    expect(center.y).toBeCloseTo(target.y, 2);
    const screenX = (center.x - synced.scrollX) * z;
    const screenY = (center.y - synced.scrollY) * z;
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    expect(screenX).toBeCloseTo(screenTarget.x, 2);
    expect(screenY).toBeCloseTo(screenTarget.y, 2);
  });

  it('syncFarmMapCenterWorldAndScrollAtZoom fixes stale oversize scroll at 1.2', () => {
    const z = FARM_CAMERA_MIN_ZOOM;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
    const { dx, dy } = getFarmMapCenterWorldOffsetDelta(
      viewW,
      viewH,
      FARM_CAMERA_DEFAULT_ZOOM,
      z
    );
    applyFarmMapCenterWorldOffsetDelta(grid, dx, dy);
    const staleScrollX = -280;
    const mapCenter = grid.getFarmPlayableMapCenterScreen();
    const wrongScreenX = (mapCenter.x - staleScrollX) * z;
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    expect(wrongScreenX).not.toBeCloseTo(screenTarget.x, 0);

    const synced = syncFarmMapCenterWorldAndScrollAtZoom(grid, viewW, viewH, z);
    const center = grid.getFarmPlayableMapCenterScreen();
    const screenX = (center.x - synced.scrollX) * z;
    const screenY = (center.y - synced.scrollY) * z;
    expect(screenX).toBeCloseTo(screenTarget.x, 2);
    expect(screenY).toBeCloseTo(screenTarget.y, 2);
  });

  it('world offset + scroll at 2.5 after bake at 1.9 hits screen target', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
    const z = FARM_CAMERA_MAX_ZOOM;
    const off = getFarmMapCenterWorldOffsets(viewW, viewH, z);
    applyFarmMapCenterWorldOffsetDelta(grid, off.x, off.y);
    const mapCenter = grid.getFarmPlayableMapCenterScreen();
    const scroll = computeScrollForMapCenterScreenTarget(mapCenter, viewW, viewH, z);
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    const screenX = (mapCenter.x - scroll.scrollX) * z;
    const screenY = (mapCenter.y - scroll.scrollY) * z;
    expect(screenX).toBeCloseTo(screenTarget.x, 2);
    expect(screenY).toBeCloseTo(screenTarget.y, 2);
  });
});

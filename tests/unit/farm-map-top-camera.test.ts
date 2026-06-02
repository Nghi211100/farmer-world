import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  FARM_MAP_LEFT_PAN_BOUNDS_FRAC,
  computePlayableFarmViewportLayout,
  getFarmMapLeftShiftScreenPx,
  getFarmMapTopTargetScreenYFromPanBounds,
  getPlayableBandPanBoundsCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import {
  computeCenteredFarmCameraScroll,
  farmFootprintCenter,
} from '../../src/farmCameraScroll';
import {
  measureMapTopAbovePanBoundsPx,
  runMapTopPanBoundsCameraPasses,
  syncFarmMapTopCameraScroll,
} from '../../src/farmMapTopCamera';
import {
  computeFarmIslandScreenBounds,
  FARM_ISLAND_SCALE_BOOST,
} from '../../src/farmIslandLayout';

const viewW = 390;
const viewH = 844;
const padX = 10;
const padY = 10;
const zoom = 1.7;

function layoutIslandPanBounds(grid: GridSystem) {
  return computeFarmIslandScreenBounds(
    grid.getFarmSoilScreenRhombus(),
    2048,
    2048,
    { scaleBoost: FARM_ISLAND_SCALE_BOOST }
  );
}

function runFullMapTopLayout(
  grid: GridSystem,
  passes: number,
  frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
) {
  grid.centerInViewport(viewW, viewH, padX, padY);
  const viewport = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
  const scrollPlayable = shiftPlayableBandForPanBoundsCenter({
    playableLeft: viewport.playableLeft,
    playableTop: viewport.playableTop,
    playableRight: viewport.playableRight,
    playableBottom: viewport.playableBottom,
  });
  const panTargetCenter = getPlayableBandPanBoundsCenter({
    playableLeft: viewport.playableLeft,
    playableTop: viewport.playableTop,
    playableRight: viewport.playableRight,
    playableBottom: viewport.playableBottom,
  });
  const farm = layoutIslandPanBounds(grid);
  const anchor = farmFootprintCenter(farm);
  let scroll = computeCenteredFarmCameraScroll(
    anchor,
    panTargetCenter,
    farm,
    scrollPlayable,
    zoom
  );
  scroll = runMapTopPanBoundsCameraPasses(
    {
      alignMapTop: (panBounds, scrollY, z) =>
        grid.alignMapTopToPanBoundsInset(panBounds, scrollY, z, frac),
      getPanBounds: () => layoutIslandPanBounds(grid),
      getMapBounds: () => grid.getMapScreenBounds(),
      repositionWorld: () => undefined,
      scrollPlayable,
      panTargetCenter,
      zoom,
      mapTopFrac: frac,
    },
    scroll,
    passes
  );
  const synced = syncFarmMapTopCameraScroll(
    grid,
    () => layoutIslandPanBounds(grid),
    scroll.scrollY,
    zoom,
    frac
  );
  scroll = { ...scroll, scrollY: synced.scrollY };
  const panBounds = synced.panBounds;
  const mapMinY = grid.getMapScreenBounds().minY;
  const northTileTopY = grid.gridToMapScreen(0, 0).y;
  const mapCornerTopY = grid.gridToMapScreen(grid.size - 1, grid.size - 1).y;
  const footprintCenterY = grid.getFarmFootprintAabbCenterScreen().y;
  const mapTopScreenY = (mapMinY - scroll.scrollY) * zoom;
  const northTileScreenY = (northTileTopY - scroll.scrollY) * zoom;
  const mapCornerScreenY = (mapCornerTopY - scroll.scrollY) * zoom;
  const footprintCenterScreenY = (footprintCenterY - scroll.scrollY) * zoom;
  return {
    scroll,
    frac,
    ...measureMapTopAbovePanBoundsPx(mapMinY, panBounds, scroll.scrollY, zoom, frac),
    panBounds,
    mapTopScreenY,
    northTileScreenY,
    mapCornerScreenY,
    footprintCenterScreenY,
  };
}

describe('farm map top camera layout', () => {
  it('mapTopPanOffsetY shifts map layer sprites and footprint bounds together', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const gx = 5;
    const gy = 5;
    const baseBefore = grid.gridToScreen(gx, gy);
    const groundBefore = grid.gridToMapScreen(gx, gy);
    const footprintBefore = grid.getFarmFootprintScreenBounds().minY;
    const rhombusBefore = grid.getFarmSoilScreenRhombus().north.y;
    grid.mapTopPanOffsetY = 420;
    expect(grid.gridToScreen(gx, gy)).toEqual(baseBefore);
    expect(grid.gridToMapScreen(gx, gy).y).toBe(groundBefore.y + 420);
    expect(grid.getFarmFootprintScreenBounds().minY).toBe(footprintBefore + 420);
    expect(grid.getFarmSoilScreenRhombus().north.y).toBe(rhombusBefore + 420);
  });

  it('mapTopPanOffsetX includes pan-center bias and left-shift target', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);

    const pan = layoutIslandPanBounds(grid);
    grid.alignMapTopToPanBoundsInset(pan, 0, zoom);
    const visualCenter = grid.getVisualMapScreenBounds().centerX;
    const panCenter = (pan.minX + pan.maxX) / 2;
    const expectedOffset =
      panCenter - visualCenter - (pan.maxX - pan.minX) * FARM_MAP_LEFT_PAN_BOUNDS_FRAC;
    expect(grid.mapTopPanOffsetX).toBeCloseTo(expectedOffset, 6);
  });

  it('alignMapTopToPanBoundsInset shifts map and footprint X together', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const mapBefore = grid.getMapScreenBounds();
    const footprintBefore = grid.getFarmFootprintScreenBounds();

    const pan = layoutIslandPanBounds(grid);
    grid.alignMapTopToPanBoundsInset(pan, 0, zoom);
    const mapAfter = grid.getMapScreenBounds();
    const footprintAfter = grid.getFarmFootprintScreenBounds();
    const visualCenter = grid.getVisualMapScreenBounds().centerX;
    const panCenter = (pan.minX + pan.maxX) / 2;
    const expectedDx =
      panCenter - visualCenter - (pan.maxX - pan.minX) * FARM_MAP_LEFT_PAN_BOUNDS_FRAC;
    expect(mapAfter.minX - mapBefore.minX).toBeCloseTo(expectedDx, 6);
    expect(footprintAfter.minX - footprintBefore.minX).toBeCloseTo(expectedDx, 6);
  });

  it('worldToGrid round-trips cells inside and outside farm footprint', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runFullMapTopLayout(grid, 3);

    // Include both footprint cells and full-map cells outside footprint to guard offset drift.
    const probes = [
      { x: 4, y: 6 }, // soil
      { x: 3, y: 5 }, // path ring
      { x: 0, y: 0 }, // outside footprint
      { x: 19, y: 19 }, // outside footprint opposite corner
    ];
    for (const probe of probes) {
      const world = grid.gridToMapTileCenter(probe.x, probe.y);
      expect(grid.worldToGrid(world.x, world.y)).toEqual(probe);
    }
  });

  it('map layer applies visible left shift in screen-space', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const farm = layoutIslandPanBounds(grid);
    grid.alignMapTopToPanBoundsInset(farm, 0, zoom);
    const expectedShiftPx = getFarmMapLeftShiftScreenPx(
      farm.maxX - farm.minX,
      zoom,
      FARM_MAP_LEFT_PAN_BOUNDS_FRAC
    );
    const mapCenter = grid.getMapScreenBounds().centerX;
    const panCenter = (farm.minX + farm.maxX) / 2;
    const actualShiftPx = (panCenter - mapCenter) * zoom;
    expect(actualShiftPx).toBeCloseTo(expectedShiftPx, 4);
  });

  it('single alignMapTop places virtual map top on pan-bounds world target', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const scrollY = 0;
    const pan = layoutIslandPanBounds(grid);
    grid.alignMapTopToPanBoundsInset(pan, scrollY, zoom);
    const mapMinY = grid.getMapScreenBounds().minY;
    const visualMinY = grid.getVisualMapScreenBounds().minY;
    const targetWorldY =
      pan.minY + (pan.maxY - pan.minY) * FARM_MAP_TOP_PAN_BOUNDS_FRAC;
    expect(mapMinY).toBeCloseTo(targetWorldY, 1);
    expect(visualMinY).not.toBeCloseTo(targetWorldY, 1);
    expect(grid.mapTopPanOffsetY).not.toBe(0);
  });

  it('syncFarmMapTopCameraScroll zeros mapTopErrorY', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const viewport = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter({
      playableLeft: viewport.playableLeft,
      playableTop: viewport.playableTop,
      playableRight: viewport.playableRight,
      playableBottom: viewport.playableBottom,
    });
    const panTargetCenter = getPlayableBandPanBoundsCenter({
      playableLeft: viewport.playableLeft,
      playableTop: viewport.playableTop,
      playableRight: viewport.playableRight,
      playableBottom: viewport.playableBottom,
    });
    const farm = layoutIslandPanBounds(grid);
    const scrollIn = computeCenteredFarmCameraScroll(
      farmFootprintCenter(farm),
      panTargetCenter,
      farm,
      scrollPlayable,
      zoom
    );
    const synced = syncFarmMapTopCameraScroll(
      grid,
      () => layoutIslandPanBounds(grid),
      scrollIn.scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    const v = grid.getMapScreenBounds().minY;
    const m = measureMapTopAbovePanBoundsPx(
      v,
      synced.panBounds,
      synced.scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    expect(Math.abs(m.mapTopErrorY)).toBeLessThan(2);
  });

  it('manual scroll after align zeros mapTopErrorY', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const pan = layoutIslandPanBounds(grid);
    const scrollY0 = 120;
    grid.alignMapTopToPanBoundsInset(pan, scrollY0, zoom, FARM_MAP_TOP_PAN_BOUNDS_FRAC);
    const v = grid.getMapScreenBounds().minY;
    const target = getFarmMapTopTargetScreenYFromPanBounds(
      pan,
      scrollY0,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    const scrollY1 = v - target / zoom;
    const m = measureMapTopAbovePanBoundsPx(
      v,
      pan,
      scrollY1,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    expect(Math.abs(m.mapTopErrorY)).toBeLessThan(2);
  });

  it('decreasing pan-bounds frac raises map top; footprint moves with map layer', () => {
    const fracHigh = 0.465;
    const fracLow = 0.065;
    const gridHigh = new GridSystem();
    gridHigh.generatePlaceholderMap();
    const high = runFullMapTopLayout(gridHigh, 3, fracHigh);

    const gridLow = new GridSystem();
    gridLow.generatePlaceholderMap();
    const low = runFullMapTopLayout(gridLow, 3, fracLow);

    expect(Math.abs(high.mapTopErrorY)).toBeLessThan(2);
    expect(Math.abs(low.mapTopErrorY)).toBeLessThan(2);
    expect(low.mapTopScreenY).toBeLessThan(high.mapTopScreenY);
    expect(low.mapCornerScreenY).toBeLessThan(high.mapCornerScreenY);

    const panH = (high.panBounds.maxY - high.panBounds.minY) * zoom;
    const minRaisePx = (fracHigh - fracLow) * panH * 0.5;
    expect(high.mapTopScreenY - low.mapTopScreenY).toBeGreaterThan(minRaisePx);
    expect(high.mapCornerScreenY - low.mapCornerScreenY).toBeGreaterThan(minRaisePx);

    const footprintDelta = low.footprintCenterScreenY - high.footprintCenterScreenY;
    const mapCornerDelta = low.mapCornerScreenY - high.mapCornerScreenY;
    const northDelta = low.northTileScreenY - high.northTileScreenY;
    expect(footprintDelta).toBeLessThan(-minRaisePx * 0.5);
    expect(footprintDelta).toBeCloseTo(mapCornerDelta, 0);
    expect(northDelta).toBeCloseTo(mapCornerDelta, 0);
  });

  it('footprint screen AABB stays inside full map AABB after pan-bounds layout', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const result = runFullMapTopLayout(grid, 3);
    const map = grid.getMapScreenBounds();
    const fp = grid.getFarmFootprintScreenBounds();
    const eps = 0.5;
    expect(fp.minX).toBeGreaterThanOrEqual(map.minX - eps);
    expect(fp.minY).toBeGreaterThanOrEqual(map.minY - eps);
    expect(fp.maxX).toBeLessThanOrEqual(map.maxX + eps);
    expect(fp.maxY).toBeLessThanOrEqual(map.maxY + eps);
    const scrollY = result.scroll.scrollY;
    const fpScreenMinY = (fp.minY - scrollY) * zoom;
    const mapScreenMinY = (map.minY - scrollY) * zoom;
    expect(fpScreenMinY).toBeGreaterThanOrEqual(mapScreenMinY - eps);
    expect(Math.abs(result.mapTopErrorY)).toBeLessThan(2);
  });

  it('at default frac map top sits down orange pan height by FARM_MAP_TOP_PAN_BOUNDS_FRAC', () => {
    expect(FARM_MAP_TOP_PAN_BOUNDS_FRAC).toBe(0.165);
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const result = runFullMapTopLayout(grid, 3);
    const panH = (result.panBounds.maxY - result.panBounds.minY) * zoom;
    const expectedAbove = -FARM_MAP_TOP_PAN_BOUNDS_FRAC * panH;

    expect(Math.abs(result.mapTopErrorY)).toBeLessThan(2);
    expect(result.abovePanPx).toBeCloseTo(expectedAbove, 0);
    expect(result.mapTopScreenY).toBeCloseTo(
      result.panTopScreenY + FARM_MAP_TOP_PAN_BOUNDS_FRAC * panH,
      2
    );
    const target = getFarmMapTopTargetScreenYFromPanBounds(
      result.panBounds,
      result.scroll.scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    expect(result.mapTopScreenY).toBeCloseTo(target, 1);
  });
});

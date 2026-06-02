import { describe, expect, it } from 'vitest';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { FARM_ISLAND_RING_MARGIN } from '../../src/farmIslandLayout';
import {
  runMapTopPanBoundsCameraPasses,
  syncFarmMapTopCameraScroll,
} from '../../src/farmMapTopCamera';
import {
  computeCenteredFarmCameraScroll,
  farmFootprintCenter,
} from '../../src/farmCameraScroll';
import {
  computeFarmIslandScreenBounds,
  FARM_ISLAND_SCALE_BOOST,
} from '../../src/farmIslandLayout';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getPlayableBandPanBoundsCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import { TILE_HEIGHT, TILE_WIDTH } from '../../src/utils/iso';

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

function runMapTopLayout(grid: GridSystem) {
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
  let scroll = computeCenteredFarmCameraScroll(
    farmFootprintCenter(farm),
    panTargetCenter,
    farm,
    scrollPlayable,
    zoom
  );
  scroll = runMapTopPanBoundsCameraPasses(
    {
      alignMapTop: (panBounds, scrollY, z) =>
        grid.alignMapTopToPanBoundsInset(panBounds, scrollY, z),
      getPanBounds: () => layoutIslandPanBounds(grid),
      getMapBounds: () => grid.getMapScreenBounds(),
      repositionWorld: () => undefined,
      scrollPlayable,
      panTargetCenter,
      zoom,
    },
    scroll,
    3
  );
  scroll = syncFarmMapTopCameraScroll(
    grid,
    () => layoutIslandPanBounds(grid),
    scroll.scrollY,
    zoom,
    FARM_MAP_TOP_PAN_BOUNDS_FRAC
  ).scrollY;
  syncFarmMapTopCameraScroll(
    grid,
    () => layoutIslandPanBounds(grid),
    scroll,
    zoom,
    FARM_MAP_TOP_PAN_BOUNDS_FRAC
  );
}

/** Expected 8×8 planting soil on the 20×20 placeholder map (inclusive). */
const EXPECTED_SOIL_GRID = {
  minX: 4,
  maxX: 11,
  minY: 6,
  maxY: 13,
} as const;

function expectSoilGridDocumented() {
  expect(FARM_SOIL_BOUNDS).toEqual(EXPECTED_SOIL_GRID);
}

function expectAlignmentWithin2px(grid: GridSystem) {
  const m = grid.measureSoilFootprintAlignment();
  expect(m.soilGridRange).toEqual(EXPECTED_SOIL_GRID);
  expect(m.centerAlignErrorPx).toBeLessThanOrEqual(2);
  expect(m.maxTileOutsideAabbPx).toBeLessThanOrEqual(2);
  expect(m.soilFootprintAlignError).toBeLessThanOrEqual(2);
}

function expectedFootprintTopFromNorthApex(
  footprintNorth: { x: number; y: number },
  anchorGx: number,
  anchorGy: number,
  gx: number,
  gy: number
) {
  const dx = gx - anchorGx;
  const dy = gy - anchorGy;
  return {
    x: footprintNorth.x + (dx - dy) * (TILE_WIDTH / 2),
    y: footprintNorth.y + (dx + dy) * (TILE_HEIGHT / 2),
  };
}


describe('farm soil vs cyan footprint alignment', () => {
  it('documents FARM_SOIL_BOUNDS as cols 4–11 rows 6–13 (8×8)', () => {
    expectSoilGridDocumented();
  });

  it('every soil tile top lies inside footprint rhombus AABB (≤2px)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    expectAlignmentWithin2px(grid);
  });

  it('footprint rhombus center ≈ soil cluster center (≤2px)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    const m = grid.measureSoilFootprintAlignment();
    expect(m.centerAlignErrorPx).toBeLessThanOrEqual(2);
  });

  it('mapTopPanOffsetY without sprite reposition would desync cached Y from grid', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const pan = layoutIslandPanBounds(grid);
    const staleY = grid.gridToMapScreen(FARM_SOIL_BOUNDS.minX, FARM_SOIL_BOUNDS.minY).y;
    grid.alignMapTopToPanBoundsInset(pan, 0, zoom);
    const liveY = grid.gridToMapScreen(FARM_SOIL_BOUNDS.minX, FARM_SOIL_BOUNDS.minY).y;
    expect(grid.mapTopPanOffsetY).not.toBe(0);
    expect(staleY).not.toBeCloseTo(liveY, 0.01);
    const footNorth = grid.getFarmFootprintScreenRhombus().north.y;
    expect(footNorth).toBeCloseTo(liveY - TILE_HEIGHT, 0.01);
    expect(staleY).not.toBeCloseTo(footNorth, 0.5);
  });

  it('footprint rhombus north apex matches path-ring tile top vertex', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const m = FARM_ISLAND_RING_MARGIN;
    const anchorGx = FARM_SOIL_BOUNDS.minX - m;
    const anchorGy = FARM_SOIL_BOUNDS.minY - m;
    const footprint = grid.getFarmFootprintScreenRhombus();
    const tileTop = grid.gridToMapScreen(anchorGx, anchorGy);
    expect(footprint.north.x).toBeCloseTo(tileTop.x, 0.01);
    expect(footprint.north.y).toBeCloseTo(tileTop.y, 0.01);
  });

  it('8×8 soil rhombus shares center with 10×10 footprint rhombus', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const soil = grid.getFarmSoilScreenRhombus();
    const footprint = grid.getFarmFootprintScreenRhombus();
    expect(soil.center.x).toBeCloseTo(footprint.center.x, 0.01);
    expect(soil.center.y).toBeCloseTo(footprint.center.y, 0.01);
  });

  it('soil cluster is one iso row inside footprint north apex', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const soilNorth = grid.gridToMapScreen(
      FARM_SOIL_BOUNDS.minX,
      FARM_SOIL_BOUNDS.minY
    );
    const footNorth = grid.getFarmFootprintScreenRhombus().north;
    expect(soilNorth.y - footNorth.y).toBeCloseTo(TILE_HEIGHT, 0.01);
    expect(soilNorth.x - footNorth.x).toBeCloseTo(0, 0.01);
  });

  it('soil patch center matches gridToMapTileCenter at fractional soil centroid', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const patch = grid.getFarmSoilPatchCenterScreen();
    const soilRhombus = grid.getFarmSoilScreenRhombus();
    expect(patch.x).toBeCloseTo(soilRhombus.center.x, 0.01);
    expect(patch.y).toBeCloseTo(soilRhombus.center.y, 0.01);
  });

  it('after map-top pan offset, soil tiles still match footprint rhombus', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    expect(grid.mapTopPanOffsetY).not.toBe(0);

    const m = FARM_ISLAND_RING_MARGIN;
    const footprint = grid.getFarmFootprintScreenRhombus();
    const tileTop = grid.gridToMapScreen(
      FARM_SOIL_BOUNDS.minX - m,
      FARM_SOIL_BOUNDS.minY - m
    );
    expect(footprint.north.x).toBeCloseTo(tileTop.x, 0.01);
    expect(footprint.north.y).toBeCloseTo(tileTop.y, 0.01);

    const soil = grid.getFarmSoilScreenRhombus();
    expect(soil.center.x).toBeCloseTo(footprint.center.x, 0.01);
    expect(soil.center.y).toBeCloseTo(footprint.center.y, 0.01);
  });

  it('footprint screen center ≈ soil center after full layout (≤2px)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    expectAlignmentWithin2px(grid);
  });

  it('soil tile centers snap to footprint-projected centers (≤1px)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    const ring = FARM_ISLAND_RING_MARGIN;
    const anchorGx = FARM_SOIL_BOUNDS.minX - ring;
    const anchorGy = FARM_SOIL_BOUNDS.minY - ring;
    const footprint = grid.getFarmFootprintScreenRhombus(ring);
    for (let gy = FARM_SOIL_BOUNDS.minY; gy <= FARM_SOIL_BOUNDS.maxY; gy++) {
      for (let gx = FARM_SOIL_BOUNDS.minX; gx <= FARM_SOIL_BOUNDS.maxX; gx++) {
        const expectedTop = expectedFootprintTopFromNorthApex(
          footprint.north,
          anchorGx,
          anchorGy,
          gx,
          gy
        );
        const expectedCenter = { x: expectedTop.x, y: expectedTop.y + TILE_HEIGHT / 2 };
        const actualCenter = grid.gridToMapTileCenter(gx, gy);
        expect(Math.hypot(actualCenter.x - expectedCenter.x, actualCenter.y - expectedCenter.y))
          .toBeLessThanOrEqual(1);
      }
    }
  });

  it('path ring tile tops align with footprint-projected tops (≤1px)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    runMapTopLayout(grid);
    const ring = FARM_ISLAND_RING_MARGIN;
    const anchorGx = FARM_SOIL_BOUNDS.minX - ring;
    const anchorGy = FARM_SOIL_BOUNDS.minY - ring;
    const maxX = FARM_SOIL_BOUNDS.maxX + ring;
    const maxY = FARM_SOIL_BOUNDS.maxY + ring;
    const footprint = grid.getFarmFootprintScreenRhombus(ring);
    for (let gy = anchorGy; gy <= maxY; gy++) {
      for (let gx = anchorGx; gx <= maxX; gx++) {
        const isRingCell =
          gx === anchorGx || gx === maxX || gy === anchorGy || gy === maxY;
        if (!isRingCell) continue;
        const expectedTop = expectedFootprintTopFromNorthApex(
          footprint.north,
          anchorGx,
          anchorGy,
          gx,
          gy
        );
        const actualTop = grid.gridToMapScreen(gx, gy);
        expect(Math.hypot(actualTop.x - expectedTop.x, actualTop.y - expectedTop.y))
          .toBeLessThanOrEqual(1);
      }
    }
  });

});

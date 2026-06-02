import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_MAP_TOP_INSET_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenY,
  getFarmMapTopTargetScreenYFromPanBounds,
  getPlayableBandPanBoundsCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import {
  computeCenteredFarmCameraScroll,
  computeFarmCameraScrollLimits,
  farmFootprintCenter,
} from '../../src/farmCameraScroll';
import { computeFarmIslandScreenBounds, FARM_ISLAND_SCALE_BOOST } from '../../src/farmIslandLayout';

describe('farm grid + camera horizontal centering', () => {
  const viewW = 390;
  const viewH = 844;
  const padX = 10;
  const padY = 10;
  const zoom = 1.7;

  it('centerInViewport places footprint rhombus center at HUD-balanced target on X', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    grid.centerInViewport(viewW, viewH, padX, padY);
    const center = grid.getFarmFootprintScreenRhombus().center;
    expect(center.x).toBeCloseTo(layout.centerX, 1);
    expect(center.y).toBeCloseTo(layout.centerY, 1);
  });

  it('centerInViewport + alignMapTop aligns map top at configured inset', () => {
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const playableH = layout.playableBottom - layout.playableTop;
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    grid.alignMapTopToPlayableInset(layout, 0, 1, FARM_MAP_TOP_INSET_FRAC);
    const screenTop = grid.getMapScreenBounds().minY;
    expect(screenTop).toBeCloseTo(getFarmMapTopTargetScreenY(layout.playableTop, playableH), 1);
  });

  it('alignMapTopToPlayableInset: smaller inset raises map (smaller world minY at scroll 0)', () => {
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const playableH = layout.playableBottom - layout.playableTop;

    const gridLoose = new GridSystem();
    gridLoose.generatePlaceholderMap();
    gridLoose.centerInViewport(viewW, viewH, padX, padY);
    gridLoose.alignMapTopToPlayableInset(layout, 0, 1, 0.15);
    const looseMinY = gridLoose.getMapScreenBounds().minY;

    const gridTight = new GridSystem();
    gridTight.generatePlaceholderMap();
    gridTight.centerInViewport(viewW, viewH, padX, padY);
    gridTight.alignMapTopToPlayableInset(layout, 0, 1, 0);
    const tightMinY = gridTight.getMapScreenBounds().minY;

    expect(tightMinY).toBeLessThan(looseMinY);
    expect(looseMinY).toBeCloseTo(getFarmMapTopTargetScreenY(layout.playableTop, playableH, 0.15), 1);
    expect(tightMinY).toBeCloseTo(getFarmMapTopTargetScreenY(layout.playableTop, playableH, 0), 1);
  });

  it('alignMapTopToPlayableInset: corner and footprint shift equal screen delta', () => {
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const scrollY = 50;
    const camZoom = 1.7;
    const cornerScreenY = (grid: GridSystem, gx: number, gy: number) => {
      const topY = grid.gridToScreen(gx, gy).y;
      return (topY - scrollY) * camZoom;
    };
    const footprintScreenY = (grid: GridSystem) => {
      const fp = grid.getFarmFootprintAabbCenterScreen();
      return (fp.y - scrollY) * camZoom;
    };

    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    grid.alignMapTopToPlayableInset(layout, scrollY, camZoom, 0.15);
    const corner15 = cornerScreenY(grid, 0, 0);
    const corner19 = cornerScreenY(grid, grid.size - 1, grid.size - 1);
    const foot15 = footprintScreenY(grid);

    grid.alignMapTopToPlayableInset(layout, scrollY, camZoom, 0);
    const corner0 = cornerScreenY(grid, 0, 0);
    const corner19After = cornerScreenY(grid, grid.size - 1, grid.size - 1);
    const foot0 = footprintScreenY(grid);

    const cornerDelta = corner0 - corner15;
    const corner19Delta = corner19After - corner19;
    const footDelta = foot0 - foot15;
    expect(corner0).toBeLessThan(corner15);
    expect(corner19After).toBeLessThan(corner19);
    expect(foot0).toBeLessThan(foot15);
    expect(cornerDelta).toBeCloseTo(footDelta, 1);
    expect(corner19Delta).toBeCloseTo(footDelta, 1);
  });

  it('alignMapTopToPlayableInset: smaller inset raises on-screen map top when scrolled/zoomed', () => {
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const playableH = layout.playableBottom - layout.playableTop;
    const scrollY = 80;
    const camZoom = 1.7;

    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    grid.alignMapTopToPlayableInset(layout, scrollY, camZoom, 0.15);
    const screen15 = (grid.getMapScreenBounds().minY - scrollY) * camZoom;
    expect(screen15).toBeCloseTo(
      getFarmMapTopTargetScreenY(layout.playableTop, playableH, 0.15),
      1
    );

    grid.alignMapTopToPlayableInset(layout, scrollY, camZoom, 0);
    const screen0 = (grid.getMapScreenBounds().minY - scrollY) * camZoom;
    expect(screen0).toBeLessThan(screen15);
    expect(screen0).toBeCloseTo(
      getFarmMapTopTargetScreenY(layout.playableTop, playableH, 0),
      1
    );
  });

  it('FARM_MAP_TOP_INSET_FRAC -0.5 targets map 50% above playable top', () => {
    expect(FARM_MAP_TOP_INSET_FRAC).toBe(-0.5);
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const playableH = layout.playableBottom - layout.playableTop;
    const targetRaised = getFarmMapTopTargetScreenY(layout.playableTop, playableH);
    const targetFlush = getFarmMapTopTargetScreenY(layout.playableTop, playableH, 0);
    expect(targetRaised).toBeCloseTo(layout.playableTop - playableH * 0.5, 1);
    expect(targetRaised).toBeLessThan(targetFlush);
  });

  it('alignMapTopToPanBoundsInset places map top per pan-bounds frac', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, padX, padY);
    const island = computeFarmIslandScreenBounds(
      grid.getFarmSoilScreenRhombus(),
      2048,
      2048,
      { scaleBoost: FARM_ISLAND_SCALE_BOOST }
    );
    const scrollY = 0;
    const zoom = 1;
    grid.alignMapTopToPanBoundsInset(island, scrollY, zoom, FARM_MAP_TOP_PAN_BOUNDS_FRAC);
    const mapMinY = grid.getMapScreenBounds().minY;
    const targetWorldY =
      island.minY + (island.maxY - island.minY) * FARM_MAP_TOP_PAN_BOUNDS_FRAC;
    expect(mapMinY).toBeCloseTo(targetWorldY, 1);
    const screenTop = (mapMinY - scrollY) * zoom;
    const target = getFarmMapTopTargetScreenYFromPanBounds(island, scrollY, zoom);
    expect(screenTop).toBeCloseTo(target, 1);
  });

  it('initial scroll places island AABB center on pan-bounds target at MIN zoom', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    grid.centerInViewport(viewW, viewH, padX, padY);
    const island = computeFarmIslandScreenBounds(grid.getFarmSoilScreenRhombus(), 512, 512);
    const anchor = farmFootprintCenter(island);
    const geomPlayable = {
      playableLeft: layout.playableLeft,
      playableTop: layout.playableTop,
      playableRight: layout.playableRight,
      playableBottom: layout.playableBottom,
    };
    const panCenter = getPlayableBandPanBoundsCenter(geomPlayable);
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(geomPlayable);
    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      panCenter,
      island,
      scrollPlayable,
      zoom
    );
    const limits = computeFarmCameraScrollLimits(island, scrollPlayable, zoom);
    expect(limits.x.oversize).toBe(true);
    const screenX = (anchor.x - scroll.scrollX) * zoom;
    expect(screenX).toBeCloseTo(panCenter.x, 1);
  });
});

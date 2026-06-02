import type { GridSystem } from './systems/GridSystem';
import {
  computeFarmCameraScrollForMapTopAndPanCenter,
  farmFootprintCenter,
  type FarmFootprintBounds,
  type PlayableBandRect,
} from './farmCameraScroll';
import {
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenYFromPanBounds,
} from './ui/hudLayout';

/** Hooks for map-top + pan-bounds camera layout (FarmScene or unit tests). */
export type MapTopPanBoundsLayoutHooks = {
  alignMapTop: (panBounds: FarmFootprintBounds, scrollY: number, zoom: number) => void;
  getPanBounds: () => FarmFootprintBounds;
  /** Full map top including {@link mapTopPanOffsetY}; drives scroll Y. */
  getMapBounds: () => { minY: number };
  repositionWorld: () => void;
  scrollPlayable: PlayableBandRect;
  panTargetCenter: { x: number; y: number };
  zoom: number;
  mapTopFrac?: number;
};

/**
 * Per pass: reposition island → align map top offset → scroll (pan bounds read after align).
 * Scroll uses {@link getMapScreenBounds} so frac shifts the virtual map layer on screen.
 */
export function runMapTopPanBoundsCameraPasses(
  hooks: MapTopPanBoundsLayoutHooks,
  scroll: { scrollX: number; scrollY: number },
  passes = 3
): { scrollX: number; scrollY: number } {
  let scrollX = scroll.scrollX;
  let scrollY = scroll.scrollY;
  const frac = hooks.mapTopFrac ?? FARM_MAP_TOP_PAN_BOUNDS_FRAC;
  for (let pass = 0; pass < passes; pass++) {
    hooks.repositionWorld();
    let panForTop = hooks.getPanBounds();
    hooks.alignMapTop(panForTop, scrollY, hooks.zoom);
    panForTop = hooks.getPanBounds();
    hooks.alignMapTop(panForTop, scrollY, hooks.zoom);
    hooks.repositionWorld();
    const farmAfter = hooks.getPanBounds();
    const visualMapMinY = hooks.getMapBounds().minY;
    const mapTopTargetScreenY = getFarmMapTopTargetScreenYFromPanBounds(
      panForTop,
      scrollY,
      hooks.zoom,
      frac
    );
    const next = computeFarmCameraScrollForMapTopAndPanCenter(
      visualMapMinY,
      farmFootprintCenter(farmAfter),
      farmAfter,
      hooks.scrollPlayable,
      mapTopTargetScreenY,
      hooks.panTargetCenter,
      hooks.zoom
    );
    scrollX = next.scrollX;
    scrollY = next.scrollY;
  }
  return { scrollX, scrollY };
}

/**
 * After pan bounds shift from {@link GridSystem.alignMapTopToPanBoundsInset}, re-align and
 * return scroll Y plus the pan bounds used for the screen target (do not re-fetch pan for metrics).
 */
export function syncFarmMapTopCameraScroll(
  grid: GridSystem,
  getPanBounds: () => FarmFootprintBounds,
  scrollY: number,
  zoom: number,
  frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
): { scrollY: number; panBounds: FarmFootprintBounds } {
  let pan = getPanBounds();
  grid.alignMapTopToPanBoundsInset(pan, scrollY, zoom, frac);
  pan = getPanBounds();
  grid.alignMapTopToPanBoundsInset(pan, scrollY, zoom, frac);
  let scrollYOut = scrollY;
  for (let i = 0; i < 3; i++) {
    const mapMinY = grid.getMapScreenBounds().minY;
    const targetScreenY = getFarmMapTopTargetScreenYFromPanBounds(
      pan,
      scrollYOut,
      zoom,
      frac
    );
    scrollYOut = mapMinY - targetScreenY / zoom;
  }
  return { scrollY: scrollYOut, panBounds: pan };
}

/** @deprecated Use {@link syncFarmMapTopCameraScroll} — returns scroll Y only. */
export function finalizeFarmMapTopCameraScrollY(
  grid: GridSystem,
  getPanBounds: () => FarmFootprintBounds,
  scrollY: number,
  zoom: number,
  frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
): number {
  return syncFarmMapTopCameraScroll(grid, getPanBounds, scrollY, zoom, frac).scrollY;
}

/** Screen-space map top minus pan-bounds top (positive = map above orange pan top). */
export function measureMapTopAbovePanBoundsPx(
  mapMinY: number,
  panBounds: FarmFootprintBounds,
  scrollY: number,
  zoom: number,
  frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
): { mapTopScreenY: number; panTopScreenY: number; abovePanPx: number; mapTopErrorY: number } {
  const mapTopScreenY = (mapMinY - scrollY) * zoom;
  const panTopScreenY = (panBounds.minY - scrollY) * zoom;
  const mapTopTargetScreenY = getFarmMapTopTargetScreenYFromPanBounds(
    panBounds,
    scrollY,
    zoom,
    frac
  );
  return {
    mapTopScreenY,
    panTopScreenY,
    abovePanPx: panTopScreenY - mapTopScreenY,
    mapTopErrorY: mapTopScreenY - mapTopTargetScreenY,
  };
}

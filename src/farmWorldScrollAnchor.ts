import type Phaser from 'phaser';
import {
  MAP_CENTER_WORLD_BASELINE_X_AT_REF,
  MAP_CENTER_WORLD_BASELINE_Y_AT_REF,
  getFarmMapCenterScreenOffsets,
  getFarmMapCenterWorldOffsets,
} from './config/farmCameraConfig';
import { getFarmForceSpawnWorld } from './config/gameConfig';
import {
  FARM_PLAYER_SPAWN_GX,
  FARM_PLAYER_SPAWN_GY,
} from './config/gameConfig';
import type { GridSystem } from './systems/GridSystem';

/** World tolerance (px) for {@link enforceFarmMapCenterWorldAnchor}. */
export const FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX = 0.5;

export type FarmMapCenterWorldEnforceResult = {
  target: { x: number; y: number };
  /** Tile ({@link FARM_PLAYER_SPAWN_GX}, {@link FARM_PLAYER_SPAWN_GY}) center on the map layer. */
  spawnWorld: { x: number; y: number };
  /** @deprecated Alias for {@link spawnWorld}. */
  mapCenter: { x: number; y: number };
  spawnWorldErrorX: number;
  spawnWorldErrorY: number;
  /** @deprecated Alias for {@link spawnWorldErrorX}. */
  errorX: number;
  /** @deprecated Alias for {@link spawnWorldErrorY}. */
  errorY: number;
  scrollX: number;
  scrollY: number;
};

export type FarmScrollZeroBakeResult = {
  scrollX: number;
  scrollY: number;
  /**
   * Layout bake anchor at scroll (0,0): {@link getFarmScrollZeroLayoutAnchor} after bake.
   * Playable map center (farmer spawn) at {@link getFarmMapCenterWorldTargetAtDefaultScroll}.
   */
  layoutAnchorAtOrigin: { x: number; y: number };
  /** Same as layoutAnchorAtOrigin after map-center bake (diagnostic alias). */
  mapCenterAtOrigin: { x: number; y: number };
};

/**
 * Interpolated map-center screen target (pixels) at scroll (0,0).
 * Base: viewport optical center `(viewW/2, viewH/2)` plus zoom-keyframe offsets
 * ({@link getFarmMapCenterScreenOffsets} in {@link farmCameraConfig}).
 */
export function getFarmMapCenterScreenTargetAtScrollZero(
  viewW: number,
  viewH: number,
  zoom: number
): { x: number; y: number } {
  const off = getFarmMapCenterScreenOffsets(zoom);
  return { x: viewW / 2 + off.x, y: viewH / 2 + off.y };
}

/**
 * Playable map center (farmer spawn) world at the 1.9 bake on the reference viewport (390×844).
 * Zoom keyframe {@link getFarmMapCenterWorldOffsets} are art deltas from this point, not optical viewW/(2×zoom).
 */
export function getFarmMapCenterWorldBaselineAtDefaultZoom(
  _viewW: number,
  _viewH: number
): { x: number; y: number } {
  return {
    x: MAP_CENTER_WORLD_BASELINE_X_AT_REF,
    y: MAP_CENTER_WORLD_BASELINE_Y_AT_REF,
  };
}

/**
 * Expected playable map center world at `zoom`: 1.9 baseline + interpolated world offset keyframes (ΔW(zoom) only).
 * Independent of scroll; scroll adjustment for screen target happens on zoom, not pan.
 */
export function getFarmMapCenterWorldTargetAtDefaultScroll(
  viewW: number,
  viewH: number,
  zoom: number
): { x: number; y: number } {
  const forced = getFarmForceSpawnWorld();
  if (forced) return forced;
  const baseline = getFarmMapCenterWorldBaselineAtDefaultZoom(viewW, viewH);
  const worldOff = getFarmMapCenterWorldOffsets(viewW, viewH, zoom);
  return {
    x: baseline.x + worldOff.x,
    y: baseline.y + worldOff.y,
  };
}

/** Delta to shift farm world when zoom moves from `fromZoom` to `toZoom`. */
export function getFarmMapCenterWorldOffsetDelta(
  viewW: number,
  viewH: number,
  fromZoom: number,
  toZoom: number
): { dx: number; dy: number } {
  const from = getFarmMapCenterWorldOffsets(viewW, viewH, fromZoom);
  const to = getFarmMapCenterWorldOffsets(viewW, viewH, toZoom);
  return { dx: to.x - from.x, dy: to.y - from.y };
}

/** Shift grid (+ optional island) by map-center world-offset delta between zoom levels. */
export function applyFarmMapCenterWorldOffsetDelta(
  grid: GridSystem,
  dx: number,
  dy: number,
  island?: Phaser.GameObjects.Image | null
): void {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return;
  }
  grid.shiftFarmWorldBy(dx, dy);
  if (island) {
    island.x += dx;
    island.y += dy;
  }
}

/**
 * Scroll that places `mapCenterWorld` on the interpolated screen target at `zoom`.
 * Inverse of `screen = (world − scroll) × zoom`.
 */
export function computeScrollForMapCenterScreenTarget(
  mapCenterWorld: { x: number; y: number },
  viewW: number,
  viewH: number,
  zoom: number
): { scrollX: number; scrollY: number } {
  const screen = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, zoom);
  return {
    scrollX: mapCenterWorld.x - screen.x / zoom,
    scrollY: mapCenterWorld.y - screen.y / zoom,
  };
}

/** @deprecated Alias for {@link getFarmMapCenterWorldTargetAtDefaultScroll}. */
export function getFarmMapCenterWorldTargetAtScrollZero(
  viewW: number,
  viewH: number,
  zoom: number
): { x: number; y: number } {
  return getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, zoom);
}

/**
 * Scroll-zero layout anchor: {@link GridSystem.getFarmPlayableMapCenterScreen} (farmer spawn /
 * visual center), not the 20×20 corner-tile AABB centroid.
 */
export function getFarmScrollZeroLayoutAnchor(grid: GridSystem): { x: number; y: number } {
  return grid.getFarmPlayableMapCenterScreen();
}

/**
 * Bake camera scroll into farm world coordinates so scroll (0,0) shows the same view.
 * Phaser: screen = (world − scroll) × zoom ⇒ world' = world − scroll, scroll' = 0.
 * Shifts by the full scroll delta so layout anchors move with {@link GridSystem.shiftFarmWorldBy}.
 * Island art must move with the grid or pan-bounds drift from the map layer.
 */
export function applyFarmCameraScrollZeroAnchor(
  grid: GridSystem,
  scrollX: number,
  scrollY: number,
  island?: Phaser.GameObjects.Image | null
): { scrollX: number; scrollY: number } {
  if (Math.abs(scrollX) < 1e-9 && Math.abs(scrollY) < 1e-9) {
    return { scrollX: 0, scrollY: 0 };
  }
  grid.shiftFarmWorldBy(-scrollX, -scrollY);
  if (island) {
    island.x -= scrollX;
    island.y -= scrollY;
  }
  return { scrollX: 0, scrollY: 0 };
}

/** Spawn tile (10,10) world on the map layer — same as {@link GridSystem.getFarmPlayerSpawnScreen}. */
export function getFarmSpawnTileWorld(grid: GridSystem): { x: number; y: number } {
  return grid.gridToMapTileCenter(FARM_PLAYER_SPAWN_GX, FARM_PLAYER_SPAWN_GY);
}

/**
 * Last layout step: analytical hard lock — tile (10,10) world equals
 * {@link getFarmMapCenterWorldTargetAtDefaultScroll} exactly (single origin solve, no iterative drift).
 * Scroll in the result is diagnostic only (screen HUD target); callers must not apply it when
 * preserving user pan — world anchor is independent of scroll.
 */
export function enforceFarmMapCenterWorldAnchor(
  grid: GridSystem,
  viewW: number,
  viewH: number,
  zoom: number,
  island?: Phaser.GameObjects.Image | null
): FarmMapCenterWorldEnforceResult {
  const target = getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, zoom);
  const originBeforeX = grid.originX;
  const originBeforeY = grid.originY;
  grid.setMapTileCenterWorld(
    FARM_PLAYER_SPAWN_GX,
    FARM_PLAYER_SPAWN_GY,
    target.x,
    target.y
  );
  const originDx = grid.originX - originBeforeX;
  const originDy = grid.originY - originBeforeY;
  if (island && (Math.abs(originDx) > 1e-9 || Math.abs(originDy) > 1e-9)) {
    island.x += originDx;
    island.y += originDy;
  }
  const spawnWorld = getFarmSpawnTileWorld(grid);
  const scroll = computeScrollForMapCenterScreenTarget(spawnWorld, viewW, viewH, zoom);
  const spawnWorldErrorX = spawnWorld.x - target.x;
  const spawnWorldErrorY = spawnWorld.y - target.y;
  return {
    target,
    spawnWorld,
    mapCenter: spawnWorld,
    spawnWorldErrorX,
    spawnWorldErrorY,
    errorX: spawnWorldErrorX,
    errorY: spawnWorldErrorY,
    scrollX: scroll.scrollX,
    scrollY: scroll.scrollY,
  };
}

/** Dev-only warning when map-center world drifts more than 2px from the zoom keyframe target. */
export function logFarmMapCenterWorldAnchorDeviation(
  enforced: FarmMapCenterWorldEnforceResult,
  zoom: number,
  viewW: number,
  viewH: number
): void {
  if (!import.meta.env.DEV) return;
  const err = Math.hypot(enforced.spawnWorldErrorX, enforced.spawnWorldErrorY);
  if (err <= 2) return;
  console.warn(
    '[farm-map-center] spawn tile (10,10) world deviates from target after enforce',
    {
      zoom,
      viewW,
      viewH,
      spawnWorld: enforced.spawnWorld,
      target: enforced.target,
      spawnWorldErrorX: enforced.spawnWorldErrorX,
      spawnWorldErrorY: enforced.spawnWorldErrorY,
      errPx: err,
    }
  );
}

/**
 * Single source of truth: shift the playable map center to
 * {@link getFarmMapCenterWorldTargetAtDefaultScroll} and return scroll that places it on the
 * interpolated screen target ({@link computeScrollForMapCenterScreenTarget}).
 */
export function syncFarmMapCenterWorldAndScrollAtZoom(
  grid: GridSystem,
  viewW: number,
  viewH: number,
  zoom: number,
  island?: Phaser.GameObjects.Image | null,
  clearMapTopPanOffset = true
): FarmScrollZeroBakeResult {
  if (clearMapTopPanOffset) {
    grid.mapTopPanOffsetX = 0;
    grid.mapTopPanOffsetY = 0;
  }
  const enforced = enforceFarmMapCenterWorldAnchor(grid, viewW, viewH, zoom, island);
  return {
    scrollX: enforced.scrollX,
    scrollY: enforced.scrollY,
    layoutAnchorAtOrigin: enforced.spawnWorld,
    mapCenterAtOrigin: enforced.spawnWorld,
  };
}

/**
 * Shift world so the playable map center sits at the zoom keyframe world target with default scroll (0,0).
 * Clears virtual map-layer offsets; island moves with the grid when provided.
 */
export function bakeFarmLayoutAnchorToViewportAtScrollZero(
  grid: GridSystem,
  viewW: number,
  viewH: number,
  zoom: number,
  island?: Phaser.GameObjects.Image | null
): FarmScrollZeroBakeResult {
  return syncFarmMapCenterWorldAndScrollAtZoom(grid, viewW, viewH, zoom, island);
}

/** @deprecated Use {@link bakeFarmLayoutAnchorToViewportAtScrollZero}. */
export function bakeFarmMapCenterToViewportAtScrollZero(
  grid: GridSystem,
  viewW: number,
  viewH: number,
  zoom: number,
  island?: Phaser.GameObjects.Image | null
): FarmScrollZeroBakeResult {
  return bakeFarmLayoutAnchorToViewportAtScrollZero(grid, viewW, viewH, zoom, island);
}

/**
 * After layout: clear map-layer offsets, bake playable map center to keyframe world,
 * and compute scroll so the center hits the zoom-keyframe screen target.
 */
export function finalizeFarmLayoutAtScrollZero(
  grid: GridSystem,
  viewW: number,
  viewH: number,
  zoom: number,
  island?: Phaser.GameObjects.Image | null
): FarmScrollZeroBakeResult {
  return syncFarmMapCenterWorldAndScrollAtZoom(grid, viewW, viewH, zoom, island);
}

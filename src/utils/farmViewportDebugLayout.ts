import type { FarmFootprintBounds } from '../farmCameraScroll';
import type { PlayableFarmViewportLayout } from '../ui/hudLayout';
import { GRID_SIZE } from '../config/gameConfig';
import { TILE_HEIGHT, TILE_WIDTH } from './iso';

/** Convert grid/map screen AABB to {@link FarmFootprintBounds}. */
export function screenBoundsToFootprint(bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): FarmFootprintBounds {
  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
  };
}

/** Logical iso map tile count (full GRID_SIZE × GRID_SIZE). */
export function farmMapDebugTileCount(gridSize = GRID_SIZE): number {
  return gridSize * gridSize;
}

/** Axis-aligned farm / island bounds in scene world space (pre-camera scroll). */
export function farmFootprintWorldRect(farm: FarmFootprintBounds): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: farm.minX,
    top: farm.minY,
    width: farm.maxX - farm.minX,
    height: farm.maxY - farm.minY,
  };
}

export function playableBandScreenRect(layout: PlayableFarmViewportLayout): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: layout.playableLeft,
    top: layout.playableTop,
    width: layout.playableRight - layout.playableLeft,
    height: layout.playableBottom - layout.playableTop,
  };
}

/** Horizontal grid step inside the playable band (iso tile width). */
export function farmViewportDebugGridStepX(): number {
  return TILE_WIDTH;
}

/** Vertical grid step inside the playable band (iso tile height). */
export function farmViewportDebugGridStepY(): number {
  return TILE_HEIGHT;
}

export function farmMapDebugLabel(
  rect: { width: number; height: number },
  tileCount: number,
  gridSize: number,
  stepX: number,
  stepY: number
): string {
  return (
    `map ${gridSize}×${gridSize} — ${Math.round(rect.width)}×${Math.round(rect.height)} ` +
    `(${tileCount} tiles, ${stepX}×${stepY} grid)`
  );
}

export function farmPanBoundsDebugLabel(rect: { width: number; height: number }): string {
  return `pan bounds — ${Math.round(rect.width)}×${Math.round(rect.height)} (camera scroll clamp)`;
}

export function farmFootprintDebugLabel(rect: { width: number; height: number }): string {
  return `footprint — ${Math.round(rect.width)}×${Math.round(rect.height)} (soil + path ring)`;
}

/** Camera-visible world AABB from scroll, zoom, and viewport size. */
export function farmCameraVisibleWorldRect(
  scrollX: number,
  scrollY: number,
  zoom: number,
  viewW: number,
  viewH: number
): FarmFootprintBounds {
  const safeZoom = zoom > 0 ? zoom : 1;
  return {
    minX: scrollX,
    minY: scrollY,
    maxX: scrollX + viewW / safeZoom,
    maxY: scrollY + viewH / safeZoom,
  };
}

/** True when any part of the camera view lies outside `outer` on an axis. */
export function farmViewportExtendsBeyondBounds(
  visible: FarmFootprintBounds,
  outer: FarmFootprintBounds
): boolean {
  return (
    visible.minX < outer.minX - 0.5 ||
    visible.minY < outer.minY - 0.5 ||
    visible.maxX > outer.maxX + 0.5 ||
    visible.maxY > outer.maxY + 0.5
  );
}

export function farmMapWorldEndsDebugLabel(): string {
  return 'WORLD ENDS — map 20×20 outer edge';
}

export function farmBackgroundOnlyHudLabel(
  beyond: 'map' | 'pan' | 'map+pan'
): string {
  if (beyond === 'map+pan') {
    return 'background-only zone visible (outside map + outside pan bounds)';
  }
  if (beyond === 'pan') {
    return 'outside pan bounds (island art still in view)';
  }
  return 'background-only zone (outside map — ui_background only)';
}

/** Minimal camera fields for world ↔ screen (matches Phaser main-camera rendering). */
export type FarmCameraScreenTransform = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  x?: number;
  y?: number;
};

/** Scene world point → screen pixels (same transform as scrollFactor-0 HUD). */
export function farmWorldToScreen(
  cam: FarmCameraScreenTransform,
  worldX: number,
  worldY: number
): { x: number; y: number } {
  const ox = cam.x ?? 0;
  const oy = cam.y ?? 0;
  return {
    x: (worldX - cam.scrollX) * cam.zoom + ox,
    y: (worldY - cam.scrollY) * cam.zoom + oy,
  };
}

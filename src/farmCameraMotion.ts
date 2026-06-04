import {
  clampFarmCameraZoom,
  FARM_CAMERA_INERTIA,
  FARM_CAMERA_SCROLL_SMOOTH,
  FARM_CAMERA_ZOOM_SPEED,
} from './config/farmCameraConfig';
import { computeScrollForMapCenterScreenTarget } from './farmWorldScrollAnchor';
import {
  clampScrollToFarmPlayable,
  type FarmCameraScrollLimits,
} from './farmCameraScroll';

/** Exponential-style lerp step toward `target`. */
export function lerpToward(current: number, target: number, factor: number): number {
  if (factor <= 0) return current;
  if (factor >= 1) return target;
  return current + (target - current) * factor;
}

/** Clamp zoom to configured farm camera limits. */
export { clampFarmCameraZoom };

/**
 * Adjust scroll so the world point under `anchorScreen` stays fixed when zoom changes.
 * screen = (world − scroll) × zoom  ⇒  scroll = world − screen / zoom
 */
export function computeScrollForZoomAtScreenAnchor(
  scrollX: number,
  scrollY: number,
  prevZoom: number,
  nextZoom: number,
  anchorScreenX: number,
  anchorScreenY: number
): { scrollX: number; scrollY: number } {
  if (prevZoom <= 0 || nextZoom <= 0) {
    return { scrollX, scrollY };
  }
  const worldX = scrollX + anchorScreenX / prevZoom;
  const worldY = scrollY + anchorScreenY / prevZoom;
  return {
    scrollX: worldX - anchorScreenX / nextZoom,
    scrollY: worldY - anchorScreenY / nextZoom,
  };
}

/**
 * One smooth zoom step toward `targetZoom`, then scroll so `mapCenterWorld` (after any world
 * offset shift applied by the scene) stays on the interpolated map-center screen target.
 */
export function stepSmoothZoomAtMapCenter(
  mapCenterWorld: { x: number; y: number },
  viewW: number,
  viewH: number,
  _scrollX: number,
  _scrollY: number,
  currentZoom: number,
  targetZoom: number,
  zoomSpeed = FARM_CAMERA_ZOOM_SPEED
): { scrollX: number; scrollY: number; zoom: number; settled: boolean } {
  const clampedTarget = clampFarmCameraZoom(targetZoom);
  const nextZoom = lerpToward(currentZoom, clampedTarget, zoomSpeed);
  const settled = Math.abs(nextZoom - clampedTarget) < 0.0005;
  const zoom = settled ? clampedTarget : nextZoom;
  return {
    ...computeScrollForMapCenterScreenTarget(mapCenterWorld, viewW, viewH, zoom),
    zoom,
    settled,
  };
}

/** One smooth zoom step toward `targetZoom`, preserving the wheel/pinch anchor on screen. */
export function stepSmoothZoomAtAnchor(
  scrollX: number,
  scrollY: number,
  currentZoom: number,
  targetZoom: number,
  anchorScreenX: number,
  anchorScreenY: number,
  zoomSpeed = FARM_CAMERA_ZOOM_SPEED
): { scrollX: number; scrollY: number; zoom: number; settled: boolean } {
  const clampedTarget = clampFarmCameraZoom(targetZoom);
  const nextZoom = lerpToward(currentZoom, clampedTarget, zoomSpeed);
  const settled = Math.abs(nextZoom - clampedTarget) < 0.0005;
  const zoom = settled ? clampedTarget : nextZoom;
  const nextScroll = computeScrollForZoomAtScreenAnchor(
    scrollX,
    scrollY,
    currentZoom,
    zoom,
    anchorScreenX,
    anchorScreenY
  );
  return { ...nextScroll, zoom, settled };
}

/** Scroll limits so map edges do not expose viewport void (full viewport, not HUD band). */
export function computeMapViewportScrollLimits(
  map: { minX: number; minY: number; maxX: number; maxY: number },
  viewW: number,
  viewH: number,
  zoom: number
): FarmCameraScrollLimits {
  const mapW = map.maxX - map.minX;
  const mapH = map.maxY - map.minY;
  const lowerScrollX = map.maxX - viewW / zoom;
  const upperScrollX = map.minX;
  const lowerScrollY = map.maxY - viewH / zoom;
  const upperScrollY = map.minY;
  return {
    x: {
      minScroll: Math.min(lowerScrollX, upperScrollX),
      maxScroll: Math.max(lowerScrollX, upperScrollX),
      oversize: mapW * zoom > viewW,
    },
    y: {
      minScroll: Math.min(lowerScrollY, upperScrollY),
      maxScroll: Math.max(lowerScrollY, upperScrollY),
      oversize: mapH * zoom > viewH,
    },
  };
}

/** Intersect two limit sets — tighter pan box (prevents void outside map at low zoom). */
export function intersectFarmCameraScrollLimits(
  primary: FarmCameraScrollLimits,
  secondary: FarmCameraScrollLimits
): FarmCameraScrollLimits {
  const mergeAxis = (
    a: FarmCameraScrollLimits['x'],
    b: FarmCameraScrollLimits['x']
  ): FarmCameraScrollLimits['x'] => {
    const minScroll = Math.max(a.minScroll, b.minScroll);
    const maxScroll = Math.min(a.maxScroll, b.maxScroll);
    const valid = minScroll <= maxScroll;
    return {
      minScroll: valid ? minScroll : a.minScroll,
      maxScroll: valid ? maxScroll : a.maxScroll,
      oversize: a.oversize || b.oversize,
    };
  };
  return {
    x: mergeAxis(primary.x, secondary.x),
    y: mergeAxis(primary.y, secondary.y),
  };
}

/**
 * Intersect farm playable limits with map viewport limits, but keep full farm X pan
 * when the map box would collapse horizontal range (scroll-zero layout / tight map AABB).
 */
export function mergeFarmAndMapScrollLimits(
  farm: FarmCameraScrollLimits,
  map: FarmCameraScrollLimits
): FarmCameraScrollLimits {
  const merged = intersectFarmCameraScrollLimits(farm, map);
  const farmSpanX = farm.x.maxScroll - farm.x.minScroll;
  const mergedSpanX = merged.x.maxScroll - merged.x.minScroll;
  if (farm.x.oversize && mergedSpanX < farmSpanX * 0.5) {
    return { x: farm.x, y: merged.y };
  }
  return merged;
}

/** Decay pan velocity (screen px per frame) for inertia. */
export function decayPanVelocity(
  velocityX: number,
  velocityY: number,
  inertia = FARM_CAMERA_INERTIA
): { velocityX: number; velocityY: number } {
  return { velocityX: velocityX * inertia, velocityY: velocityY * inertia };
}

/** True when inertia should stop (velocity negligible). */
export function panInertiaIsSettled(velocityX: number, velocityY: number, epsilon = 0.05): boolean {
  return Math.abs(velocityX) < epsilon && Math.abs(velocityY) < epsilon;
}

/** Lerp scroll toward a clamped target (used during inertia settle). */
export function stepSmoothScrollToward(
  scrollX: number,
  scrollY: number,
  targetScrollX: number,
  targetScrollY: number,
  limits: FarmCameraScrollLimits,
  smooth = FARM_CAMERA_SCROLL_SMOOTH
): { scrollX: number; scrollY: number; settled: boolean } {
  const target = clampScrollToFarmPlayable(targetScrollX, targetScrollY, limits);
  const nextX = lerpToward(scrollX, target.scrollX, smooth);
  const nextY = lerpToward(scrollY, target.scrollY, smooth);
  const settled =
    Math.abs(nextX - target.scrollX) < 0.01 && Math.abs(nextY - target.scrollY) < 0.01;
  return {
    scrollX: settled ? target.scrollX : nextX,
    scrollY: settled ? target.scrollY : nextY,
    settled,
  };
}

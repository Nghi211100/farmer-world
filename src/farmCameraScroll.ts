import {
  clampFarmCameraZoom,
  FARM_CAMERA_DEFAULT_ZOOM,
  interpolateFarmCameraScrollLimitField,
} from './config/farmCameraConfig';

/** Farm footprint AABB in world space (pre-camera scroll). */
export type FarmFootprintBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Playable HUD band edges in screen space (pixels). */
export type PlayableBandRect = {
  playableLeft: number;
  playableTop: number;
  playableRight: number;
  playableBottom: number;
};

export type FarmScrollAxisLimits = {
  /** Smallest allowed camera scroll on this axis. */
  minScroll: number;
  /** Largest allowed camera scroll on this axis. */
  maxScroll: number;
  /** Farm span × zoom exceeds playable span. */
  oversize: boolean;
};

export type FarmCameraScrollLimits = {
  x: FarmScrollAxisLimits;
  y: FarmScrollAxisLimits;
};

/** Geometric center of a farm/island screen AABB (world space, pre-scroll). */
export function farmFootprintCenter(farm: FarmFootprintBounds): { x: number; y: number } {
  return {
    x: (farm.minX + farm.maxX) / 2,
    y: (farm.minY + farm.maxY) / 2,
  };
}

/** Normalize min/max so width and height are non-negative. */
export function normalizeFarmFootprintBounds(bounds: FarmFootprintBounds): FarmFootprintBounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxX: Math.max(bounds.minX, bounds.maxX),
    maxY: Math.max(bounds.minY, bounds.maxY),
  };
}

/** Intersection of two footprint AABBs; null when disjoint or degenerate. */
export function intersectFarmFootprintBounds(
  a: FarmFootprintBounds,
  b: FarmFootprintBounds
): FarmFootprintBounds | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Pan clamp bounds: island inset ∩ soil footprint, unless overlap is too narrow
 * (stale island image position / zero display size before layout).
 */
export function resolveFarmPanClampBounds(
  footprint: FarmFootprintBounds,
  island: FarmFootprintBounds | null
): FarmFootprintBounds {
  const soil = normalizeFarmFootprintBounds(footprint);
  if (!island) return soil;
  const inset = normalizeFarmFootprintBounds(island);
  const overlap = intersectFarmFootprintBounds(inset, soil);
  if (!overlap) return soil;
  const soilW = soil.maxX - soil.minX;
  const overlapW = overlap.maxX - overlap.minX;
  if (overlapW < soilW * 0.75) return soil;
  return overlap;
}

/** Visible gaps between farm footprint screen AABB and playable band edges (pixels). */
export function computeFarmPlayableScreenMargins(
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  scrollX: number,
  scrollY: number,
  zoom: number
): { left: number; right: number; top: number; bottom: number } {
  const left = (farm.minX - scrollX) * zoom - playable.playableLeft;
  const right = playable.playableRight - (farm.maxX - scrollX) * zoom;
  const top = (farm.minY - scrollY) * zoom - playable.playableTop;
  const bottom = playable.playableBottom - (farm.maxY - scrollY) * zoom;
  return { left, right, top, bottom };
}

/** Background void from viewport edges to content AABB (positive = gap visible). */
export function computeFarmViewportVoidMargins(
  content: FarmFootprintBounds,
  viewW: number,
  viewH: number,
  scrollX: number,
  scrollY: number,
  zoom: number
): { left: number; right: number; top: number; bottom: number } {
  const left = (content.minX - scrollX) * zoom;
  const right = viewW - (content.maxX - scrollX) * zoom;
  const top = (content.minY - scrollY) * zoom;
  const bottom = viewH - (content.maxY - scrollY) * zoom;
  return { left, right, top, bottom };
}

/**
 * Scroll that centers `content` in the viewport on oversize axes, clamped to pan limits from `clampFarm`.
 * In-band axes keep the incoming scroll value.
 */
function pickBalancedOversizeScroll(
  idealScroll: number,
  limits: FarmScrollAxisLimits
): number {
  if (!limits.oversize) {
    return idealScroll;
  }
  const mid = (limits.minScroll + limits.maxScroll) / 2;
  if (idealScroll >= limits.minScroll && idealScroll <= limits.maxScroll) {
    return idealScroll;
  }
  return mid;
}

export function computeFarmCameraScrollForBalancedViewportMargins(
  content: FarmFootprintBounds,
  clampFarm: FarmFootprintBounds,
  playable: PlayableBandRect,
  viewW: number,
  viewH: number,
  zoom: number,
  scroll: { scrollX: number; scrollY: number },
  screenCenter?: { x: number; y: number }
): { scrollX: number; scrollY: number } {
  const limits = computeFarmCameraScrollLimits(clampFarm, playable, zoom);
  const center = farmFootprintCenter(content);
  const cx = screenCenter?.x ?? viewW / 2;
  const cy = screenCenter?.y ?? viewH / 2;
  const idealScrollX = center.x - cx / zoom;
  const idealScrollY = center.y - cy / zoom;
  return {
    scrollX: limits.x.oversize
      ? pickBalancedOversizeScroll(idealScrollX, limits.x)
      : scroll.scrollX,
    scrollY: limits.y.oversize
      ? pickBalancedOversizeScroll(idealScrollY, limits.y)
      : scroll.scrollY,
  };
}

/**
 * Nudge scroll so `footprint` intersects the viewport, then clamp to pan limits.
 * Used after zoom recenter when margin balancing used a larger content AABB than pan clamp.
 */
export function clampScrollSoFootprintOverlapsViewport(
  footprint: FarmFootprintBounds,
  limits: FarmCameraScrollLimits,
  viewW: number,
  viewH: number,
  zoom: number,
  scroll: { scrollX: number; scrollY: number },
  /** When set, require overlap with the HUD playable band (matches pan limits), not the full viewport. */
  playable?: PlayableBandRect
): { scrollX: number; scrollY: number } {
  let { scrollX, scrollY } = clampScrollToFarmPlayable(
    scroll.scrollX,
    scroll.scrollY,
    limits
  );

  const bandLeft = playable?.playableLeft ?? 0;
  const bandTop = playable?.playableTop ?? 0;
  const bandRight = playable?.playableRight ?? viewW;
  const bandBottom = playable?.playableBottom ?? viewH;

  const nudgeAxis = (
    scrollPos: number,
    minWorld: number,
    maxWorld: number,
    edgeMin: number,
    edgeMax: number
  ): number => {
    const leftEdge = (minWorld - scrollPos) * zoom;
    const rightEdge = (maxWorld - scrollPos) * zoom;
    if (rightEdge > edgeMin && leftEdge < edgeMax) {
      return scrollPos;
    }
    if (rightEdge <= edgeMin) {
      return scrollPos + (rightEdge - edgeMin) / zoom - 1 / zoom;
    }
    return scrollPos + (leftEdge - edgeMax) / zoom + 1 / zoom;
  };

  scrollX = nudgeAxis(scrollX, footprint.minX, footprint.maxX, bandLeft, bandRight);
  scrollY = nudgeAxis(scrollY, footprint.minY, footprint.maxY, bandTop, bandBottom);
  return clampScrollToFarmPlayable(scrollX, scrollY, limits);
}

/**
 * Scroll limits so the farm footprint stays inside the HUD playable band.
 * screen = (world − scroll) × zoom ⇒ scroll = world − screen/zoom.
 */
/**
 * Viewport- and zoom-interpolated scroll clamp from {@link farmCameraConfig}.
 * Piecewise lerp across three reference viewports (W/H) and zoom keyframes 1.2 / 1.9 / 2.5.
 */
export function getConfiguredFarmCameraScrollLimits(
  viewW: number,
  viewH: number,
  zoom: number = FARM_CAMERA_DEFAULT_ZOOM
): FarmCameraScrollLimits {
  const z = clampFarmCameraZoom(zoom);
  const minScrollX = interpolateFarmCameraScrollLimitField(viewW, viewH, z, 'minScrollX');
  const maxScrollX = interpolateFarmCameraScrollLimitField(viewW, viewH, z, 'maxScrollX');
  const minScrollY = interpolateFarmCameraScrollLimitField(viewW, viewH, z, 'minScrollY');
  const maxScrollY = interpolateFarmCameraScrollLimitField(viewW, viewH, z, 'maxScrollY');
  return {
    x: {
      minScroll: minScrollX,
      maxScroll: maxScrollX,
      oversize: true,
    },
    y: {
      minScroll: minScrollY,
      maxScroll: maxScrollY,
      oversize: true,
    },
  };
}

/** Tighten computed playable/map limits with configured scroll bounds. */
export function mergeFarmCameraScrollLimitsWithConfigured(
  limits: FarmCameraScrollLimits,
  viewW: number,
  viewH: number,
  zoom: number
): FarmCameraScrollLimits {
  const fixed = getConfiguredFarmCameraScrollLimits(viewW, viewH, zoom);
  const mergeAxis = (
    a: FarmScrollAxisLimits,
    b: FarmScrollAxisLimits
  ): FarmScrollAxisLimits => {
    const minScroll = Math.max(a.minScroll, b.minScroll);
    const maxScroll = Math.min(a.maxScroll, b.maxScroll);
    const valid = minScroll <= maxScroll;
    return {
      minScroll: valid ? minScroll : b.minScroll,
      maxScroll: valid ? maxScroll : b.maxScroll,
      oversize: a.oversize || b.oversize,
    };
  };
  return {
    x: mergeAxis(limits.x, fixed.x),
    y: mergeAxis(limits.y, fixed.y),
  };
}

export function computeFarmCameraScrollLimits(
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number
): FarmCameraScrollLimits {
  const { playableLeft, playableTop, playableRight, playableBottom } = playable;
  const farmW = farm.maxX - farm.minX;
  const farmH = farm.maxY - farm.minY;
  const playableW = playableRight - playableLeft;
  const playableH = playableBottom - playableTop;

  const lowerScrollX = farm.maxX - playableRight / zoom;
  const upperScrollX = farm.minX - playableLeft / zoom;
  const lowerScrollY = farm.maxY - playableBottom / zoom;
  const upperScrollY = farm.minY - playableTop / zoom;

  return {
    x: {
      minScroll: Math.min(lowerScrollX, upperScrollX),
      maxScroll: Math.max(lowerScrollX, upperScrollX),
      oversize: farmW * zoom > playableW,
    },
    y: {
      minScroll: Math.min(lowerScrollY, upperScrollY),
      maxScroll: Math.max(lowerScrollY, upperScrollY),
      oversize: farmH * zoom > playableH,
    },
  };
}

/**
 * Oversize Y: scroll so the farm footprint center sits on `panTargetCenter` (screen space).
 * @deprecated Prefer inline `idealScrollY` in scroll helpers; kept for tests.
 */
export function computeOversizeFarmPanBottomScrollY(
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number,
  panTargetCenter?: { x: number; y: number }
): number {
  const center = farmFootprintCenter(farm);
  const targetY =
    panTargetCenter?.y ??
    (playable.playableTop + playable.playableBottom) / 2;
  return center.y - targetY / zoom;
}

/** Clamp scroll on axes where the farm is larger than the playable band. */
export function clampScrollToFarmPlayable(
  scrollX: number,
  scrollY: number,
  limits: FarmCameraScrollLimits
): { scrollX: number; scrollY: number } {
  const nextX = limits.x.oversize
    ? Math.min(Math.max(scrollX, limits.x.minScroll), limits.x.maxScroll)
    : scrollX;
  const nextY = limits.y.oversize
    ? Math.min(Math.max(scrollY, limits.y.minScroll), limits.y.maxScroll)
    : scrollY;
  return {
    scrollX: nextX,
    scrollY: nextY,
  };
}

/**
 * Initial camera scroll: place the farm footprint center on the HUD target.
 * When an axis is oversize (e.g. min zoom), center the footprint AABB on
 * `targetCenter` using the same playable band as {@link computeFarmCameraScrollLimits}
 * ({@link getFarmPanBoundsScrollTargetScreen} + matching shifted playable band for clamp limits).
 */
export function computeCenteredFarmCameraScroll(
  anchor: { x: number; y: number },
  targetCenter: { x: number; y: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number
): { scrollX: number; scrollY: number } {
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  const idealScrollX = anchor.x - targetCenter.x / zoom;
  const idealScrollY = anchor.y - targetCenter.y / zoom;
  return {
    scrollX: limits.x.oversize
      ? Math.min(Math.max(idealScrollX, limits.x.minScroll), limits.x.maxScroll)
      : idealScrollX,
    scrollY: limits.y.oversize
      ? Math.min(Math.max(idealScrollY, limits.y.minScroll), limits.y.maxScroll)
      : idealScrollY,
  };
}

/** Scroll at the clamp-band midpoint on oversize axes (symmetric pan from load). */
export function snapFarmOversizeScrollToLimitsMidpoint(
  scroll: { scrollX: number; scrollY: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number
): { scrollX: number; scrollY: number } {
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  return {
    scrollX: limits.x.oversize
      ? (limits.x.minScroll + limits.x.maxScroll) / 2
      : scroll.scrollX,
    scrollY: limits.y.oversize
      ? (limits.y.minScroll + limits.y.maxScroll) / 2
      : scroll.scrollY,
  };
}

/**
 * After map-top layout shifts pan bounds, re-apply pan-target centering on oversize axes only.
 * Oversize axes snap to the clamp midpoint so pan range is symmetric (map-top passes can drift).
 */
export function mergeFarmCameraScrollWithOversizeCenter(
  scroll: { scrollX: number; scrollY: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  _targetCenter: { x: number; y: number },
  zoom: number
): { scrollX: number; scrollY: number } {
  return snapFarmOversizeScrollToLimitsMidpoint(scroll, farm, playable, zoom);
}

/**
 * Scroll so pan-bounds X/Y stay on target. When Y is oversize, center on `panTargetCenter`
 * (map-top alignment is handled by {@link GridSystem.alignMapTopToPanBoundsInset} passes).
 * Otherwise Y follows map top to `mapTopTargetScreenY`.
 */
export function computeFarmCameraScrollForMapTopAndPanCenter(
  mapMinY: number,
  islandAnchor: { x: number; y: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  mapTopTargetScreenY: number,
  panTargetCenter: { x: number; y: number },
  zoom: number
): { scrollX: number; scrollY: number } {
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  const idealScrollX = islandAnchor.x - panTargetCenter.x / zoom;
  const idealScrollY = islandAnchor.y - panTargetCenter.y / zoom;
  const mapTopScrollY = mapMinY - mapTopTargetScreenY / zoom;
  const scrollY = limits.y.oversize
    ? Math.min(Math.max(idealScrollY, limits.y.minScroll), limits.y.maxScroll)
    : mapTopScrollY;
  const scrollX = limits.x.oversize
    ? Math.min(Math.max(idealScrollX, limits.x.minScroll), limits.x.maxScroll)
    : idealScrollX;
  return { scrollX, scrollY };
}

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

/**
 * Scroll limits so the farm footprint stays inside the HUD playable band.
 * screen = (world − scroll) × zoom ⇒ scroll = world − screen/zoom.
 */
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
 * When an axis is oversize (e.g. MIN_CAMERA_ZOOM), center the footprint AABB on
 * `targetCenter` using the same playable band as {@link computeFarmCameraScrollLimits}
 * ({@link getPlayableBandPanBoundsCenter} + matching shifted playable band for clamp limits).
 */
export function computeCenteredFarmCameraScroll(
  _anchor: { x: number; y: number },
  targetCenter: { x: number; y: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number
): { scrollX: number; scrollY: number } {
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  const boundsCenter = farmFootprintCenter(farm);
  const idealScrollX = boundsCenter.x - targetCenter.x / zoom;
  const idealScrollY = boundsCenter.y - targetCenter.y / zoom;
  return {
    scrollX: limits.x.oversize
      ? Math.min(Math.max(idealScrollX, limits.x.minScroll), limits.x.maxScroll)
      : idealScrollX,
    scrollY: limits.y.oversize
      ? Math.min(Math.max(idealScrollY, limits.y.minScroll), limits.y.maxScroll)
      : idealScrollY,
  };
}

/**
 * Scroll so the full-map top edge hits `mapTopTargetScreenY` on screen while the island
 * anchor stays on the pan-bounds X target. Y is driven by map top (not island center) so
 * visible map top ({@link GridSystem.getMapScreenBounds}); footprint uses the same map layer.
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
  const scrollY = mapMinY - mapTopTargetScreenY / zoom;
  const scrollX = limits.x.oversize
    ? Math.min(Math.max(idealScrollX, limits.x.minScroll), limits.x.maxScroll)
    : idealScrollX;
  return { scrollX, scrollY };
}

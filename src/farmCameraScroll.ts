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
 * Initial camera scroll: center the farm patch on the target screen point.
 * When an axis is oversize, center the footprint inside the playable band instead
 * of clamping to the nearest edge.
 */
export function computeCenteredFarmCameraScroll(
  anchor: { x: number; y: number },
  targetCenter: { x: number; y: number },
  farm: FarmFootprintBounds,
  playable: PlayableBandRect,
  zoom: number
): { scrollX: number; scrollY: number } {
  const idealScrollX = anchor.x - targetCenter.x / zoom;
  const idealScrollY = anchor.y - targetCenter.y / zoom;
  const limits = computeFarmCameraScrollLimits(farm, playable, zoom);
  return {
    scrollX: limits.x.oversize
      ? (limits.x.minScroll + limits.x.maxScroll) / 2
      : idealScrollX,
    scrollY: limits.y.oversize
      ? (limits.y.minScroll + limits.y.maxScroll) / 2
      : idealScrollY,
  };
}

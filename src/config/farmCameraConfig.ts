/** Farm main camera zoom range (camera transform only — never scale tiles). */
export const FARM_CAMERA_MIN_ZOOM = 1.2;
export const FARM_CAMERA_MAX_ZOOM = 2.5;
export const FARM_CAMERA_DEFAULT_ZOOM = 1.9;

/**
 * Legacy scroll-zero bake label (world anchor at scroll 0). On load at {@link FARM_CAMERA_DEFAULT_ZOOM},
 * camera scroll uses {@link getFarmDefaultScrollAtZoom} from viewport keyframes when the user has not panned.
 */
export const FARM_CAMERA_DEFAULT_SCROLL_X = 0;
export const FARM_CAMERA_DEFAULT_SCROLL_Y = 0;

/** Pan clamp + default scroll at one zoom keyframe on a reference viewport. */
export type FarmCameraScrollLimitAtZoom = {
  minScrollX: number;
  maxScrollX: number;
  minScrollY: number;
  maxScrollY: number;
  /** Present only at {@link FARM_CAMERA_DEFAULT_ZOOM}; other zooms lerp toward (0, 0). */
  defaultScrollX?: number;
  defaultScrollY?: number;
};

/** Reference viewport with scroll limits at min / default / max zoom. */
export type FarmCameraScrollViewportKeyframe = {
  viewW: number;
  viewH: number;
  atMinZoom: FarmCameraScrollLimitAtZoom;
  atDefaultZoom: FarmCameraScrollLimitAtZoom;
  atMaxZoom: FarmCameraScrollLimitAtZoom;
};

/** Tuned reference viewports (W×H) for piecewise viewport + zoom scroll limits. */
export const FARM_CAMERA_SCROLL_VIEWPORT_KEYFRAMES: readonly FarmCameraScrollViewportKeyframe[] =
  [
    {
      viewW: 2108,
      viewH: 1285,
      atMinZoom: { minScrollX: -350, maxScrollX: 40, minScrollY: -80, maxScrollY: -50 },
      atDefaultZoom: {
        minScrollX: -970,
        maxScrollX: 20,
        minScrollY: -450,
        maxScrollY: -35,
        defaultScrollX: -500,
        defaultScrollY: -320,
      },
      atMaxZoom: { minScrollX: -1270, maxScrollX: 10, minScrollY: -600, maxScrollY: 0 },
    },
    {
      viewW: 1480,
      viewH: 903,
      atMinZoom: { minScrollX: -350, maxScrollX: 505, minScrollY: -50, maxScrollY: 250 },
      atDefaultZoom: {
        minScrollX: -784,
        maxScrollX: 484,
        minScrollY: -340,
        maxScrollY: 242,
        defaultScrollX: -184,
        defaultScrollY: -130,
      },
      atMaxZoom: { minScrollX: -1076, maxScrollX: 440, minScrollY: -500, maxScrollY: 230 },
    },
    {
      viewW: 1178,
      viewH: 651,
      atMinZoom: { minScrollX: -350, maxScrollX: 930, minScrollY: -50, maxScrollY: 350 },
      atDefaultZoom: {
        minScrollX: -784,
        maxScrollX: 790,
        minScrollY: -340,
        maxScrollY: 375,
        defaultScrollX: -35,
        defaultScrollY: -2,
      },
      atMaxZoom: { minScrollX: -1050, maxScrollX: 670, minScrollY: -450, maxScrollY: 400 },
    },
  ] as const;

/** Viewport + scroll at {@link FARM_CAMERA_DEFAULT_ZOOM} (derived from scroll limit keyframes). */
export type FarmDefaultScrollViewportKeyframe = {
  viewW: number;
  viewH: number;
  scrollX: number;
  scrollY: number;
};

export const FARM_DEFAULT_SCROLL_VIEWPORT_KEYFRAMES_AT_DEFAULT_ZOOM: readonly FarmDefaultScrollViewportKeyframe[] =
  FARM_CAMERA_SCROLL_VIEWPORT_KEYFRAMES.map((kf) => ({
    viewW: kf.viewW,
    viewH: kf.viewH,
    scrollX: kf.atDefaultZoom.defaultScrollX ?? 0,
    scrollY: kf.atDefaultZoom.defaultScrollY ?? 0,
  }));

type ViewportAxisKeyframe = { axis: number; value: number };

/** Piecewise-linear interpolation (and linear extrapolation) along one viewport axis. */
export function piecewiseLerpFarmDefaultScrollOnAxis(
  axis: number,
  keyframes: readonly ViewportAxisKeyframe[]
): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;
  const sorted = [...keyframes].sort((a, b) => a.axis - b.axis);
  if (axis <= sorted[0].axis) {
    const a = sorted[0];
    const b = sorted[1];
    const span = b.axis - a.axis;
    const t = span <= 0 ? 0 : (axis - a.axis) / span;
    return a.value + (b.value - a.value) * t;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (axis <= b.axis) {
      const span = b.axis - a.axis;
      const t = span <= 0 ? 0 : (axis - a.axis) / span;
      return a.value + (b.value - a.value) * t;
    }
  }
  const a = sorted[sorted.length - 2];
  const b = sorted[sorted.length - 1];
  const span = b.axis - a.axis;
  const t = span <= 0 ? 0 : (axis - a.axis) / span;
  return a.value + (b.value - a.value) * t;
}

type FarmScrollLimitField =
  | 'minScrollX'
  | 'maxScrollX'
  | 'minScrollY'
  | 'maxScrollY'
  | 'defaultScrollX'
  | 'defaultScrollY';

function pickFarmScrollLimitAtZoomKeyframe(
  keyframe: FarmCameraScrollViewportKeyframe,
  zoomKey: 'min' | 'default' | 'max'
): FarmCameraScrollLimitAtZoom {
  if (zoomKey === 'min') return keyframe.atMinZoom;
  if (zoomKey === 'max') return keyframe.atMaxZoom;
  return keyframe.atDefaultZoom;
}

function readFarmScrollLimitField(
  limits: FarmCameraScrollLimitAtZoom,
  field: FarmScrollLimitField
): number {
  if (field === 'defaultScrollX') return limits.defaultScrollX ?? 0;
  if (field === 'defaultScrollY') return limits.defaultScrollY ?? 0;
  return limits[field];
}

/** Piecewise-linear in viewport W or H at a fixed zoom keyframe. */
function interpolateFarmScrollLimitOnViewportAxis(
  viewAxis: number,
  axis: 'w' | 'h',
  zoomKey: 'min' | 'default' | 'max',
  field: FarmScrollLimitField
): number {
  const keys: ViewportAxisKeyframe[] = FARM_CAMERA_SCROLL_VIEWPORT_KEYFRAMES.map((kf) => ({
    axis: axis === 'w' ? kf.viewW : kf.viewH,
    value: readFarmScrollLimitField(pickFarmScrollLimitAtZoomKeyframe(kf, zoomKey), field),
  }));
  return piecewiseLerpFarmDefaultScrollOnAxis(viewAxis, keys);
}

/** Viewport lerp at each zoom keyframe, then piecewise lerp across z=1.2 / 1.9 / 2.5. */
export function interpolateFarmCameraScrollLimitField(
  viewW: number,
  viewH: number,
  zoom: number,
  field: FarmScrollLimitField
): number {
  const atMinZoom = interpolateFarmScrollLimitOnViewportAxis(
    field.endsWith('X') || field === 'defaultScrollX' ? viewW : viewH,
    field.endsWith('X') || field === 'defaultScrollX' ? 'w' : 'h',
    'min',
    field
  );
  const atDefaultZoom = interpolateFarmScrollLimitOnViewportAxis(
    field.endsWith('X') || field === 'defaultScrollX' ? viewW : viewH,
    field.endsWith('X') || field === 'defaultScrollX' ? 'w' : 'h',
    'default',
    field
  );
  const atMaxZoom = interpolateFarmScrollLimitOnViewportAxis(
    field.endsWith('X') || field === 'defaultScrollX' ? viewW : viewH,
    field.endsWith('X') || field === 'defaultScrollX' ? 'w' : 'h',
    'max',
    field
  );
  return piecewiseLerpFarmMapCenterKeyframe(zoom, atMinZoom, atDefaultZoom, atMaxZoom);
}

/** Interpolated default scroll at z=1.9 from the three reference viewports (W → scrollX, H → scrollY). */
export function getFarmDefaultScrollAtDefaultZoom(
  viewW: number,
  viewH: number
): { scrollX: number; scrollY: number } {
  return {
    scrollX: interpolateFarmCameraScrollLimitField(viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM, 'defaultScrollX'),
    scrollY: interpolateFarmCameraScrollLimitField(viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM, 'defaultScrollY'),
  };
}

/**
 * Default camera scroll when the user has not panned: viewport keyframes at 1.9, lerped toward (0,0) at min/max zoom.
 */
export function getFarmDefaultScrollAtZoom(
  viewW: number,
  viewH: number,
  zoom: number
): { scrollX: number; scrollY: number } {
  return {
    scrollX: interpolateFarmCameraScrollLimitField(viewW, viewH, zoom, 'defaultScrollX'),
    scrollY: interpolateFarmCameraScrollLimitField(viewW, viewH, zoom, 'defaultScrollY'),
  };
}

/** Lerp factor per frame (~60fps) for scroll toward target / inertia settle. */
export const FARM_CAMERA_SCROLL_SMOOTH = 0.12;

/** Lerp factor per frame for zoom toward wheel/pinch target. */
export const FARM_CAMERA_ZOOM_SPEED = 0.15;

/** Per-frame velocity decay while pan inertia is active. */
export const FARM_CAMERA_INERTIA = 0.9;

/** Max duration (ms) for pan inertia after pointer release. */
export const FARM_CAMERA_INERTIA_MS = 200;

/** Wheel delta → target zoom change (same scale as previous dy×0.001). */
export const FARM_CAMERA_WHEEL_ZOOM_SCALE = 0.001;

/** Pinch distance delta → target zoom change (same scale as previous dist×0.005). */
export const FARM_CAMERA_PINCH_ZOOM_SCALE = 0.005;

export function clampFarmCameraZoom(zoom: number): number {
  return Math.min(FARM_CAMERA_MAX_ZOOM, Math.max(FARM_CAMERA_MIN_ZOOM, zoom));
}

/**
 * Map center on screen vs viewport optical center (scroll 0 bake / zoom scroll nudge).
 * Piecewise linear: {@link FARM_CAMERA_MIN_ZOOM} → {@link FARM_CAMERA_DEFAULT_ZOOM} → {@link FARM_CAMERA_MAX_ZOOM}.
 * Tune MAP_CENTER_SCREEN_*_OFFSET_AT_* — world target at scroll 0 is `(view/2 + offset) / zoom`.
 */
export const MAP_CENTER_SCREEN_X_OFFSET_AT_MIN_ZOOM = 0;
export const MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM = 20;

export const MAP_CENTER_SCREEN_X_OFFSET_AT_DEFAULT_ZOOM = 0;
export const MAP_CENTER_SCREEN_Y_OFFSET_AT_DEFAULT_ZOOM = 0;

export const MAP_CENTER_SCREEN_X_OFFSET_AT_MAX_ZOOM = 0;
/** Negative = pull map center up on screen at max zoom (corrects downward drift vs naive viewH/2). */
export const MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM = -115;

/** Piecewise lerp for map-center keyframes (1.2 ↔ 1.9 ↔ 2.5). */
export function piecewiseLerpFarmMapCenterKeyframe(
  zoom: number,
  atMinZoom: number,
  atDefaultZoom: number,
  atMaxZoom: number
): number {
  const z = clampFarmCameraZoom(zoom);
  const lowSpan = FARM_CAMERA_DEFAULT_ZOOM - FARM_CAMERA_MIN_ZOOM;
  if (z <= FARM_CAMERA_DEFAULT_ZOOM) {
    if (lowSpan <= 0) return atDefaultZoom;
    const t = (z - FARM_CAMERA_MIN_ZOOM) / lowSpan;
    return atMinZoom + (atDefaultZoom - atMinZoom) * t;
  }
  const highSpan = FARM_CAMERA_MAX_ZOOM - FARM_CAMERA_DEFAULT_ZOOM;
  if (highSpan <= 0) return atDefaultZoom;
  const t = (z - FARM_CAMERA_DEFAULT_ZOOM) / highSpan;
  return atDefaultZoom + (atMaxZoom - atDefaultZoom) * t;
}

export function getFarmMapCenterScreenOffsets(zoom: number): { x: number; y: number } {
  return {
    x: piecewiseLerpFarmMapCenterKeyframe(
      zoom,
      MAP_CENTER_SCREEN_X_OFFSET_AT_MIN_ZOOM,
      MAP_CENTER_SCREEN_X_OFFSET_AT_DEFAULT_ZOOM,
      MAP_CENTER_SCREEN_X_OFFSET_AT_MAX_ZOOM
    ),
    y: piecewiseLerpFarmMapCenterKeyframe(
      zoom,
      MAP_CENTER_SCREEN_Y_OFFSET_AT_MIN_ZOOM,
      MAP_CENTER_SCREEN_Y_OFFSET_AT_DEFAULT_ZOOM,
      MAP_CENTER_SCREEN_Y_OFFSET_AT_MAX_ZOOM
    ),
  };
}

/**
 * World-space delta from the 1.9 bake baseline for the playable map center (farmer spawn).
 * Fixed art units at every viewport (tuned on 390×844); piecewise linear across zoom.
 * Do not scale by viewW/viewH — {@link getFarmMapCenterWorldBaselineAtDefaultZoom} already
 * tracks viewport size, so extra scaling double-counts on wide screens (~2.5× on X at 2108px).
 * Positive at min zoom (zoom out); negative at max zoom (zoom in). Tune MAP_CENTER_WORLD_*_OFFSET_AT_*.
 */
export const MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM = 323.6;
export const MAP_CENTER_WORLD_Y_OFFSET_AT_MIN_ZOOM = 197.2;

export const MAP_CENTER_WORLD_X_OFFSET_AT_DEFAULT_ZOOM = 0;
export const MAP_CENTER_WORLD_Y_OFFSET_AT_DEFAULT_ZOOM = 0;

export const MAP_CENTER_WORLD_X_OFFSET_AT_MAX_ZOOM = -133.1;
export const MAP_CENTER_WORLD_Y_OFFSET_AT_MAX_ZOOM = -81.2;

/** Viewport where MAP_CENTER_WORLD_* art deltas were measured (documentation only). */
export const MAP_CENTER_WORLD_OFFSET_REFERENCE_VW = 390;
export const MAP_CENTER_WORLD_OFFSET_REFERENCE_VH = 844;

/**
 * Playable map center (farmer spawn) world after 1.9 bake on the reference viewport (not optical viewW/(2×zoom)).
 * {@link MAP_CENTER_WORLD_*_OFFSET_AT_*} are deltas from this baseline, not from viewport center world.
 */
export const MAP_CENTER_WORLD_BASELINE_X_AT_REF = 554.7;
export const MAP_CENTER_WORLD_BASELINE_Y_AT_REF = 338.2;

/** Spawn tile (10,10) world at min zoom 1.2 on ref viewport 390×844 (baseline + min-zoom offset). */
export const FARM_SPAWN_WORLD_AT_MIN_ZOOM_X = 878.3;
export const FARM_SPAWN_WORLD_AT_MIN_ZOOM_Y = 535.4;

/**
 * World-offset art constant (identity). Viewport scaling was removed: baseline bake already
 * maps optical center to world per view size; multiplying deltas by view/ref caused double scaling.
 */
export function scaleFarmMapCenterWorldOffset(artOffset: number): number {
  return artOffset;
}

/**
 * Interpolated world delta from the 1.9 baseline at `zoom` (fixed art units, not viewport-scaled).
 * Displayed map center world ≈ baseline at 1.9 + this offset.
 * `viewW` / `viewH` are accepted for API stability but do not affect the result.
 */
export function getFarmMapCenterWorldOffsets(
  _viewW: number,
  _viewH: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: piecewiseLerpFarmMapCenterKeyframe(
      zoom,
      MAP_CENTER_WORLD_X_OFFSET_AT_MIN_ZOOM,
      MAP_CENTER_WORLD_X_OFFSET_AT_DEFAULT_ZOOM,
      MAP_CENTER_WORLD_X_OFFSET_AT_MAX_ZOOM
    ),
    y: piecewiseLerpFarmMapCenterKeyframe(
      zoom,
      MAP_CENTER_WORLD_Y_OFFSET_AT_MIN_ZOOM,
      MAP_CENTER_WORLD_Y_OFFSET_AT_DEFAULT_ZOOM,
      MAP_CENTER_WORLD_Y_OFFSET_AT_MAX_ZOOM
    ),
  };
}

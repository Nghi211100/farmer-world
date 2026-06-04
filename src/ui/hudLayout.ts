import type { PlayableBandRect } from '../farmCameraScroll';
import { getHudSafeAreaInsets } from '../safeArea';
import { getUiFontScale, scaledFontSizePx } from './uiFontScale';

/** Laptop reference viewport (matches `uiFontScale.ts`). */
export const HUD_REFERENCE_VW = 1920;
export const HUD_REFERENCE_VH = 1080;
export const HUD_REFERENCE_VMIN = Math.min(HUD_REFERENCE_VW, HUD_REFERENCE_VH);

/** Design-time top resource bar (art px at reference vmin). */
const TOP_PAD_ART = 10;
const TOP_EDGE_PAD_ART = 12;
const TOP_SLOT_GAP_ART = 8;
/** Farm playable inset below resource boxes (legacy band was 56 vs pad+bar 58). */
const TOP_BAND_EXTRA_ART = -2;

/** Design-time bottom nav bar (art px at reference vmin). */
const BOTTOM_BAR_H_ART = 64;
const BOTTOM_BOTTOM_INSET_ART = 4;
const BOTTOM_LABEL_Y_OFFSET_ART = 16;
const BOTTOM_LABEL_FONT_ART = 10;
const BOTTOM_MODE_HINT_Y_OFFSET_ART = 42;
const BOTTOM_MODE_HINT_FONT_ART = 11;
/** Land-expand pick mode — larger than normal mode hints. */
const BOTTOM_EXPAND_MODE_HINT_Y_OFFSET_ART = 56;
const BOTTOM_EXPAND_MODE_HINT_FONT_ART = 22;
/** FarmScene entry toast when entering land-expand mode. */
const EXPAND_SELECT_HINT_TOAST_ART = 20;
/** Tap band above icons (legacy `BOTTOM_HUD_BAND` was 72 at reference). */
const BOTTOM_BAND_EXTRA_ART = 2;

/** Design-time right nav strip (art px at reference vmin). */
const RIGHT_ICON_PAD_ART = 8;
const RIGHT_BAND_EXTRA_ART = 2;
const RIGHT_ICON_GAP_ART = 14;

/** Bottom / right HUD icon width as fraction of viewport width. */
export const HUD_BOTTOM_ICON_VW_FRAC = 0.07;
export const HUD_BOTTOM_ICON_VW_FRAC_MAX = 0.12;
/** Right bar land + build icons (5% vw each). */
export const HUD_RIGHT_LAND_BUILD_VW_FRAC = 0.05;
export const HUD_RIGHT_LAND_BUILD_VW_FRAC_MAX = 0.1;
/** Right bar shop icon (matches bottom nav). */
export const HUD_RIGHT_SHOP_VW_FRAC = HUD_BOTTOM_ICON_VW_FRAC;
export const HUD_RIGHT_SHOP_VW_FRAC_MAX = HUD_BOTTOM_ICON_VW_FRAC_MAX;

export const RIGHT_MENU_ICON_COUNT = 3;

export const TOP_SLOT_COUNT = 3;

/** Top resource bar slot width (coin / gem / energy) as fraction of viewport width. */
export const TOP_SLOT_VW_FRAC = 0.25;
/** Top resource slot height as fraction of slot width (height = width × frac). */
export const TOP_SLOT_HEIGHT_WIDTH_FRAC = 0.17;
/** Coin / gem / energy value text size as fraction of slot width. */
export const TOP_SLOT_VALUE_FONT_WIDTH_FRAC = 0.05;

function topSlotDimensions(viewportW: number): { width: number; height: number } {
  const width = Math.max(1, Math.floor(viewportW * TOP_SLOT_VW_FRAC));
  const height = Math.max(1, Math.round(width * TOP_SLOT_HEIGHT_WIDTH_FRAC));
  return { width, height };
}

/** Value label font size (px) for top resource slots: `slotWidth × TOP_SLOT_VALUE_FONT_WIDTH_FRAC`. */
export function topSlotValueFontSizePx(viewportW: number): number {
  const { width: slotW } = topSlotDimensions(viewportW);
  return Math.max(1, Math.round(slotW * TOP_SLOT_VALUE_FONT_WIDTH_FRAC));
}

/** Bottom nav icon centers along X (fractions of viewport width). */
export const BOTTOM_MENU_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

/** Bag (inventory) left HUD: inset from viewport left edge (fraction of width). */
export const HUD_BAG_LEFT_VW_FRAC = 0.015;
/** Right HUD menu (expand / build / shop): inset from viewport right edge (fraction of width). */
export const HUD_RIGHT_MENU_RIGHT_VW_FRAC = 0.015;
/** Bag (inventory) bottom HUD: inset from viewport bottom edge (fraction of height). */
export const HUD_BAG_BOTTOM_VH_FRAC = 0.015;
/** Right HUD menu icon display size vs baseline vw-clamped size. */
export const HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER = 1.105;
/** Extra vertical gap between land (expand) and build icons vs other right-menu gaps. */
export const HUD_RIGHT_MENU_LAND_BUILD_GAP_MULTIPLIER = 1.05;

/** vmin / reference_vmin — base uniform scale for HUD chrome. */
export function hudVminRatio(viewportW: number, viewportH: number): number {
  const vmin = Math.min(viewportW, viewportH);
  return vmin / HUD_REFERENCE_VMIN;
}

/** `hudVminRatio × getUiFontScale` (phone/tablet/laptop tier). */
export function hudScale(viewportW: number, viewportH: number): number {
  return hudVminRatio(viewportW, viewportH) * getUiFontScale(viewportW, viewportH);
}

/** Round design art px to screen px: `artPx × hudScale`. */
export function hudSpan(artPx: number, viewportW: number, viewportH: number): number {
  return Math.max(1, Math.round(artPx * hudScale(viewportW, viewportH)));
}

function clampVwIconPx(viewportW: number, frac: number, maxFrac: number): number {
  const raw = viewportW * frac;
  const max = viewportW * maxFrac;
  return Math.max(1, Math.round(Math.min(raw, max)));
}

export function hudBottomIconWidthPx(viewportW: number): number {
  return clampVwIconPx(viewportW, HUD_BOTTOM_ICON_VW_FRAC, HUD_BOTTOM_ICON_VW_FRAC_MAX);
}

export function hudRightLandBuildIconWidthPx(viewportW: number): number {
  return clampVwIconPx(
    viewportW,
    HUD_RIGHT_LAND_BUILD_VW_FRAC,
    HUD_RIGHT_LAND_BUILD_VW_FRAC_MAX
  );
}

export function hudRightShopIconWidthPx(viewportW: number): number {
  return clampVwIconPx(viewportW, HUD_RIGHT_SHOP_VW_FRAC, HUD_RIGHT_SHOP_VW_FRAC_MAX);
}

/** Screen px for a right-menu icon from its vw-clamped base width. */
export function hudRightMenuIconDisplaySizePx(baseWidthPx: number): number {
  return Math.max(1, Math.round(baseWidthPx * HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER));
}

/** Right bar shop icon display size (expand/build use land/build bases). */
export function hudRightShopIconDisplaySizePx(viewportW: number): number {
  return hudRightMenuIconDisplaySizePx(hudRightShopIconWidthPx(viewportW));
}

/** Left HUD bag icon — same display size as the right bar shop icon. */
export function hudBagIconSizePx(viewportW: number, _viewportH: number): number {
  return hudRightShopIconDisplaySizePx(viewportW);
}

/**
 * Stack icon centers from the bottom edge upward (index 0 = topmost icon).
 */
export function hudIconCenterYsFromBottomMixed(
  bottomCenterY: number,
  iconSizes: number[],
  gapArt: number,
  viewportW: number,
  viewportH: number
): number[] {
  if (iconSizes.length === 0) return [];
  const gap = hudSpan(gapArt, viewportW, viewportH);
  let cursor = bottomCenterY;
  const centers: number[] = [];
  for (let i = iconSizes.length - 1; i >= 0; i--) {
    const size = iconSizes[i] ?? iconSizes[0] ?? 1;
    cursor -= size / 2;
    centers.unshift(cursor);
    cursor -= size / 2 + gap;
  }
  return centers;
}

export interface HudSlotRect {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export function computeTopHudSlots(
  viewportW: number,
  viewportH: number
): { slots: HudSlotRect[]; fontSizePx: string } {
  const { width: slotW, height: slotH } = topSlotDimensions(viewportW);
  const topPad = hudSpan(TOP_PAD_ART, viewportW, viewportH);
  const edgePad = hudSpan(TOP_EDGE_PAD_ART, viewportW, viewportH);
  const slotGap = hudSpan(TOP_SLOT_GAP_ART, viewportW, viewportH);
  const centerY = topPad + slotH / 2;

  const slots: HudSlotRect[] = [];
  for (let i = 0; i < TOP_SLOT_COUNT; i++) {
    const centerX = edgePad + slotW / 2 + i * (slotW + slotGap);
    slots.push({ centerX, centerY, width: slotW, height: slotH });
  }

  const fontSizePx = `${topSlotValueFontSizePx(viewportW)}px`;
  return { slots, fontSizePx };
}

/** Playable-area inset: safe area + top pad + bar + small margin (FarmScene / ToolBar). */
export function topHudBandHeight(viewportW: number, viewportH: number): number {
  const { height: slotH } = topSlotDimensions(viewportW);
  const topPad = hudSpan(TOP_PAD_ART, viewportW, viewportH);
  return (
    getHudSafeAreaInsets().top +
    topPad +
    slotH +
    hudSpan(TOP_BAND_EXTRA_ART, viewportW, viewportH)
  );
}

export interface LeftMenuLayout {
  iconCenterX: number;
  iconCenterY: number;
  iconSize: number;
}

/** Left HUD bag: 1.5% from viewport left/bottom (+ safe area); size from {@link hudBagIconSizePx}. */
export function computeLeftMenuLayout(
  viewportW: number,
  viewportH: number
): LeftMenuLayout {
  const iconSize = hudBagIconSizePx(viewportW, viewportH);

  const leftInset =
    viewportW * HUD_BAG_LEFT_VW_FRAC + getHudSafeAreaInsets().left;
  const iconCenterX = leftInset + iconSize / 2;

  const bottomInset =
    viewportH * HUD_BAG_BOTTOM_VH_FRAC + getHudSafeAreaInsets().bottom;
  const iconCenterY = viewportH - bottomInset - iconSize / 2;

  return { iconCenterX, iconCenterY, iconSize };
}

export interface BottomMenuLayout {
  barCenterY: number;
  labelCenterY: number;
  labelFontSize: string;
  modeHintCenterY: number;
  modeHintFontSize: string;
  expandModeHintCenterY: number;
  expandModeHintFontSize: string;
  bandHeight: number;
}

export function computeBottomMenuLayout(
  viewportW: number,
  viewportH: number
): BottomMenuLayout {
  const left = computeLeftMenuLayout(viewportW, viewportH);
  const barH = hudSpan(BOTTOM_BAR_H_ART, viewportW, viewportH);
  const bottomInset = hudSpan(BOTTOM_BOTTOM_INSET_ART, viewportW, viewportH);
  const labelOffset = hudSpan(BOTTOM_LABEL_Y_OFFSET_ART, viewportW, viewportH);
  const bandExtra = hudSpan(BOTTOM_BAND_EXTRA_ART, viewportW, viewportH);

  const barCenterY = viewportH - barH / 2 - bottomInset;
  const labelCenterY = barCenterY + labelOffset;
  const modeHintCenterY = barCenterY - hudSpan(BOTTOM_MODE_HINT_Y_OFFSET_ART, viewportW, viewportH);
  const expandModeHintCenterY =
    barCenterY - hudSpan(BOTTOM_EXPAND_MODE_HINT_Y_OFFSET_ART, viewportW, viewportH);

  const bandTop = left.iconCenterY - left.iconSize / 2 - bandExtra;
  const bandHeight = Math.max(barH + bottomInset, viewportH - bandTop);

  const scale = hudScale(viewportW, viewportH);
  return {
    barCenterY,
    labelCenterY,
    labelFontSize: scaledFontSizePx(BOTTOM_LABEL_FONT_ART, scale),
    modeHintCenterY,
    modeHintFontSize: scaledFontSizePx(BOTTOM_MODE_HINT_FONT_ART, scale),
    expandModeHintCenterY,
    expandModeHintFontSize: scaledFontSizePx(BOTTOM_EXPAND_MODE_HINT_FONT_ART, scale),
    bandHeight,
  };
}

export function bottomHudBandHeight(viewportW: number, viewportH: number): number {
  return computeBottomMenuLayout(viewportW, viewportH).bandHeight;
}

export function bottomHudBandTop(viewportW: number, viewportH: number): number {
  return viewportH - bottomHudBandHeight(viewportW, viewportH);
}

/** Scaled Phaser font size for the expand-mode entry toast (FarmScene). */
export function expandSelectHintToastFontSize(viewportW: number, viewportH: number): string {
  return scaledFontSizePx(EXPAND_SELECT_HINT_TOAST_ART, hudScale(viewportW, viewportH));
}

export interface RightMenuLayout {
  iconCenterY: number[];
  iconSizes: number[];
  iconCenterXs: number[];
  bandWidth: number;
}

/** Right column: expand (top), build, shop (bottom, 1.5% from viewport bottom). */
export function computeRightMenuLayout(
  viewportW: number,
  viewportH: number
): RightMenuLayout {
  const iconSizes = [
    hudRightMenuIconDisplaySizePx(hudRightLandBuildIconWidthPx(viewportW)),
    hudRightMenuIconDisplaySizePx(hudRightLandBuildIconWidthPx(viewportW)),
    hudRightShopIconDisplaySizePx(viewportW),
  ];

  const bottomInset =
    viewportH * HUD_BAG_BOTTOM_VH_FRAC + getHudSafeAreaInsets().bottom;
  const bottomAnchorY = viewportH - bottomInset;
  const gap = hudSpan(RIGHT_ICON_GAP_ART, viewportW, viewportH);
  const iconCenterY = hudIconCenterYsFromBottomMixed(
    bottomAnchorY,
    iconSizes,
    RIGHT_ICON_GAP_ART,
    viewportW,
    viewportH
  );
  if (iconCenterY.length >= 2) {
    const extraLandBuildGap = gap * (HUD_RIGHT_MENU_LAND_BUILD_GAP_MULTIPLIER - 1);
    iconCenterY[0] = iconCenterY[0]! - extraLandBuildGap;
  }

  const iconPad = hudSpan(RIGHT_ICON_PAD_ART, viewportW, viewportH);
  const rightInset =
    viewportW * HUD_RIGHT_MENU_RIGHT_VW_FRAC + getHudSafeAreaInsets().right;
  const bandExtra = hudSpan(RIGHT_BAND_EXTRA_ART, viewportW, viewportH);
  const maxIconW = Math.max(...iconSizes);
  const iconCenterXs = iconSizes.map((size) => viewportW - rightInset - size / 2);
  const bandWidth = maxIconW + 2 * iconPad + rightInset + bandExtra;

  return { iconCenterY, iconSizes, iconCenterXs, bandWidth };
}

export function rightHudBandWidth(viewportW: number, viewportH: number): number {
  return computeRightMenuLayout(viewportW, viewportH).bandWidth;
}

/** Left HUD strip width from the viewport left edge (bag icon + pad). */
export function leftHudBandWidth(viewportW: number, viewportH: number): number {
  const { iconCenterX, iconSize } = computeLeftMenuLayout(viewportW, viewportH);
  const iconPad = hudSpan(RIGHT_ICON_PAD_ART, viewportW, viewportH);
  return iconCenterX + iconSize / 2 + iconPad;
}

/**
 * Nudge the farm centering target along playable width so the iso mass reads centered.
 * Positive X shifts the farm right on screen (corrects “too far left” perception).
 */
export const FARM_VISUAL_CENTER_OFFSET_X_FRAC = 0.1;

/** Optional vertical visual correction (fraction of playable height). */
export const FARM_VISUAL_CENTER_OFFSET_Y_FRAC = 0;

/**
 * Camera / orange pan-bounds center X as a fraction across the playable band width (`0.5` = midpoint).
 * Independent from {@link FARM_VISUAL_CENTER_OFFSET_X_FRAC} (grid tile placement).
 */
export const FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC = 0.5;

/**
 * Camera / orange pan-bounds center Y as a fraction down the playable band height (`0.5` = midpoint).
 * Oversize axes use {@link computeCenteredFarmCameraScroll} with {@link shiftPlayableBandForPanBoundsCenter}.
 */
export const FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC = 0.5;

/**
 * @deprecated Playable-band inset — use {@link FARM_MAP_TOP_PAN_BOUNDS_FRAC} for camera layout.
 * Fraction of playable height from band top; negative = map extends above band top.
 */
export const FARM_MAP_TOP_INSET_FRAC = -0.5;

/**
 * Map-top target row in the 20×20 pan-bounds debug grid (1-based from top).
 * Row 1 is flush with pan top, row 7 means 6 row steps down from pan top.
 */
export const FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX = 7;
/** Total vertical row steps used for pan-bounds map-top mapping (20×20 grid). */
export const FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT = 20;
/** Zero-based row offset from pan top: `rowIndex - 1`. */
export const FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET = FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX - 1;
/**
 * Map 20×20 top target as a fraction down the orange **pan bounds** AABB height.
 * Exact formula: `targetY = panMinY + panHeight * ((rowIndex - 1) / rowCount)`.
 */
export const FARM_MAP_TOP_PAN_BOUNDS_FRAC =
  FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET / FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT;

/**
 * Map-left target column in the 20×20 pan-bounds debug grid (1-based from left).
 * Column 1 is flush with pan left; column 8 means 7 column steps from pan left.
 */
export const FARM_MAP_LEFT_PAN_BOUNDS_COL_INDEX = 8;
/** Total horizontal column steps used for pan-bounds map-left mapping (20×20 grid). */
export const FARM_MAP_LEFT_PAN_BOUNDS_COL_COUNT = 20;
/** Zero-based column offset from pan left: `colIndex - 1`. */
export const FARM_MAP_LEFT_PAN_BOUNDS_COL_OFFSET = FARM_MAP_LEFT_PAN_BOUNDS_COL_INDEX - 1;
/**
 * Map 20×20 left target as a fraction across the orange **pan bounds** AABB width.
 * Exact formula: `targetX = panMinX + panWidth * ((colIndex - 1) / colCount)`.
 */
export const FARM_MAP_LEFT_PAN_BOUNDS_FRAC =
  FARM_MAP_LEFT_PAN_BOUNDS_COL_OFFSET / FARM_MAP_LEFT_PAN_BOUNDS_COL_COUNT;
/** @deprecated Use {@link FARM_MAP_LEFT_PAN_BOUNDS_FRAC}. */
export const FARM_MAP_LEFT_SCREEN_SHIFT_FRAC_OF_PAN = FARM_MAP_LEFT_PAN_BOUNDS_FRAC;

/** Screen-space left shift (px) for the full farm map relative to pan-bounds width. */
export function getFarmMapLeftShiftScreenPx(
  panBoundsWidth: number,
  zoom: number,
  frac: number = FARM_MAP_LEFT_PAN_BOUNDS_FRAC
): number {
  return panBoundsWidth * zoom * frac;
}

/** Pan-bounds vertical span in screen pixels at the given scroll/zoom. */
export type FarmPanBoundsY = { minY: number; maxY: number };

/**
 * Target on-screen Y for the full-map AABB top:
 * `panTopScreen + panHeightScreen * frac` (same as world formula after camera is stable).
 */
export function getFarmMapTopTargetScreenYFromPanBounds(
  panBounds: FarmPanBoundsY,
  scrollY: number,
  zoom: number,
  frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
): number {
  const panTopScreen = (panBounds.minY - scrollY) * zoom;
  const panHeightScreen = (panBounds.maxY - panBounds.minY) * zoom;
  return panTopScreen + panHeightScreen * frac;
}

/** Target on-screen Y for the map AABB top (screen coords; Y grows downward). */
export function getFarmMapTopTargetScreenY(
  playableTop: number,
  playableH: number,
  insetFrac: number = FARM_MAP_TOP_INSET_FRAC
): number {
  return playableTop + playableH * insetFrac;
}

/** @deprecated Use {@link getFarmMapTopTargetScreenY} — same value at scroll 0 / zoom 1. */
export function getFarmMapTopTargetY(playableTop: number, playableH: number): number {
  return getFarmMapTopTargetScreenY(playableTop, playableH);
}

/** Geometric center of the HUD playable inset (yellow debug band). */
export function getPlayableBandGeometricCenter(playable: PlayableBandRect): {
  x: number;
  y: number;
} {
  return {
    x: (playable.playableLeft + playable.playableRight) / 2,
    y: (playable.playableTop + playable.playableBottom) / 2,
  };
}

/** Screen target along playable band edges (fraction of band width/height). */
export function getPlayableBandPanBoundsCenter(playable: PlayableBandRect): {
  x: number;
  y: number;
} {
  const playableW = playable.playableRight - playable.playableLeft;
  const playableH = playable.playableBottom - playable.playableTop;
  return {
    x: playable.playableLeft + playableW * FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
    y: playable.playableTop + playableH * FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  };
}

/** Main camera optical center in screen space (viewport midpoint). */
export function getFarmCameraScreenCenter(
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  return { x: viewportW / 2, y: viewportH / 2 };
}

/**
 * Screen point where orange pan-bounds AABB center should sit.
 * At {@link FARM_PAN_BOUNDS_CENTER_OFFSET_*_FRAC} `0.5`, uses {@link getFarmCameraScreenCenter}
 * (not the HUD playable geometric center).
 */
export function getFarmPanBoundsScrollTargetScreen(
  viewportW: number,
  viewportH: number,
  playable: PlayableBandRect
): { x: number; y: number } {
  if (
    FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC === 0.5 &&
    FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC === 0.5
  ) {
    return getFarmCameraScreenCenter(viewportW, viewportH);
  }
  return getPlayableBandPanBoundsCenter(playable);
}

/**
 * Playable band shifted so its geometric center matches {@link getFarmPanBoundsScrollTargetScreen}.
 * Use with the same band for {@link computeFarmCameraScrollLimits} when pan axes are oversize.
 */
export function shiftPlayableBandForPanBoundsCenter(
  playable: PlayableBandRect,
  viewportW?: number,
  viewportH?: number
): PlayableBandRect {
  const geom = getPlayableBandGeometricCenter(playable);
  const pan =
    viewportW != null && viewportH != null
      ? getFarmPanBoundsScrollTargetScreen(viewportW, viewportH, playable)
      : getPlayableBandPanBoundsCenter(playable);
  const dx = pan.x - geom.x;
  const dy = pan.y - geom.y;
  return {
    playableLeft: playable.playableLeft + dx,
    playableTop: playable.playableTop + dy,
    playableRight: playable.playableRight + dx,
    playableBottom: playable.playableBottom + dy,
  };
}

/**
 * Playable band shifted so its geometric center matches {@link computePlayableFarmViewportLayout}'s
 * visual `centerX`/`centerY` (grid tile placement only).
 */
export function shiftPlayableBandForFarmVisualCenter(
  playable: PlayableBandRect
): PlayableBandRect {
  const playableW = playable.playableRight - playable.playableLeft;
  const playableH = playable.playableBottom - playable.playableTop;
  const dx = playableW * FARM_VISUAL_CENTER_OFFSET_X_FRAC;
  const dy = playableH * FARM_VISUAL_CENTER_OFFSET_Y_FRAC;
  return {
    playableLeft: playable.playableLeft + dx,
    playableTop: playable.playableTop + dy,
    playableRight: playable.playableRight + dx,
    playableBottom: playable.playableBottom + dy,
  };
}

/** Farm camera / grid playable band and its geometric center (equal L/R and T/B margins). */
export type PlayableFarmViewportLayout = {
  playableLeft: number;
  playableTop: number;
  playableRight: number;
  playableBottom: number;
  /** `(playableLeft + playableRight) / 2` — centers farm in the HUD inset rect. */
  centerX: number;
  /** `(playableTop + playableBottom) / 2`. */
  centerY: number;
};

/**
 * Playable inset rect for farm fit/clamp/centering (inset already accounts for HUD chrome).
 * Target center is the geometric midpoint plus {@link FARM_VISUAL_CENTER_OFFSET_*_FRAC} so the
 * farm reads visually balanced. Camera pan/clamp targets
 * {@link getFarmPanBoundsScrollTargetScreen} ({@link FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC}).
 */
export function computePlayableFarmViewportLayout(
  viewportW: number,
  viewportH: number,
  padX = 10,
  padY = 10
): PlayableFarmViewportLayout {
  const topBand = topHudBandHeight(viewportW, viewportH);
  const bottomBand = bottomHudBandHeight(viewportW, viewportH);
  const rightBand = rightHudBandWidth(viewportW, viewportH);
  const leftBand = leftHudBandWidth(viewportW, viewportH);
  const playableLeft = Math.max(padX, leftBand + padX);
  const playableTop = topBand + padY;
  const playableRight = viewportW - rightBand - padX;
  const playableBottom = viewportH - bottomBand - padY;
  const playableW = playableRight - playableLeft;
  const playableH = playableBottom - playableTop;
  const geomCenterX = (playableLeft + playableRight) / 2;
  const geomCenterY = (playableTop + playableBottom) / 2;
  return {
    playableLeft,
    playableTop,
    playableRight,
    playableBottom,
    centerX: geomCenterX + playableW * FARM_VISUAL_CENTER_OFFSET_X_FRAC,
    centerY: geomCenterY + playableH * FARM_VISUAL_CENTER_OFFSET_Y_FRAC,
  };
}

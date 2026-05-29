import { getHudSafeAreaInsets } from '../safeArea';
import { getUiFontScale, scaledFontSizePx } from './uiFontScale';

/** Laptop reference viewport (matches `uiFontScale.ts`). */
export const HUD_REFERENCE_VW = 1920;
export const HUD_REFERENCE_VH = 1080;
export const HUD_REFERENCE_VMIN = Math.min(HUD_REFERENCE_VW, HUD_REFERENCE_VH);

/** Design-time top resource bar (art px at reference vmin). */
const TOP_BAR_H_ART = 50.4; // 48 × 1.05 (+5% height)
const TOP_PAD_ART = 10;
const TOP_EDGE_PAD_ART = 12;
const TOP_SLOT_GAP_ART = 8;
const TOP_SLOT_MAX_W_ART = 330; // 300 × 1.10 (+10% width)
const TOP_VALUE_FONT_ART = 15;
/** Farm playable inset below resource boxes (legacy band was 56 vs pad+bar 58). */
const TOP_BAND_EXTRA_ART = -2;

/** Design-time bottom nav bar (art px at reference vmin). */
const BOTTOM_BAR_H_ART = 64;
const BOTTOM_BOTTOM_INSET_ART = 4;
const BOTTOM_ICON_Y_OFFSET_ART = 10;
const BOTTOM_LABEL_Y_OFFSET_ART = 16;
const BOTTOM_ICON_SIZE_ART = 48;
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

/** Max single slot width as fraction of viewport width (300 / 1920). */
export const TOP_SLOT_MAX_W_FRAC = TOP_SLOT_MAX_W_ART / HUD_REFERENCE_VW;

/** Bottom nav icon centers along X (fractions of viewport width). */
export const BOTTOM_MENU_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

/** Bag (inventory) left HUD: inset from viewport left edge (fraction of width). */
export const HUD_BAG_LEFT_VW_FRAC = 0.03;
/** Right HUD menu (expand / build / shop): inset from viewport right edge (fraction of width). */
export const HUD_RIGHT_MENU_RIGHT_VW_FRAC = 0.03;
/** Bag (inventory) bottom HUD: inset from viewport bottom edge (fraction of height). */
export const HUD_BAG_BOTTOM_VH_FRAC = 0.03;
/** Bag icon display size vs baseline bottom-nav art size. */
export const HUD_BAG_ICON_SIZE_MULTIPLIER = 2.25;
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
  const barH = hudSpan(TOP_BAR_H_ART, viewportW, viewportH);
  const topPad = hudSpan(TOP_PAD_ART, viewportW, viewportH);
  const edgePad = hudSpan(TOP_EDGE_PAD_ART, viewportW, viewportH);
  const slotGap = hudSpan(TOP_SLOT_GAP_ART, viewportW, viewportH);
  const maxSlotW = Math.min(
    hudSpan(TOP_SLOT_MAX_W_ART, viewportW, viewportH),
    Math.floor(viewportW * TOP_SLOT_MAX_W_FRAC)
  );
  const centerY = topPad + barH / 2;
  const totalGap = slotGap * (TOP_SLOT_COUNT - 1);
  const usable = Math.max(0, viewportW - edgePad * 2 - totalGap);
  const slotW = Math.min(maxSlotW, Math.floor(usable / TOP_SLOT_COUNT));

  const slots: HudSlotRect[] = [];
  for (let i = 0; i < TOP_SLOT_COUNT; i++) {
    const centerX = edgePad + slotW / 2 + i * (slotW + slotGap);
    slots.push({ centerX, centerY, width: slotW, height: barH });
  }

  const fontSizePx = scaledFontSizePx(TOP_VALUE_FONT_ART, hudScale(viewportW, viewportH));
  return { slots, fontSizePx };
}

/** Playable-area inset: top pad + bar + small margin (FarmScene / ToolBar). */
export function topHudBandHeight(viewportW: number, viewportH: number): number {
  const barH = hudSpan(TOP_BAR_H_ART, viewportW, viewportH);
  const topPad = hudSpan(TOP_PAD_ART, viewportW, viewportH);
  return topPad + barH + hudSpan(TOP_BAND_EXTRA_ART, viewportW, viewportH);
}

export interface LeftMenuLayout {
  iconCenterX: number;
  iconCenterY: number;
  iconSize: number;
}

/** Left HUD bag: 3% from viewport left/bottom (+ safe area), icon 2.25× baseline nav size. */
export function computeLeftMenuLayout(
  viewportW: number,
  viewportH: number
): LeftMenuLayout {
  const baseIconSize = hudSpan(BOTTOM_ICON_SIZE_ART, viewportW, viewportH);
  const iconSize = Math.max(
    1,
    Math.round(baseIconSize * HUD_BAG_ICON_SIZE_MULTIPLIER)
  );

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

/** Right column: expand (top), build, shop (bottom, 3% from viewport bottom). */
export function computeRightMenuLayout(
  viewportW: number,
  viewportH: number
): RightMenuLayout {
  const iconSizes = [
    hudRightLandBuildIconWidthPx(viewportW),
    hudRightLandBuildIconWidthPx(viewportW),
    hudRightShopIconWidthPx(viewportW),
  ].map((size) =>
    Math.max(1, Math.round(size * HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER))
  );

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

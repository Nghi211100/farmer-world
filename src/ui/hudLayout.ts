import { getUiFontScale, scaledFontSizePx } from './uiFontScale';

/** Laptop reference viewport (matches `uiFontScale.ts`). */
export const HUD_REFERENCE_VW = 1920;
export const HUD_REFERENCE_VH = 1080;
export const HUD_REFERENCE_VMIN = Math.min(HUD_REFERENCE_VW, HUD_REFERENCE_VH);

/** Design-time top resource bar (art px at reference vmin). */
const TOP_BAR_H_ART = 48;
const TOP_PAD_ART = 10;
const TOP_EDGE_PAD_ART = 12;
const TOP_SLOT_GAP_ART = 8;
const TOP_SLOT_MAX_W_ART = 300;
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
/** Tap band above icons (legacy `BOTTOM_HUD_BAND` was 72 at reference). */
const BOTTOM_BAND_EXTRA_ART = 2;

export const TOP_SLOT_COUNT = 3;

/** Max single slot width as fraction of viewport width (300 / 1920). */
export const TOP_SLOT_MAX_W_FRAC = TOP_SLOT_MAX_W_ART / HUD_REFERENCE_VW;

/** Bottom nav icon centers along X (fractions of viewport width). */
export const BOTTOM_MENU_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

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

export interface BottomMenuLayout {
  barCenterY: number;
  iconSize: number;
  iconCenterY: number;
  labelCenterY: number;
  labelFontSize: string;
  modeHintCenterY: number;
  modeHintFontSize: string;
  bandHeight: number;
  buttonCenterX: number[];
}

export function computeBottomMenuLayout(
  viewportW: number,
  viewportH: number
): BottomMenuLayout {
  const barH = hudSpan(BOTTOM_BAR_H_ART, viewportW, viewportH);
  const bottomInset = hudSpan(BOTTOM_BOTTOM_INSET_ART, viewportW, viewportH);
  const iconOffset = hudSpan(BOTTOM_ICON_Y_OFFSET_ART, viewportW, viewportH);
  const labelOffset = hudSpan(BOTTOM_LABEL_Y_OFFSET_ART, viewportW, viewportH);
  const iconSize = hudSpan(BOTTOM_ICON_SIZE_ART, viewportW, viewportH);
  const bandExtra = hudSpan(BOTTOM_BAND_EXTRA_ART, viewportW, viewportH);

  const barCenterY = viewportH - barH / 2 - bottomInset;
  const iconCenterY = barCenterY - iconOffset;
  const labelCenterY = barCenterY + labelOffset;
  const modeHintCenterY = barCenterY - hudSpan(BOTTOM_MODE_HINT_Y_OFFSET_ART, viewportW, viewportH);

  const bandTop = iconCenterY - iconSize / 2 - bandExtra;
  const bandHeight = Math.max(barH + bottomInset, viewportH - bandTop);

  const scale = hudScale(viewportW, viewportH);
  return {
    barCenterY,
    iconSize,
    iconCenterY,
    labelCenterY,
    labelFontSize: scaledFontSizePx(BOTTOM_LABEL_FONT_ART, scale),
    modeHintCenterY,
    modeHintFontSize: scaledFontSizePx(BOTTOM_MODE_HINT_FONT_ART, scale),
    bandHeight,
    buttonCenterX: BOTTOM_MENU_X_FRACS.map((f) => f * viewportW),
  };
}

export function bottomHudBandHeight(viewportW: number, viewportH: number): number {
  return computeBottomMenuLayout(viewportW, viewportH).bandHeight;
}

export function bottomHudBandTop(viewportW: number, viewportH: number): number {
  return viewportH - bottomHudBandHeight(viewportW, viewportH);
}

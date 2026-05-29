/** Native size of `ui/tool-modal.png` — layout fractions are tuned to this art. */
export const TOOL_MODAL_ART_W = 1370;
export const TOOL_MODAL_ART_H = 686;

/**
 * Inner golden frame (brown soil + wooden border) in art pixels.
 * Measured from `src/assets/ui/tool-modal.png` (1370×686); legacy 1536×1024 coords × scale.
 */
export const TOOL_MODAL_FRAME_LEFT_PX = 90;
export const TOOL_MODAL_FRAME_TOP_PX = 86;
export const TOOL_MODAL_FRAME_WIDTH_PX = 1158;
export const TOOL_MODAL_FRAME_HEIGHT_PX = 442;

/**
 * Four tool slots on the brown soil band (above bottom sprout decoration).
 */
export const TOOL_MODAL_SLOT_LEFT_PX = 114;
export const TOOL_MODAL_SLOT_TOP_PX = 117;
export const TOOL_MODAL_SLOT_RIGHT_PX = 1225;
export const TOOL_MODAL_SLOT_BOTTOM_PX = 402;

export const TOOL_MODAL_FRAME_ASPECT =
  TOOL_MODAL_FRAME_WIDTH_PX / TOOL_MODAL_FRAME_HEIGHT_PX;

/**
 * Compact vertical crop of the inner frame: soil band + wooden border, no bottom sprout.
 * Measured from `tool-modal.png` (frame-local bottom ≈ slot band + margin).
 */
export const TOOL_MODAL_FRAME_COMPACT_HEIGHT_PX = 342;

/** Panel width as a fraction of viewport width (phone/tablet/laptop). */
export const TOOL_MODAL_PANEL_WIDTH_FRAC = 0.4;

/**
 * Uniform on-screen scale for the popup (anchor-centered).
 * Logical layout (panelW/H, slots) stays at 1×; FarmScene applies
 * Applied on the popup container only (scrollFactor 0).
 */
export const TOOL_MODAL_VISUAL_SCALE = 0.75;

/**
 * Max panel height as a fraction of viewport height (safety cap).
 * Primary height is `panelW × PANEL_DISPLAY_ASPECT`; this only limits edge cases.
 */
export const TOOL_MODAL_PANEL_MAX_VIEWPORT_HEIGHT_FRAC = 0.14;

/** Max panel width on large screens (px). */
export const TOOL_MODAL_PANEL_MAX_WIDTH_PX = 320;

/** Min panel width on narrow screens (px). */
export const TOOL_MODAL_PANEL_MIN_WIDTH_PX = 148;

/**
 * On-screen aspect (panelH / panelW) — compact bar; full texture is vertically squashed
 * via {@link toolModalTextureCrop} so corner leaves stay visible without tall empty/sprout space.
 */
export const TOOL_MODAL_PANEL_DISPLAY_ASPECT = 0.22;

/** Reference panel width used to tune inner slot/icon px constants (legacy 250). */
export const TOOL_MODAL_LAYOUT_REF_WIDTH_PX = 250;

/** Shift panel/bg upward on screen at reference width (negative Y in Phaser). */
export const TOOL_MODAL_PANEL_SHIFT_Y_REF_PX = -10;

export interface ToolModalPanelSize {
  panelW: number;
  panelH: number;
  /** Uniform scale vs {@link TOOL_MODAL_LAYOUT_REF_WIDTH_PX} layout tuning. */
  scale: number;
  panelShiftY: number;
}

/** Responsive panel size from game viewport dimensions. */
export function toolModalPanelSize(viewportW: number, viewportH: number): ToolModalPanelSize {
  const panelW = Math.round(
    Math.min(
      TOOL_MODAL_PANEL_MAX_WIDTH_PX,
      Math.max(TOOL_MODAL_PANEL_MIN_WIDTH_PX, viewportW * TOOL_MODAL_PANEL_WIDTH_FRAC)
    )
  );
  const panelH = Math.round(
    Math.min(
      panelW * TOOL_MODAL_PANEL_DISPLAY_ASPECT,
      viewportH * TOOL_MODAL_PANEL_MAX_VIEWPORT_HEIGHT_FRAC
    )
  );
  const scale = panelW / TOOL_MODAL_LAYOUT_REF_WIDTH_PX;
  const panelShiftY = Math.round(TOOL_MODAL_PANEL_SHIFT_Y_REF_PX * scale);
  return { panelW, panelH, scale, panelShiftY };
}

/** Screen size for the farm action popup background (matches logical panel). */
export function toolModalFrameDisplaySize(panelW: number, panelH: number): { w: number; h: number } {
  return { w: panelW, h: panelH };
}

/** Art-pixel crop rect for the full inner frame (wooden border; excludes corner leaf art). */
export function toolModalFrameFullCrop(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: TOOL_MODAL_FRAME_LEFT_PX,
    y: TOOL_MODAL_FRAME_TOP_PX,
    width: TOOL_MODAL_FRAME_WIDTH_PX,
    height: TOOL_MODAL_FRAME_HEIGHT_PX,
  };
}

/** Full texture crop (0…ART_W×ART_H) — keeps top corner leaf decorations. */
export function toolModalTextureCrop(texW = TOOL_MODAL_ART_W, texH = TOOL_MODAL_ART_H): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x: 0, y: 0, width: texW, height: texH };
}

/** Art-pixel crop rect for the compact popup background (soil band, no bottom sprout). */
export function toolModalFrameCompactCrop(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: TOOL_MODAL_FRAME_LEFT_PX,
    y: TOOL_MODAL_FRAME_TOP_PX,
    width: TOOL_MODAL_FRAME_WIDTH_PX,
    height: TOOL_MODAL_FRAME_COMPACT_HEIGHT_PX,
  };
}

export const TOOL_MODAL_SLOT_WIDTH_PX =
  TOOL_MODAL_SLOT_RIGHT_PX - TOOL_MODAL_SLOT_LEFT_PX;
export const TOOL_MODAL_SLOT_HEIGHT_PX =
  TOOL_MODAL_SLOT_BOTTOM_PX - TOOL_MODAL_SLOT_TOP_PX;

/**
 * Uniform soil sample inside the slot band (no per-slot dividers or bottom sprout).
 * Used as a single stretch source for `slotBandBg` so the cyan wrapper gets one continuous dirt fill.
 */
export const TOOL_MODAL_SOIL_SAMPLE_WIDTH_PX = 285;
export const TOOL_MODAL_SOIL_SAMPLE_HEIGHT_PX = Math.round(TOOL_MODAL_SLOT_HEIGHT_PX * 0.35);
export const TOOL_MODAL_SOIL_SAMPLE_LEFT_PX =
  TOOL_MODAL_SLOT_LEFT_PX +
  Math.round((TOOL_MODAL_SLOT_WIDTH_PX - TOOL_MODAL_SOIL_SAMPLE_WIDTH_PX) / 2);
export const TOOL_MODAL_SOIL_SAMPLE_TOP_PX =
  TOOL_MODAL_SLOT_TOP_PX + Math.round(TOOL_MODAL_SLOT_HEIGHT_PX * 0.22);

/** Normalized slot band inside the full texture (0–1), matches popup bg stretch. */
export const TOOL_MODAL_SLOT_LEFT_FRAC = TOOL_MODAL_SLOT_LEFT_PX / TOOL_MODAL_ART_W;
export const TOOL_MODAL_SLOT_TOP_FRAC = TOOL_MODAL_SLOT_TOP_PX / TOOL_MODAL_ART_H;
export const TOOL_MODAL_SLOT_WIDTH_FRAC = TOOL_MODAL_SLOT_WIDTH_PX / TOOL_MODAL_ART_W;
export const TOOL_MODAL_SLOT_HEIGHT_FRAC = TOOL_MODAL_SLOT_HEIGHT_PX / TOOL_MODAL_ART_H;

/** Layout tuning at {@link TOOL_MODAL_LAYOUT_REF_WIDTH_PX} — scaled by panel width in {@link toolModalPanelRects}. */

/** Horizontal gap between tool icon hit areas when sizing minimum panel width (px). */
export const TOOL_MODAL_ICON_GAP_REF_PX = 4;

/** Shrink slot band width so icon columns sit closer (px, screen space). */
export const TOOL_MODAL_SLOT_COLS_TIGHTEN_REF_PX = 4;

/**
 * Per-column width shrink of the yellow slot band (px).
 * Total width removed = 4 × this value (20px per icon column).
 */
export const TOOL_MODAL_SLOT_PER_COL_WIDTH_SHRINK_REF_PX = 20;

/** Vertical shrink of the yellow slot band (px, screen space). */
export const TOOL_MODAL_SLOT_BAND_HEIGHT_SHRINK_REF_PX = 20;

/** Extra width for slotBandOuter beyond shrink-derived size (px). */
export const TOOL_MODAL_SLOT_BAND_EXTRA_WIDTH_REF_PX = 20;

/** Extra height for slotBandOuter beyond shrink-derived size (px). */
export const TOOL_MODAL_SLOT_BAND_EXTRA_HEIGHT_REF_PX = 5;

/** Slot-band outer size at reference width (cyan wrapper + soil bg stretch target). */
export const TOOL_MODAL_SLOT_BAND_OUTER_W_REF_PX = 160;
export const TOOL_MODAL_SLOT_BAND_OUTER_H_REF_PX = 44;

/** Inset inside the panel so slot grid/icons clear the wooden frame (px). */
export const TOOL_MODAL_SLOT_BAND_PADDING_REF_PX = 10;

/** Square hit target for each tool icon at reference width (px). */
export const TOOL_MODAL_ICON_HIT_SIZE_REF_PX = 26;

/** Display size for each tool icon at reference width (px). */
export const TOOL_MODAL_ICON_DISPLAY_SIZE_REF_PX = 20;

/**
 * Crop-select seed quantity label sits this many px above the icon hit-box top
 * (at {@link TOOL_MODAL_LAYOUT_REF_WIDTH_PX}); keeps counts off bag art on all viewports.
 */
export const TOOL_MODAL_SEED_QTY_OFFSET_ABOVE_HIT_TOP_REF_PX = 8;

/** Extra shrink on icon hit/display vs panel scale (keeps icons smaller on wide panels). */
export const TOOL_MODAL_ICON_LAYOUT_SCALE_BIAS = 0.92;

function scaleRefPx(refPx: number, scale: number): number {
  return Math.round(refPx * scale);
}

export interface ToolModalScaledLayout {
  iconGapPx: number;
  slotColsTightenPx: number;
  slotBandOuterW: number;
  slotBandOuterH: number;
  slotBandPaddingPx: number;
  iconHitSizePx: number;
  iconDisplaySizePx: number;
}

export function toolModalScaledLayout(scale: number): ToolModalScaledLayout {
  const iconScale = scale * TOOL_MODAL_ICON_LAYOUT_SCALE_BIAS;
  return {
    iconGapPx: scaleRefPx(TOOL_MODAL_ICON_GAP_REF_PX, scale),
    slotColsTightenPx: scaleRefPx(TOOL_MODAL_SLOT_COLS_TIGHTEN_REF_PX, scale),
    slotBandOuterW: scaleRefPx(TOOL_MODAL_SLOT_BAND_OUTER_W_REF_PX, scale),
    slotBandOuterH: scaleRefPx(TOOL_MODAL_SLOT_BAND_OUTER_H_REF_PX, scale),
    slotBandPaddingPx: scaleRefPx(TOOL_MODAL_SLOT_BAND_PADDING_REF_PX, scale),
    iconHitSizePx: scaleRefPx(TOOL_MODAL_ICON_HIT_SIZE_REF_PX, iconScale),
    iconDisplaySizePx: scaleRefPx(TOOL_MODAL_ICON_DISPLAY_SIZE_REF_PX, iconScale),
  };
}

export interface ToolModalPanelRects {
  panelLeft: number;
  panelTop: number;
  panelW: number;
  panelH: number;
  /** Full brown soil band from art fractions (reference; cyan wrapper uses slotBandOuter). */
  slotInnerLeft: number;
  slotInnerTop: number;
  slotInnerW: number;
  slotInnerH: number;
  /** Pre-padding slot band wrapper (contains padded inset + inner grid). */
  slotBandOuterLeft: number;
  slotBandOuterTop: number;
  slotBandOuterW: number;
  slotBandOuterH: number;
  slotLeft: number;
  slotTop: number;
  slotW: number;
  slotH: number;
  iconY: number;
  scale: number;
  iconHitSizePx: number;
  iconDisplaySizePx: number;
}

/** Map frame-normalized fractions to screen pixels inside the panel rect. */
export function toolModalPanelRects(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  scale = panelW / TOOL_MODAL_LAYOUT_REF_WIDTH_PX
): ToolModalPanelRects {
  const scaled = toolModalScaledLayout(scale);
  const slotInset = scaled.slotColsTightenPx / 2;
  const slotLeftNatural = panelLeft + TOOL_MODAL_SLOT_LEFT_FRAC * panelW + slotInset;
  const slotTopNatural = panelTop + TOOL_MODAL_SLOT_TOP_FRAC * panelH;
  const slotWNatural = TOOL_MODAL_SLOT_WIDTH_FRAC * panelW - scaled.slotColsTightenPx;
  const slotHNatural = TOOL_MODAL_SLOT_HEIGHT_FRAC * panelH;
  const slotW = scaled.slotBandOuterW;
  const slotH = scaled.slotBandOuterH;
  /** Center icon row in panel — art Y fractions assume tall texture; squashed panel needs panel-center anchoring. */
  const slotBandOuterLeft = panelLeft + (panelW - slotW) / 2;
  const slotBandOuterTop = panelTop + (panelH - slotH) / 2;
  const slotInnerLeft = slotLeftNatural;
  const slotInnerTop = slotTopNatural;
  const slotInnerW = slotWNatural;
  const slotInnerH = slotHNatural;
  const slotLeft = slotBandOuterLeft + scaled.slotBandPaddingPx;
  const slotTop = slotBandOuterTop + scaled.slotBandPaddingPx;
  const slotWPadded = slotW - scaled.slotBandPaddingPx * 2;
  const slotHPadded = slotH - scaled.slotBandPaddingPx * 2;
  const iconY = slotTop + slotHPadded / 2;
  return {
    panelLeft,
    panelTop,
    panelW,
    panelH,
    slotInnerLeft,
    slotInnerTop,
    slotInnerW,
    slotInnerH,
    slotBandOuterLeft,
    slotBandOuterTop,
    slotBandOuterW: slotW,
    slotBandOuterH: slotH,
    slotLeft,
    slotTop,
    slotW: slotWPadded,
    slotH: slotHPadded,
    iconY,
    scale,
    iconHitSizePx: scaled.iconHitSizePx,
    iconDisplaySizePx: scaled.iconDisplaySizePx,
  };
}

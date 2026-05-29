import {
  computeModalPanelSize,
  isModalMobileLandscape,
  logicalViewportFromGame,
} from './modalPanelSize';

/** Laptop baseline for modal typography (matches common dev viewport). */
export const UI_FONT_REFERENCE_VIEWPORT_W = 1920;
export const UI_FONT_REFERENCE_VIEWPORT_H = 1080;

/** Breakpoints on min(viewportW, viewportH). */
export const UI_FONT_BREAKPOINT_PHONE = 600;
export const UI_FONT_BREAKPOINT_TABLET = 1024;

/** Tier multipliers layered on panel cover scale (artSpanH ratio). */
export const UI_FONT_SCALE_PHONE = 0.88;
export const UI_FONT_SCALE_TABLET = 0.94;
export const UI_FONT_SCALE_LAPTOP = 1;

export type UiViewportTier = 'phone' | 'tablet' | 'laptop';

export function getUiViewportTier(viewportW: number, viewportH: number): UiViewportTier {
  const vmin = Math.min(viewportW, viewportH);
  if (vmin < UI_FONT_BREAKPOINT_PHONE) return 'phone';
  if (vmin < UI_FONT_BREAKPOINT_TABLET) return 'tablet';
  return 'laptop';
}

/** Viewport tier scale: phone < tablet < laptop (default 1). */
export function getUiFontScale(viewportW: number, viewportH: number): number {
  const tier = getUiViewportTier(viewportW, viewportH);
  if (tier === 'phone') return UI_FONT_SCALE_PHONE;
  if (tier === 'tablet') return UI_FONT_SCALE_TABLET;
  return UI_FONT_SCALE_LAPTOP;
}

/** Modal typography tier — phone landscape uses tablet scale (matches HUD). */
export function getModalUiFontScale(
  viewportW: number,
  viewportH: number,
  scaleZoom = 1
): number {
  if (isModalMobileLandscape(viewportW, viewportH, scaleZoom)) {
    return UI_FONT_SCALE_TABLET;
  }
  const { width, height } = logicalViewportFromGame(viewportW, viewportH, scaleZoom);
  return getUiFontScale(width, height);
}

/** Round base design px for Phaser Text / DOM overlays. */
export function scaledFontSize(basePx: number, scale: number): number {
  return Math.max(1, Math.round(basePx * scale));
}

export function scaledFontSizePx(basePx: number, scale: number): string {
  return `${scaledFontSize(basePx, scale)}px`;
}

/**
 * Vertical art-span at 1 art px vs reference laptop panel (contain-fit proxy:
 * `panelH / artH` at reference viewport).
 */
export function referenceModalArtSpanH(
  artW: number,
  artH: number,
  viewportW: number,
  viewportH: number,
  modalSizeFn: typeof computeModalPanelSize = computeModalPanelSize
): number {
  const { panelH } = modalSizeFn(viewportW, viewportH, artW, artH);
  return panelH / artH;
}

/** Current panel cover scale relative to reference `artSpanH(1)`. */
export function panelArtSpanRatio(
  artSpanH: (artPx: number) => number,
  referenceArtSpanH: number
): number {
  if (referenceArtSpanH <= 0) return 1;
  return artSpanH(1) / referenceArtSpanH;
}

/**
 * Combined typography scale for object-cover modals:
 * `getUiFontScale(vw,vh) × (artSpanH(1) / referenceArtSpanH)`.
 */
export function getModalTypographyScale(
  viewportW: number,
  viewportH: number,
  artSpanH: (artPx: number) => number,
  artW: number,
  artH: number,
  modalSizeFn: typeof computeModalPanelSize = computeModalPanelSize,
  referenceViewportW: number = UI_FONT_REFERENCE_VIEWPORT_W,
  referenceViewportH: number = UI_FONT_REFERENCE_VIEWPORT_H,
  scaleZoom = 1
): number {
  const viewportScale = getModalUiFontScale(viewportW, viewportH, scaleZoom);
  const refSpan = referenceModalArtSpanH(
    artW,
    artH,
    referenceViewportW,
    referenceViewportH,
    modalSizeFn
  );
  return viewportScale * panelArtSpanRatio(artSpanH, refSpan);
}

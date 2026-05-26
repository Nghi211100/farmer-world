/** Viewport fractions shared by warehouse modal (1536×1024 art). */
export const PANEL_WIDTH_FRAC = 0.96;
export const PANEL_HEIGHT_FRAC = 0.88;

/** Shop modal — maximize within viewport while preserving art aspect (contain). */
export const SHOP_PANEL_WIDTH_FRAC = 1;
export const SHOP_PANEL_HEIGHT_FRAC = 1;

export type ModalPanelFitMode = 'contain' | 'fillViewportBox';

export interface ModalPanelSizeOptions {
  widthFrac?: number;
  heightFrac?: number;
  /**
   * `contain` — preserve art aspect inside the viewport cap box (warehouse default).
   * `fillViewportBox` — use full width×height caps in every orientation; `object-fit: cover`
   *   crops the texture when the panel aspect differs from art (portrait vs landscape).
   */
  fit?: ModalPanelFitMode;
}

/**
 * Fit modal panel to viewport while preserving art aspect ratio (contain).
 * `panelH` is always `panelW / aspect` — never `viewportH * frac` alone.
 */
export function computeModalPanelSize(
  viewportW: number,
  viewportH: number,
  artW: number,
  artH: number,
  options?: ModalPanelSizeOptions
): { panelW: number; panelH: number } {
  const widthFrac = options?.widthFrac ?? PANEL_WIDTH_FRAC;
  const heightFrac = options?.heightFrac ?? PANEL_HEIGHT_FRAC;
  const aspect = artW / artH;
  const maxW = viewportW * widthFrac;
  const maxH = viewportH * heightFrac;

  if (options?.fit === 'fillViewportBox') {
    return { panelW: maxW, panelH: maxH };
  }

  let panelW = maxW;
  let panelH = panelW / aspect;
  if (panelH > maxH) {
    panelH = maxH;
    panelW = panelH * aspect;
  }
  return { panelW, panelH };
}

/**
 * Shop: largest contain-fit panel (up to 100%×100% caps). Preserves 1536×1024 aspect so
 * layout fractions stay inside the visible region; `applyImageObjectCover` only trims texture margins.
 */
export function computeShopModalPanelSize(
  viewportW: number,
  viewportH: number,
  artW: number,
  artH: number
): { panelW: number; panelH: number } {
  return computeModalPanelSize(viewportW, viewportH, artW, artH, {
    widthFrac: SHOP_PANEL_WIDTH_FRAC,
    heightFrac: SHOP_PANEL_HEIGHT_FRAC,
    fit: 'contain',
  });
}

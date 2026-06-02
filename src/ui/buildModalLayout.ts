/** Bottom sheet build modal height (viewport px). */
export const BUILD_MODAL_PANEL_HEIGHT = 300;

/** Use compact typography/spacing only at or below this panel height. */
export const BUILD_MODAL_COMPACT_MAX_HEIGHT = 120;

/** Item cards visible in the horizontal scroll viewport at once. */
export const BUILD_MODAL_VISIBLE_CARD_SLOTS = 5;

export type BuildTabId = 'buildings' | 'decor' | 'livestock';

export const BUILD_TABS: ReadonlyArray<{ id: BuildTabId; label: string }> = [
  { id: 'buildings', label: 'Buildings' },
  { id: 'decor', label: 'Decor' },
  { id: 'livestock', label: 'Chăn nuôi' },
];

export interface BuildModalLayout {
  viewportW: number;
  viewportH: number;
  cx: number;
  cy: number;
  panelW: number;
  panelH: number;
  headerH: number;
  tabRowH: number;
  innerPad: number;
  innerPanelW: number;
  innerPanelH: number;
  innerLeft: number;
  innerTop: number;
  scrollViewportW: number;
  scrollViewportH: number;
  scrollLeft: number;
  scrollTop: number;
  cardW: number;
  cardH: number;
  cardGap: number;
  visibleCardSlots: number;
  closeRadius: number;
  /** Extra left inset for the tab row (viewport px, 2% of width). */
  tabRowPadLeft: number;
  /** Subtracted from close button X (viewport px, 1% of width). */
  closeShiftLeft: number;
  fontScale: number;
  compact: boolean;
}

/** Full viewport width, fixed panel height. */
export function computeBuildModalPanelSize(
  viewportW: number,
  _viewportH: number
): { panelW: number; panelH: number } {
  return { panelW: viewportW, panelH: BUILD_MODAL_PANEL_HEIGHT };
}

/** Panel-local layout (origin at modal center). Bottom-anchored in viewport space. */
export function computeBuildModalLayout(
  viewportW: number,
  viewportH: number,
  fontScale: number
): BuildModalLayout {
  const { panelW, panelH } = computeBuildModalPanelSize(viewportW, viewportH);
  const cx = viewportW / 2;
  const cy = viewportH - panelH / 2;
  const compact = panelH <= BUILD_MODAL_COMPACT_MAX_HEIGHT;

  /** Reserved for close control only; no title row above tabs. */
  const headerH = 0;
  const tabRowH = compact ? Math.min(40, panelH * 0.14) : Math.min(52, panelH * 0.17);
  const innerPad = Math.min(10, Math.max(6, panelW * 0.012));
  const innerVerticalGap = 2;
  const innerPanelW = panelW - innerPad * 2;
  const innerPanelH = Math.max(
    24,
    panelH - headerH - tabRowH - innerVerticalGap * 2
  );
  const innerLeft = -panelW / 2 + innerPad;
  const innerTop = -panelH / 2 + headerH + tabRowH + innerVerticalGap;

  const scrollPadX = Math.max(4, innerPanelW * 0.02);
  const scrollPadY = Math.max(2, innerPanelH * 0.05);
  const scrollViewportW = innerPanelW - scrollPadX * 2;
  const scrollViewportH = innerPanelH - scrollPadY * 2;
  const scrollLeft = innerLeft + scrollPadX;
  const scrollTop = innerTop + scrollPadY;

  const cardH = Math.max(28, scrollViewportH * 0.92);
  const cardGap = Math.max(4, scrollViewportW * 0.012);
  const visibleCardSlots = BUILD_MODAL_VISIBLE_CARD_SLOTS;
  const cardW =
    (scrollViewportW - (visibleCardSlots - 1) * cardGap) / visibleCardSlots;
  const closeRadius = Math.max(10, Math.min(14, panelH * 0.12 * fontScale));
  const tabRowPadLeft = viewportW * 0.02;
  const closeShiftLeft = viewportW * 0.01;
  const layoutFontScale = compact ? fontScale * 0.72 : fontScale;

  return {
    viewportW,
    viewportH,
    cx,
    cy,
    panelW,
    panelH,
    headerH,
    tabRowH,
    innerPad,
    innerPanelW,
    innerPanelH,
    innerLeft,
    innerTop,
    scrollViewportW,
    scrollViewportH,
    scrollLeft,
    scrollTop,
    cardW,
    cardH,
    cardGap,
    visibleCardSlots,
    closeRadius,
    tabRowPadLeft,
    closeShiftLeft,
    fontScale: layoutFontScale,
    compact,
  };
}

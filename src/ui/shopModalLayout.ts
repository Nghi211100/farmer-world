import { isModalMobileLandscape } from './modalPanelSize';

/** Layout/design canvas — hit boxes and fractions are tuned in this space. */
export const SHOP_ART_W = 1536;
export const SHOP_ART_H = 1024;

/** Shop modal horizontal layout: 11 columns across the full panel width. */
export const SHOP_MODAL_LAYOUT_COLS = 11;
/** Absolute width increase (fraction of inner modal width) applied to columns 1 and 2. */
export const SHOP_MODAL_COL_1_2_EXTRA_WIDTH_FRAC = 0.006;
/** Absolute width reduction (fraction of inner modal width) applied to columns 3 through 9. */
export const SHOP_MODAL_COL_3_9_REDUCTION_FRAC = 0.002;
/** Fractional inset on top/left/right modal panel edges for inner content layout. */
export const SHOP_MODAL_PADDING_FRAC = 0.02;
/** Extra bottom inset: `SHOP_MODAL_PADDING_FRAC + 0.03` → 5% of panel height. */
export const SHOP_MODAL_PADDING_BOTTOM_FRAC = 0.05;

export interface ShopModalVerticalInset {
  paddingTop: number;
  paddingBottom: number;
  innerH: number;
  /** Panel-local Y of the inner content bottom edge. */
  innerBottom: number;
}

/** Top/bottom padding and usable inner height for row resolvers. */
export function resolveShopModalVerticalInset(panelH = SHOP_ART_H): ShopModalVerticalInset {
  const paddingTop = panelH * SHOP_MODAL_PADDING_FRAC;
  const paddingBottom = panelH * SHOP_MODAL_PADDING_BOTTOM_FRAC;
  const innerH = Math.max(0, panelH - paddingTop - paddingBottom);
  return {
    paddingTop,
    paddingBottom,
    innerH,
    innerBottom: panelH - paddingBottom,
  };
}
export const SHOP_LAYOUT_HEADER_ROW_TOP_FRAC = 0;
export const SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC = 0.15;
export const SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC = SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC;
export const SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC = 0.85;

/**
 * Column mapping on `shopModalContainer` (1-based, inclusive spans):
 * | Cols | Zone        |
 * |------|-------------|
 * | 1–2  | Category tabs |
 * | 3–9  | Product grid scroll viewport |
 * | 10–11 | Detail panel |
 */
export const SHOP_LAYOUT_TABS_COL_START = 1;
export const SHOP_LAYOUT_TABS_COL_SPAN = 2;
export const SHOP_LAYOUT_GRID_COL_START = 3;
export const SHOP_LAYOUT_GRID_COL_SPAN = 7;
export const SHOP_LAYOUT_DETAIL_COL_START = 10;
export const SHOP_LAYOUT_DETAIL_COL_SPAN = 2;
/** Row-2 detail content: left inset as fraction of the cols 10–11 band width. */
export const SHOP_DETAIL_CONTENT_PAD_LEFT_FRAC = 0;
/** Row-2 detail content: right inset as fraction of the cols 10–11 band width. */
export const SHOP_DETAIL_CONTENT_PAD_RIGHT_FRAC = 0.12;

/** Build normalized per-column width fractions for the 11-col band. */
function buildShopModalColumnWidthFracs(): number[] {
  const colCount = SHOP_MODAL_LAYOUT_COLS;
  const adjustments = new Array<number>(colCount).fill(0);
  adjustments[0] = SHOP_MODAL_COL_1_2_EXTRA_WIDTH_FRAC;
  adjustments[1] = SHOP_MODAL_COL_1_2_EXTRA_WIDTH_FRAC;
  for (let i = 2; i <= 8; i++) adjustments[i] = -SHOP_MODAL_COL_3_9_REDUCTION_FRAC;
  const totalAdjustment = adjustments.reduce((sum, value) => sum + value, 0);
  const compensationIndices: number[] = [];
  for (let i = 0; i < colCount; i++) {
    if (i >= 9) compensationIndices.push(i);
  }
  const compensationPerCol =
    compensationIndices.length > 0 ? -totalAdjustment / compensationIndices.length : 0;
  const fracs = adjustments.map((adjustment, idx) =>
    compensationIndices.includes(idx)
      ? 1 / colCount + adjustment + compensationPerCol
      : 1 / colCount + adjustment
  );
  const sum = fracs.reduce((acc, value) => acc + value, 0);
  return sum > 0 ? fracs.map((value) => value / sum) : new Array<number>(colCount).fill(1 / colCount);
}

export const SHOP_MODAL_COLUMN_WIDTH_FRACS = buildShopModalColumnWidthFracs();

export const SHOP_GRID_COLS = 4;
export const SHOP_GRID_ROWS_DESKTOP = 2;
export const SHOP_GRID_ROWS_PHONE_LANDSCAPE = 2;
export const SHOP_CATEGORY_TAB_COUNT = 6;

/** Tab + product grid parent height: row 2 (85% of panel). */
export const SHOP_CONTENT_LISTS_HEIGHT_FRAC = SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC;

/** Product list scroll viewport width vs column band (cols 3–9). */
export const SHOP_ITEM_GRID_WIDTH_SCALE = 1.0;
/** Desktop: viewport 15% taller than baked art band. Phone: fit 4×2 without extra stretch. */
export const SHOP_ITEM_GRID_HEIGHT_SCALE_DESKTOP = 1.15;
export const SHOP_ITEM_GRID_HEIGHT_SCALE_PHONE = 1.0;
/** Vertical nudge for product grid viewport inside row 2 (layout art px; negative moves up). */
export const SHOP_ITEM_GRID_OFFSET_Y_PX = -8;
/** Top/bottom inset inside the cols 3–9 product zone (fraction of zone height). */
export const SHOP_ITEM_GRID_MARGIN_TOP_FRAC = 0.05;
export const SHOP_ITEM_GRID_MARGIN_BOTTOM_FRAC = 0.04;
/** Inner padding above product cards inside the scroll viewport (fraction of zone height). */
export const SHOP_ITEM_GRID_PAD_TOP_FRAC = 0;
/** Scroll viewport height as fraction of the product zone band (91% with 5% top + 4% bottom inset). */
export const SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC =
  1 - SHOP_ITEM_GRID_MARGIN_TOP_FRAC - SHOP_ITEM_GRID_MARGIN_BOTTOM_FRAC;

export interface ShopProductGridViewportInset {
  marginTopPx: number;
  marginBottomPx: number;
  /** Offset from the product zone top edge to the scroll viewport top. */
  viewportTopOffsetPx: number;
  viewportHeightPx: number;
}

/** Inset product scroll viewport within the cols 3–9 row-2 zone (5% top + 4% bottom). */
export function resolveShopProductGridViewportInset(
  zoneHeightPx: number
): ShopProductGridViewportInset {
  const marginTopPx = zoneHeightPx * SHOP_ITEM_GRID_MARGIN_TOP_FRAC;
  const marginBottomPx = zoneHeightPx * SHOP_ITEM_GRID_MARGIN_BOTTOM_FRAC;
  const viewportHeightPx = Math.max(0, zoneHeightPx - marginTopPx - marginBottomPx);
  return {
    marginTopPx,
    marginBottomPx,
    viewportTopOffsetPx: marginTopPx,
    viewportHeightPx,
  };
}

/** Row-2 product scroll viewport band (inset within {@link resolveShopContentRowRect}). */
export function resolveShopProductGridViewportRowRect(panelH = SHOP_ART_H): ShopModalRowRect {
  const contentRow = resolveShopContentRowRect(panelH);
  const inset = resolveShopProductGridViewportInset(contentRow.heightPanelPx);
  const artInset = resolveShopContentRowRect(SHOP_ART_H);
  const artZoneInset = resolveShopProductGridViewportInset(artInset.heightPanelPx);
  return {
    topFrac:
      SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC +
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
    heightFrac: SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
    topPx: artInset.topPx + artZoneInset.viewportTopOffsetPx,
    heightPx: artZoneInset.viewportHeightPx,
    topPanelPx: contentRow.topPanelPx + inset.viewportTopOffsetPx,
    heightPanelPx: inset.viewportHeightPx,
  };
}

/** @deprecated Tab stack fits the modal band; kept for tier API compatibility. */
export const SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_DESKTOP = 0;
export const SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_PHONE = 0;

/** Horizontal inset inside the cols 1–2 tab zone (layout art px). */
export const CATEGORY_TAB_ZONE_PAD_X_PX = 2;
/** Vertical gap between stacked category tabs (layout art px). */
export const CATEGORY_TAB_ZONE_GAP_Y_PX = 0;
/** Default shop tab sprite size from asset config (`stores/*.png`). */
export const SHOP_CATEGORY_TAB_SPRITE_W_PX = 260;
export const SHOP_CATEGORY_TAB_SPRITE_H_PX = 136;

/** Size six category tabs to fill the tab column band (panel-local px). */
export function computeCategoryTabDimensionsFromZone(
  zoneWidth: number,
  zoneHeight: number,
  tabCount = SHOP_CATEGORY_TAB_COUNT,
  padX = 0,
  gapY = 0,
  preferredTabW?: number,
  preferredTabH?: number
): { tabW: number; tabH: number; scaledStep: number; contentH: number } {
  const tabW =
    preferredTabW != null && preferredTabW > 0
      ? preferredTabW
      : Math.max(8, zoneWidth - 2 * padX);
  const tabH =
    preferredTabH != null && preferredTabH > 0
      ? preferredTabH
      : Math.max(8, (zoneHeight - (tabCount - 1) * gapY) / tabCount);
  const scaledStep = tabH + gapY;
  const contentH = tabCount * tabH + (tabCount - 1) * gapY;
  return { tabW, tabH, scaledStep, contentH };
}

export interface ShopLayoutTier {
  phoneLandscape: boolean;
  tabsWidthFrac: number;
  gridWidthFrac: number;
  detailWidthFrac: number;
  gridRows: number;
  gridPageSize: number;
  itemGridHeightScale: number;
  categoryTabListMinHeightPx: number;
  contentListsHeightFrac: number;
  contentLeftFrac: number;
  contentTabsRightFrac: number;
  gridLeftFrac: number;
  gridViewportWidthFrac: number;
  gridViewportHeightFrac: number;
  detailLeftFrac: number;
  detailArtWidthFrac: number;
  detailHeightFrac: number;
  gridTopFrac: number;
  contentWidthFrac: number;
  layoutCols: number;
  tabsColStart: number;
  tabsColSpan: number;
  gridColStart: number;
  gridColSpan: number;
  detailColStart: number;
  detailColSpan: number;
  headerRowTopFrac: number;
  headerRowHeightFrac: number;
  contentRowTopFrac: number;
  contentRowHeightFrac: number;
}

export interface ShopModalColRect {
  /** Legacy design-canvas px at 1536×1024 (proportional to full-art columns). */
  leftPx: number;
  widthPx: number;
  /** Fraction of modal panel width (0–1): column index on an 11-col grid. */
  leftFrac: number;
  widthFrac: number;
  /** Column start / width in panel-local px for a panel of `panelW`. */
  leftPanelPx: number;
  widthPanelPx: number;
}

export interface ShopModalRowRect {
  topFrac: number;
  heightFrac: number;
  topPx: number;
  heightPx: number;
  topPanelPx: number;
  heightPanelPx: number;
}

/**
 * 11-column resolver on the modal panel with inset padding:
 * - `paddingX = panelW * SHOP_MODAL_PADDING_FRAC`
 * - `innerW = panelW - 2 * paddingX`
 * - per-column widths from {@link SHOP_MODAL_COLUMN_WIDTH_FRACS}
 * Returns panel-local `leftPanelPx` / `widthPanelPx` and matching `leftFrac` / `widthFrac`.
 */
export function resolveShopModalColRect(
  colStart: number,
  colSpan: number,
  panelW = SHOP_ART_W
): ShopModalColRect {
  const clampedColStart = Math.min(SHOP_MODAL_LAYOUT_COLS, Math.max(1, Math.floor(colStart)));
  const clampedColSpan = Math.min(
    SHOP_MODAL_LAYOUT_COLS - clampedColStart + 1,
    Math.max(1, Math.floor(colSpan))
  );
  const paddingX = panelW * SHOP_MODAL_PADDING_FRAC;
  const innerW = Math.max(0, panelW - 2 * paddingX);
  const colWidths = SHOP_MODAL_COLUMN_WIDTH_FRACS.map((frac) => innerW * frac);
  const startIdx = clampedColStart - 1;
  const endIdx = startIdx + clampedColSpan;
  let leftPanelPx = paddingX;
  for (let i = 0; i < startIdx; i++) leftPanelPx += colWidths[i] ?? 0;
  let widthPanelPx = 0;
  for (let i = startIdx; i < endIdx; i++) widthPanelPx += colWidths[i] ?? 0;
  const leftFrac = panelW > 0 ? leftPanelPx / panelW : 0;
  const widthFrac = panelW > 0 ? widthPanelPx / panelW : 0;
  const leftPx = leftFrac * SHOP_ART_W;
  const widthPx = widthFrac * SHOP_ART_W;
  return {
    leftPx,
    widthPx,
    leftFrac,
    widthFrac,
    leftPanelPx,
    widthPanelPx,
  };
}

/**
 * Cols 10–11 band for row-2 detail content with
 * {@link SHOP_DETAIL_CONTENT_PAD_LEFT_FRAC} and {@link SHOP_DETAIL_CONTENT_PAD_RIGHT_FRAC}
 * insets (each as a fraction of the full detail band width).
 */
export function resolveShopDetailContentColRect(panelW = SHOP_ART_W): ShopModalColRect {
  const base = resolveShopModalColRect(
    SHOP_LAYOUT_DETAIL_COL_START,
    SHOP_LAYOUT_DETAIL_COL_SPAN,
    panelW
  );
  const padLeft = base.widthPanelPx * SHOP_DETAIL_CONTENT_PAD_LEFT_FRAC;
  const padRight = base.widthPanelPx * SHOP_DETAIL_CONTENT_PAD_RIGHT_FRAC;
  const leftPanelPx = base.leftPanelPx + padLeft;
  const widthPanelPx = Math.max(0, base.widthPanelPx - padLeft - padRight);
  const leftFrac = panelW > 0 ? leftPanelPx / panelW : 0;
  const widthFrac = panelW > 0 ? widthPanelPx / panelW : 0;
  const leftPx = leftFrac * SHOP_ART_W;
  const widthPx = widthFrac * SHOP_ART_W;
  return {
    ...base,
    leftPx,
    widthPx,
    leftFrac,
    widthFrac,
    leftPanelPx,
    widthPanelPx,
  };
}

/**
 * Vertical row resolver on the full modal panel.
 * Fractions are clamped to [0..1] and height never exceeds remaining panel space.
 * - `paddingTop = panelH * SHOP_MODAL_PADDING_FRAC`
 * - `paddingBottom = panelH * SHOP_MODAL_PADDING_BOTTOM_FRAC`
 * - `innerH = panelH - paddingTop - paddingBottom`
 */
/** Row 2 band (tabs + grid + detail): 15% / 85% of inner height below header. */
export function resolveShopContentRowRect(panelH = SHOP_ART_H): ShopModalRowRect {
  return resolveShopModalRowRect(
    SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
    SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
    panelH
  );
}

/** Tab column scroll band height in panel-local px (same as content row height). */
export function categoryTabListModalAvailableHeightPx(panelH = SHOP_ART_H): number {
  return resolveShopContentRowRect(panelH).heightPanelPx;
}

/**
 * Map a design-canvas art px rect (1536×1024) to panel-local px using the same
 * padding + 11-column + 15/85 row model as {@link resolveShopModalColRect} /
 * {@link resolveShopModalRowRect} (not object-cover texture mapping).
 */
export function mapShopArtRectToPanelLocal(
  artX0: number,
  artY0: number,
  artX1: number,
  artY1: number,
  panelW = SHOP_ART_W,
  panelH = SHOP_ART_H
): {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const artInset = resolveShopModalVerticalInset(SHOP_ART_H);
  const contentTopArt =
    artInset.paddingTop + SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC * artInset.innerH;
  const contentSpanArt = Math.max(1, artInset.innerBottom - contentTopArt);

  const contentArt = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, SHOP_ART_W);
  const contentPanel = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, panelW);
  const contentRow = resolveShopContentRowRect(panelH);

  const relX0 = (artX0 - contentArt.leftPx) / contentArt.widthPx;
  const relX1 = (artX1 - contentArt.leftPx) / contentArt.widthPx;
  const relY0 = (artY0 - contentTopArt) / contentSpanArt;
  const relY1 = (artY1 - contentTopArt) / contentSpanArt;

  const left = contentPanel.leftPanelPx + relX0 * contentPanel.widthPanelPx;
  const right = contentPanel.leftPanelPx + relX1 * contentPanel.widthPanelPx;
  const top = contentRow.topPanelPx + relY0 * contentRow.heightPanelPx;
  const bottom = contentRow.topPanelPx + relY1 * contentRow.heightPanelPx;

  const width = right - left;
  const height = bottom - top;
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

export function resolveShopModalRowRect(
  topFrac: number,
  heightFrac: number,
  panelH = SHOP_ART_H
): ShopModalRowRect {
  const clampedTopFrac = Math.min(1, Math.max(0, topFrac));
  const clampedHeightFrac = Math.min(1 - clampedTopFrac, Math.max(0, heightFrac));
  const { paddingTop, innerH } = resolveShopModalVerticalInset(panelH);
  const topPanelPx = paddingTop + clampedTopFrac * innerH;
  const heightPanelPx = clampedHeightFrac * innerH;
  const artInset = resolveShopModalVerticalInset(SHOP_ART_H);
  return {
    topFrac: clampedTopFrac,
    heightFrac: clampedHeightFrac,
    topPx: artInset.paddingTop + clampedTopFrac * artInset.innerH,
    heightPx: clampedHeightFrac * artInset.innerH,
    topPanelPx,
    heightPanelPx,
  };
}

function buildContentFracs(): Pick<
  ShopLayoutTier,
  | 'contentLeftFrac'
  | 'contentTabsRightFrac'
  | 'gridLeftFrac'
  | 'gridViewportWidthFrac'
  | 'gridViewportHeightFrac'
  | 'detailLeftFrac'
  | 'detailArtWidthFrac'
  | 'detailHeightFrac'
  | 'gridTopFrac'
  | 'contentWidthFrac'
> {
  const tabsRect = resolveShopModalColRect(SHOP_LAYOUT_TABS_COL_START, SHOP_LAYOUT_TABS_COL_SPAN);
  const gridRect = resolveShopModalColRect(SHOP_LAYOUT_GRID_COL_START, SHOP_LAYOUT_GRID_COL_SPAN);
  const detailRect = resolveShopModalColRect(SHOP_LAYOUT_DETAIL_COL_START, SHOP_LAYOUT_DETAIL_COL_SPAN);
  const contentRect = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS);
  return {
    contentLeftFrac: contentRect.leftFrac,
    contentTabsRightFrac: tabsRect.leftFrac + tabsRect.widthFrac,
    gridLeftFrac: gridRect.leftFrac,
    gridViewportWidthFrac: gridRect.widthFrac * SHOP_ITEM_GRID_WIDTH_SCALE,
    // Product grid scroll viewport is inset 5% top + 4% bottom inside the cols 3–9 zone.
    gridTopFrac:
      SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC +
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
    gridViewportHeightFrac:
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
    detailLeftFrac: detailRect.leftFrac,
    detailArtWidthFrac: detailRect.widthFrac,
    detailHeightFrac: SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
    contentWidthFrac: contentRect.widthFrac,
  };
}

/** Resolve shop modal content layout for the current logical viewport. */
export function resolveShopLayoutTier(
  viewportW: number,
  viewportH: number,
  scaleZoom = 1
): ShopLayoutTier {
  const phoneLandscape = isModalMobileLandscape(viewportW, viewportH, scaleZoom);
  const tabsWidthFrac = resolveShopModalColRect(
    SHOP_LAYOUT_TABS_COL_START,
    SHOP_LAYOUT_TABS_COL_SPAN
  ).widthFrac;
  const gridWidthFrac = resolveShopModalColRect(
    SHOP_LAYOUT_GRID_COL_START,
    SHOP_LAYOUT_GRID_COL_SPAN
  ).widthFrac;
  const detailWidthFrac = resolveShopModalColRect(
    SHOP_LAYOUT_DETAIL_COL_START,
    SHOP_LAYOUT_DETAIL_COL_SPAN
  ).widthFrac;
  const gridRows = phoneLandscape ? SHOP_GRID_ROWS_PHONE_LANDSCAPE : SHOP_GRID_ROWS_DESKTOP;
  const itemGridHeightScale = phoneLandscape
    ? SHOP_ITEM_GRID_HEIGHT_SCALE_PHONE
    : SHOP_ITEM_GRID_HEIGHT_SCALE_DESKTOP;

  return {
    phoneLandscape,
    tabsWidthFrac,
    gridWidthFrac,
    detailWidthFrac,
    gridRows,
    gridPageSize: SHOP_GRID_COLS * gridRows,
    itemGridHeightScale,
    categoryTabListMinHeightPx: phoneLandscape
      ? SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_PHONE
      : SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_DESKTOP,
    contentListsHeightFrac: SHOP_CONTENT_LISTS_HEIGHT_FRAC,
    ...buildContentFracs(),
    layoutCols: SHOP_MODAL_LAYOUT_COLS,
    tabsColStart: SHOP_LAYOUT_TABS_COL_START,
    tabsColSpan: SHOP_LAYOUT_TABS_COL_SPAN,
    gridColStart: SHOP_LAYOUT_GRID_COL_START,
    gridColSpan: SHOP_LAYOUT_GRID_COL_SPAN,
    detailColStart: SHOP_LAYOUT_DETAIL_COL_START,
    detailColSpan: SHOP_LAYOUT_DETAIL_COL_SPAN,
    headerRowTopFrac: SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
    headerRowHeightFrac: SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
    contentRowTopFrac: SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
    contentRowHeightFrac: SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
  };
}

/** Target/content height for the category tab stack; viewport matches content (no scroll clip). */
export function categoryTabListHeightsFromModalAvailable(
  modalAvailableH: number,
  minHeightPx: number
): { targetH: number; contentH: number; viewportH: number } {
  const bandH = modalAvailableH > 0 ? modalAvailableH : minHeightPx;
  const targetH = Math.max(bandH, minHeightPx);
  const contentH = targetH;
  const viewportH = contentH;
  return { targetH, contentH, viewportH };
}

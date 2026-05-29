import { expect, test } from '@playwright/test';
import {
  SHOP_CATEGORY_TAB_COUNT,
  SHOP_LAYOUT_DETAIL_COL_SPAN,
  SHOP_LAYOUT_DETAIL_COL_START,
  SHOP_MODAL_LAYOUT_COLS,
  categoryTabListHeightsFromModalAvailable,
  categoryTabListModalAvailableHeightPx,
  mapShopArtRectToPanelLocal,
  resolveShopContentRowRect,
  resolveShopDetailContentColRect,
  resolveShopModalColRect,
  resolveShopProductGridViewportInset,
  SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
  SHOP_ITEM_GRID_PAD_TOP_FRAC,
  SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
} from '../../src/ui/shopModalLayout';

/** Item ids passed into browser evaluate (not bundled in page context). */
const WHEAT_SEED = 'wheat_seed';
const CORN_SEED = 'corn_seed';
const CANDY = 'candy';

const SHOP_ART_W = 1536;
const SHOP_ART_H = 1024;
/** Panel contain-fit aspect (layout math). */
const SHOP_MODAL_ASPECT_W = 1399;
const SHOP_MODAL_ASPECT_H = 782;
/** Loaded `ui/shop-modal.png` pixels — object-cover crop (may differ from modal aspect). */
const SHOP_TEXTURE_W = 1399;
const SHOP_TEXTURE_H = 782;
/** Matches ShopPanel inner UI nudge (fracX/fracY only). */
const SHOP_INNER_OFFSET_X_PX = -10;
const SHOP_INNER_OFFSET_Y_PX = -10;
const SHOP_INNER_OFFSET_X_FRAC = 0.025;
const SHOP_INNER_OFFSET_Y_FRAC = 0.04;
const SHOP_MODAL_PADDING_FRAC = 0.02;
const SHOP_MODAL_PADDING_BOTTOM_FRAC = 0.05;

function shopModalVerticalInset(panelH: number): {
  paddingTop: number;
  paddingBottom: number;
  innerH: number;
  innerBottom: number;
} {
  const paddingTop = panelH * SHOP_MODAL_PADDING_FRAC;
  const paddingBottom = panelH * SHOP_MODAL_PADDING_BOTTOM_FRAC;
  const innerH = Math.max(0, panelH - paddingTop - paddingBottom);
  return { paddingTop, paddingBottom, innerH, innerBottom: panelH - paddingBottom };
}
/** Matches ShopPanel `SHOP_UI_SCALE` — inner layout from panel center. */
const SHOP_UI_SCALE = 1.0;
/** Matches ShopPanel `SHOP_CONTENT_LISTS_WIDTH_FRAC`. */
const SHOP_CONTENT_LISTS_WIDTH_FRAC = 1.0;
/** Matches ShopPanel `SHOP_CONTENT_LISTS_HEIGHT_FRAC`. */
const SHOP_CONTENT_LISTS_HEIGHT_FRAC = 0.85;
const SHOP_CONTENT_LISTS_TOP_FRAC = 0.15;
const PANEL_WIDTH_FRAC = 1;
const PANEL_HEIGHT_FRAC = 1;
const MODAL_MOBILE_LANDSCAPE_SHORT_VMIN = 600;
const MODAL_MOBILE_LANDSCAPE_WIDTH_FRAC = 1;
const MODAL_MOBILE_LANDSCAPE_HEIGHT_FRAC = 1;
const MODAL_PANEL_MAX_WIDTH_PX = 1680;
/** Matches `modalPanelSize.ts` — shop panel height after contain-fit. */
const SHOP_MODAL_HEIGHT_SCALE = 1.0;

function isModalMobileLandscape(viewportW: number, viewportH: number): boolean {
  const vmin = Math.min(viewportW, viewportH);
  return viewportW > viewportH && vmin < MODAL_MOBILE_LANDSCAPE_SHORT_VMIN;
}

function clampPanelWidth(
  panelW: number,
  panelH: number,
  maxPanelWidthPx: number | undefined
): { panelW: number; panelH: number } {
  if (maxPanelWidthPx == null || panelW <= maxPanelWidthPx) {
    return { panelW, panelH };
  }
  const scale = maxPanelWidthPx / panelW;
  return { panelW: maxPanelWidthPx, panelH: panelH * scale };
}

function expectedModalPanelSize(
  viewportW: number,
  viewportH: number,
  variant: 'shop' | 'warehouse'
): { panelW: number; panelH: number } {
  const aspect =
    variant === 'shop' ? SHOP_MODAL_ASPECT_W / SHOP_MODAL_ASPECT_H : SHOP_ART_W / SHOP_ART_H;
  const mobile = isModalMobileLandscape(viewportW, viewportH);
  const widthFrac = mobile ? MODAL_MOBILE_LANDSCAPE_WIDTH_FRAC : PANEL_WIDTH_FRAC;
  const heightFrac = mobile ? MODAL_MOBILE_LANDSCAPE_HEIGHT_FRAC : PANEL_HEIGHT_FRAC;
  const maxW = viewportW * widthFrac;
  const maxH = viewportH * heightFrac;
  const vmin = Math.min(viewportW, viewportH);
  const maxPanelWidthPx =
    !mobile && vmin >= MODAL_MOBILE_LANDSCAPE_SHORT_VMIN && viewportW > viewportH
      ? MODAL_PANEL_MAX_WIDTH_PX
      : undefined;

  let panelW = maxW;
  let panelH = panelW / aspect;
  if (panelH > maxH) {
    panelH = maxH;
    panelW = panelH * aspect;
  }
  return clampPanelWidth(panelW, panelH, maxPanelWidthPx);
}

function expectedShopPanelSize(viewportW: number, viewportH: number): { panelW: number; panelH: number } {
  const base = expectedModalPanelSize(viewportW, viewportH, 'shop');
  return { panelW: base.panelW, panelH: base.panelH * SHOP_MODAL_HEIGHT_SCALE };
}

function expectedWarehousePanelSize(viewportW: number, viewportH: number): { panelW: number; panelH: number } {
  return expectedModalPanelSize(viewportW, viewportH, 'warehouse');
}

/** Matches ShopPanel `computeObjectCoverCrop` / `artPxToScreen` for layout assertions. */
function computeObjectCoverCrop(
  texW: number,
  texH: number,
  targetW: number,
  targetH: number
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const scale = Math.max(targetW / texW, targetH / texH);
  const cropW = targetW / scale;
  const cropH = targetH / scale;
  const cropX = (texW - cropW) / 2;
  const cropY = (texH - cropH) / 2;
  return { cropX, cropY, cropW, cropH };
}

function expectPanelBackgroundObjectCover(
  panel: {
    panelW: number;
    panelH: number;
    bgTargetW: number;
    bgTargetH: number;
    bgDisplayW: number;
    bgDisplayH: number;
  bgTexW: number;
  bgTexH: number;
    bgCropX: number;
    bgCropY: number;
    bgCropW: number;
    bgCropH: number;
  }
): void {
  const bgW = panel.bgTargetW ?? panel.panelW;
  const bgH = panel.bgTargetH ?? panel.panelH;
  expect(bgW).toBeCloseTo(panel.panelW, 0);
  expect(bgH).toBeCloseTo(panel.panelH, 0);
  const expected = computeObjectCoverCrop(panel.bgTexW, panel.bgTexH, bgW, bgH);
  expect(panel.bgDisplayW).toBeCloseTo(bgW, 0);
  expect(panel.bgDisplayH).toBeCloseTo(bgH, 0);
  expect(panel.bgCropX).toBeCloseTo(expected.cropX, 0);
  expect(panel.bgCropY).toBeCloseTo(expected.cropY, 0);
  expect(panel.bgCropW).toBeCloseTo(expected.cropW, 1);
  expect(panel.bgCropH).toBeCloseTo(expected.cropH, 1);
  expect(panel.bgCropX + panel.bgCropW / 2).toBeCloseTo(panel.bgTexW / 2, 0);
  expect(panel.bgCropY + panel.bgCropH / 2).toBeCloseTo(panel.bgTexH / 2, 0);
  expect(panel.bgCropW / panel.bgCropH).toBeCloseTo(bgW / bgH, 3);
}

/** Runtime cover crop from ShopPanel `shopCoverCrop` (optional; matches object-cover on panel bg). */
type ShopCoverCrop = {
  texW: number;
  texH: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

function artFracToScreen(
  xFrac: number,
  yFrac: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  coverCrop?: ShopCoverCrop
): { x: number; y: number } {
  const texW = coverCrop?.texW ?? SHOP_TEXTURE_W;
  const texH = coverCrop?.texH ?? SHOP_TEXTURE_H;
  const crop =
    coverCrop ??
    computeObjectCoverCrop(texW, texH, panelW, panelH);
  const artX = xFrac * SHOP_ART_W;
  const artY = yFrac * SHOP_ART_H;
  const tx = artX * (texW / SHOP_ART_W);
  const ty = artY * (texH / SHOP_ART_H);
  const u = crop.cropW > 0 ? (tx - crop.cropX) / crop.cropW : 0;
  const v = crop.cropH > 0 ? (ty - crop.cropY) / crop.cropH : 0;
  const panelCenterX = panelLeft + panelW / 2;
  const panelCenterY = panelTop + panelH / 2;
  const paddingX = panelW * SHOP_MODAL_PADDING_FRAC;
  const { paddingTop, innerH } = shopModalVerticalInset(panelH);
  const innerW = Math.max(0, panelW - 2 * paddingX);
  const mappedX = panelLeft + paddingX + u * innerW;
  const mappedY = panelTop + paddingTop + v * innerH;
  return {
    x:
      panelCenterX +
      (mappedX - panelCenterX) * SHOP_UI_SCALE +
      SHOP_INNER_OFFSET_X_PX +
      SHOP_INNER_OFFSET_X_FRAC * panelW,
    y:
      panelCenterY +
      (mappedY - panelCenterY) * SHOP_UI_SCALE +
      SHOP_INNER_OFFSET_Y_PX +
      SHOP_INNER_OFFSET_Y_FRAC * panelH,
  };
}

function shopCoverCropFromPanel(panel: {
  bgTexW: number;
  bgTexH: number;
  bgCropX: number;
  bgCropY: number;
  bgCropW: number;
  bgCropH: number;
}): ShopCoverCrop {
  return {
    texW: panel.bgTexW,
    texH: panel.bgTexH,
    cropX: panel.bgCropX,
    cropY: panel.bgCropY,
    cropW: panel.bgCropW,
    cropH: panel.bgCropH,
  };
}

function artFracSpanW(
  fracW: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  coverCrop?: ShopCoverCrop
): number {
  return Math.abs(
    artFracToScreen(fracW, 0, panelLeft, panelTop, panelW, panelH, coverCrop).x -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH, coverCrop).x
  );
}

function artFracSpanH(
  fracH: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  coverCrop?: ShopCoverCrop
): number {
  return Math.abs(
    artFracToScreen(0, fracH, panelLeft, panelTop, panelW, panelH, coverCrop).y -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH, coverCrop).y
  );
}

function resolveShopModalRowRect(
  topFrac: number,
  heightFrac: number,
  panelH: number
): { topPanelPx: number; heightPanelPx: number; topFrac: number; heightFrac: number } {
  const { paddingTop, innerH } = shopModalVerticalInset(panelH);
  const topPanelPx = paddingTop + topFrac * innerH;
  const heightPanelPx = heightFrac * innerH;
  return {
    topPanelPx,
    heightPanelPx,
    topFrac: topPanelPx / panelH,
    heightFrac: heightPanelPx / panelH,
  };
}

function panelColScreenX(
  colStart: number,
  colSpan: number,
  panelLeft: number,
  panelW: number
): { left: number; width: number; centerX: number; right: number } {
  const col = resolveShopModalColRect(colStart, colSpan, panelW);
  return {
    left: panelLeft + col.leftPanelPx,
    width: col.widthPanelPx,
    centerX: panelLeft + col.leftPanelPx + col.widthPanelPx / 2,
    right: panelLeft + col.leftPanelPx + col.widthPanelPx,
  };
}

const GRID_COLS = 4;
const GRID_ROWS_DESKTOP = 2;
const GRID_ROWS_PHONE_LANDSCAPE = 2;
const SHOP_LAYOUT_COLS = 11;
const TABS_COL_START = 1;
const TABS_COL_SPAN = 2;
const GRID_COL_START = 3;
const GRID_COL_SPAN = 7;
const DETAIL_COL_START = 10;
const DETAIL_COL_SPAN = 2;
const CLOSE_COL_START = 11;
const CLOSE_COL_SPAN = 1;
const SHOP_ITEM_GRID_WIDTH_SCALE = 1.0;
const SHOP_ITEM_GRID_HEIGHT_SCALE_DESKTOP = 1.15;
const SHOP_ITEM_GRID_HEIGHT_SCALE_PHONE = 1.0;
const GRID_CONTENT_PAD_LEFT_PX = 20;
const GRID_CONTENT_PAD_RIGHT_PX = 15;
const SHOP_ITEM_GRID_MARGIN_TOP_FRAC_E2E = SHOP_ITEM_GRID_MARGIN_TOP_FRAC;
const SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC_E2E = SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC;
const SHOP_ITEM_CARD_SCALE = 0.95;
const SHOP_ITEM_ROW_HEIGHT_SCALE = 1;
const GRID_HIT_H_FRAC = 0.9;

/** Matches ShopPanel tab-list sizing exports. */
const SHOP_CATEGORY_TAB_LIST_HEIGHT_FRAC = 1;
const SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_DESKTOP = 0;
const SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_PHONE = 0;
const SHOP_CATEGORY_TAB_SPRITE_W_PX = 260;
const SHOP_CATEGORY_TAB_SPRITE_H_PX = 136;

function resolveLayoutTier(viewportW: number, viewportH: number): {
  gridRows: number;
  tabsWidthFrac: number;
  gridWidthFrac: number;
  detailWidthFrac: number;
  gridLeftFrac: number;
  detailLeftFrac: number;
  gridViewportWidthFrac: number;
  gridViewportHeightFrac: number;
  minTabListHeightPx: number;
  itemGridHeightScale: number;
  headerRowTopFrac: number;
  headerRowHeightFrac: number;
  contentRowTopFrac: number;
  contentRowHeightFrac: number;
} {
  const phoneLandscape = isModalMobileLandscape(viewportW, viewportH);
  const gridRows = phoneLandscape ? GRID_ROWS_PHONE_LANDSCAPE : GRID_ROWS_DESKTOP;
  const tabsWidthFrac = TABS_COL_SPAN / SHOP_LAYOUT_COLS;
  const gridWidthFrac = GRID_COL_SPAN / SHOP_LAYOUT_COLS;
  const detailWidthFrac = DETAIL_COL_SPAN / SHOP_LAYOUT_COLS;
  const gridLeftFrac = (GRID_COL_START - 1) / SHOP_LAYOUT_COLS;
  const gridViewportWidthFrac = (GRID_COL_SPAN / SHOP_LAYOUT_COLS) * SHOP_ITEM_GRID_WIDTH_SCALE;
  const detailLeftFrac = (DETAIL_COL_START - 1) / SHOP_LAYOUT_COLS;
  const itemGridHeightScale = phoneLandscape
    ? SHOP_ITEM_GRID_HEIGHT_SCALE_PHONE
    : SHOP_ITEM_GRID_HEIGHT_SCALE_DESKTOP;
  return {
    gridRows,
    tabsWidthFrac,
    gridWidthFrac,
    detailWidthFrac,
    gridLeftFrac,
    detailLeftFrac,
    gridViewportWidthFrac,
    // Product grid scroll viewport is inset 5% top + 4% bottom inside cols 3–9 zone.
    gridViewportHeightFrac:
      SHOP_CONTENT_LISTS_HEIGHT_FRAC * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC_E2E,
    minTabListHeightPx: phoneLandscape
      ? SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_PHONE
      : SHOP_CATEGORY_TAB_LIST_MIN_HEIGHT_PX_DESKTOP,
    itemGridHeightScale,
    headerRowTopFrac: 0,
    headerRowHeightFrac: 0.15,
    contentRowTopFrac: SHOP_CONTENT_LISTS_TOP_FRAC,
    contentRowHeightFrac: SHOP_CONTENT_LISTS_HEIGHT_FRAC,
  };
}

function expectedCloseButtonScreenX(panelLeft: number, panelW: number): number {
  const closeCol = panelColScreenX(CLOSE_COL_START, CLOSE_COL_SPAN, panelLeft, panelW);
  return closeCol.centerX;
}

const CATEGORY_TAB_COUNT = SHOP_CATEGORY_TAB_COUNT;

function expectedCategoryTabListModalAvailableHeight(
  _panelLeft: number,
  _panelTop: number,
  _panelW: number,
  panelH: number,
  _tier: ReturnType<typeof resolveLayoutTier>,
  _coverCrop?: ShopCoverCrop
): number {
  return categoryTabListModalAvailableHeightPx(panelH);
}

function artSpanOnPanelW(artPx: number, panelW: number): number {
  const contentArt = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, SHOP_ART_W);
  const contentPanel = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, panelW);
  return artPx * (contentPanel.widthPanelPx / contentArt.widthPx);
}

function artSpanOnPanelH(artPx: number, panelH: number): number {
  const inset = shopModalVerticalInset(SHOP_ART_H);
  const contentTopArt = inset.paddingTop + SHOP_CONTENT_LISTS_TOP_FRAC * inset.innerH;
  const contentSpanArt = Math.max(1, inset.innerBottom - contentTopArt);
  return categoryTabListModalAvailableHeightPx(panelH) * (artPx / contentSpanArt);
}

function expectedCategoryTabLayout(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  tier: ReturnType<typeof resolveLayoutTier>,
  _coverCrop?: ShopCoverCrop
): {
  tabScale: number;
  tabW: number;
  tabH: number;
  scaledStep: number;
  viewportTop: number;
  viewportLeft: number;
  viewportH: number;
  viewportW: number;
  contentH: number;
  modalAvailableH: number;
  tabCenter(screenIndex: number): { x: number; y: number };
} {
  const tabsRow = resolveShopModalRowRect(tier.contentRowTopFrac, tier.contentRowHeightFrac, panelH);
  const tabsCol = panelColScreenX(TABS_COL_START, TABS_COL_SPAN, panelLeft, panelW);
  const tabsZone = {
    left: tabsCol.left,
    top: panelTop + tabsRow.topPanelPx,
    width: tabsCol.width,
    height: tabsRow.heightPanelPx,
  };
  const modalAvailableH = tabsZone.height;
  const { contentH, viewportH } = categoryTabListHeightsFromModalAvailable(
    modalAvailableH,
    tier.minTabListHeightPx
  );
  const preferredTabH = artSpanOnPanelH(SHOP_CATEGORY_TAB_SPRITE_H_PX, panelH);
  const gapY = 0;
  const tabW = tabsZone.width;
  const tabH =
    CATEGORY_TAB_COUNT > 0
      ? Math.max(8, (contentH - (CATEGORY_TAB_COUNT - 1) * gapY) / CATEGORY_TAB_COUNT)
      : preferredTabH;
  const scaledStep = tabH + gapY;
  const cx = tabsZone.left + tabsZone.width / 2;
  const viewportLeft = tabsZone.left;
  const viewportTop = tabsZone.top;
  return {
    tabScale: 1,
    tabW,
    tabH,
    scaledStep,
    viewportTop,
    viewportLeft,
    viewportH,
    viewportW: tabsZone.width,
    contentH,
    modalAvailableH,
    tabCenter: (index) => ({
      x: cx,
      y: viewportTop + tabH / 2 + index * scaledStep,
    }),
  };
}

/** Detail price row — baked coin slot + amount band art px; offsets in screen px. */
const DETAIL_COIN_BOX_X0_PX = 1092;
const DETAIL_COIN_BOX_X1_PX = 1162;
const DETAIL_COIN_BOX_Y0_PX = 592;
const DETAIL_COIN_BOX_Y1_PX = 628;
const DETAIL_PRICE_AMOUNT_Y0_PX = 652;
const DETAIL_PRICE_AMOUNT_Y1_PX = 674;
const DETAIL_PRICE_BOX_OFFSET_Y_ART_PX = 30;
const DETAIL_PRICE_BOX_EXTRA_H_PX = 35;
const DETAIL_PRICE_Y_OFFSET_FRAC = 0.07;
const DETAIL_PRICE_BOX_HEIGHT_SCALE = 1.155 * 1.05 * 1.1;
const DETAIL_BUY_X0_PX = 1070;
const DETAIL_BUY_X1_PX = 1330;
const DETAIL_BUY_Y0_PX = 650;
const DETAIL_BUY_Y1_PX = 724;
const DETAIL_BUY_OFFSET_Y_ART_PX = 70;
const DETAIL_BUY_Y_OFFSET_FRAC = 0.15;
const DETAIL_BUY_HEIGHT_SCALE = 1.02;

function expectedDetailBandCenterX(panelLeft: number, panelW: number): number {
  const detail = resolveShopDetailContentColRect(panelW);
  return panelLeft + detail.leftPanelPx + detail.widthPanelPx / 2;
}

function artSpanPxW(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  coverCrop?: ShopCoverCrop
): number {
  return artFracSpanW(artPx / SHOP_ART_W, panelLeft, panelTop, panelW, panelH, coverCrop);
}

function artSpanPxH(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  coverCrop?: ShopCoverCrop
): number {
  return artFracSpanH(artPx / SHOP_ART_H, panelLeft, panelTop, panelW, panelH, coverCrop);
}

function expectedDetailPriceBox(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  _coverCrop?: ShopCoverCrop
): { centerX: number; centerY: number; width: number; height: number } {
  const detail = resolveShopDetailContentColRect(panelW);
  const contentRow = resolveShopContentRowRect(panelH);
  const priceBoxBand = mapShopArtRectToPanelLocal(
    DETAIL_COIN_BOX_X0_PX,
    DETAIL_PRICE_AMOUNT_Y0_PX,
    DETAIL_COIN_BOX_X1_PX,
    DETAIL_PRICE_AMOUNT_Y1_PX,
    panelW,
    panelH
  );
  return {
    centerX: expectedDetailBandCenterX(panelLeft, panelW),
    centerY:
      panelTop +
      priceBoxBand.centerY +
      artSpanOnPanelH(DETAIL_PRICE_BOX_OFFSET_Y_ART_PX, panelH) +
      contentRow.heightPanelPx * DETAIL_PRICE_Y_OFFSET_FRAC,
    width: detail.widthPanelPx,
    height:
      (priceBoxBand.height + artSpanOnPanelH(DETAIL_PRICE_BOX_EXTRA_H_PX, panelH)) *
      DETAIL_PRICE_BOX_HEIGHT_SCALE,
  };
}

function expectedBuyHitCenter(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  _coverCrop?: ShopCoverCrop
): { centerX: number; centerY: number } {
  const rect = mapShopArtRectToPanelLocal(
    DETAIL_BUY_X0_PX,
    DETAIL_BUY_Y0_PX,
    DETAIL_BUY_X1_PX,
    DETAIL_BUY_Y1_PX,
    panelW,
    panelH
  );
  const contentRow = resolveShopContentRowRect(panelH);
  const offsetY =
    artSpanOnPanelH(DETAIL_BUY_OFFSET_Y_ART_PX, panelH) +
    contentRow.heightPanelPx * DETAIL_BUY_Y_OFFSET_FRAC;
  const maxBottom = contentRow.topPanelPx + contentRow.heightPanelPx;
  const height = rect.height * DETAIL_BUY_HEIGHT_SCALE;
  const top = Math.min(rect.top + offsetY, maxBottom - height);
  return {
    centerX: expectedDetailBandCenterX(panelLeft, panelW),
    centerY: panelTop + top + height / 2,
  };
}

interface ShopGridLayout {
  panelW: number;
  panelH: number;
  panelLeft: number;
  panelTop: number;
  gridLeft: number;
  gridTop: number;
  gridW: number;
  gridContentW: number;
  gridContentPadLeft: number;
  gridContentPadRight: number;
  gridContentPadTop: number;
  gridH: number;
  tabListModalAvailableH: number;
  tabListViewportH: number;
  tabListViewportW: number;
  tabListTop: number;
  tabListLeft: number;
  tabItemScale: number;
  tabListContentH: number;
  tabScrollOffset: number;
  tabMaxScrollOffset: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  rowGapPx: number;
  rowOverlapPx: number;
  cardScale: number;
  gridWidthScale: number;
  gapPxV: number;
  row2BottomPx: number;
  row2SlotTopPx: number;
  row2SlotBottomPx: number;
  row2IconTopPx: number;
  row2IconBottomPx: number;
  viewportBottomPx: number;
  row2FitsViewport: boolean;
  row2IconFitsViewport: boolean;
  closeHit: { centerX: number; centerY: number; width: number; height: number };
  categoryTabs: {
    index: number;
    centerX: number;
    centerY: number;
    hitW: number;
    hitH: number;
    glowW: number;
    glowH: number;
    textureKey: string;
  }[];
}

async function waitForGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#game-container canvas', { timeout: 30_000 });
  await page.waitForFunction(
    () => typeof window.__FARMER_WORLD_TEST__ !== 'undefined',
    undefined,
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    () => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.clickBag();
      return api?.isWarehouseOpen() === true;
    },
    undefined,
    { timeout: 30_000 }
  );
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeModals());
}

async function openShop(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShop());
  await expect.poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen())).toBe(true);
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.padShopGridForTest(0));
}

test.describe('Shop modal (Cửa hàng)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForGame(page);
    await openShop(page);
  });

  test('opens with baked SHOP title (no overlay duplicate)', async ({ page }) => {
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopTitle())).toBe('SHOP');

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    const activeCategory = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory());
    expect(layout).not.toBeNull();
    expect(panel).not.toBeNull();
    if (!layout || !panel) return;

    const expected = expectedShopPanelSize(panel.viewportW, panel.viewportH);
    const tier = resolveLayoutTier(panel.viewportW, panel.viewportH);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelW).toBeLessThanOrEqual(panel.viewportW * PANEL_WIDTH_FRAC + 1);
    const baseH = expected.panelH / SHOP_MODAL_HEIGHT_SCALE;
    expect(baseH).toBeLessThanOrEqual(panel.viewportH * PANEL_HEIGHT_FRAC + 1);
    expect(panel.panelLeft).toBeGreaterThanOrEqual(0);
    expect(panel.panelTop).toBeGreaterThanOrEqual(0);
    expect(panel.panelRight).toBeLessThanOrEqual(panel.viewportW + 1);
    expect(panel.panelBottom).toBeLessThanOrEqual(panel.viewportH + 1);
    expectPanelBackgroundObjectCover(panel);
    expect(panel.bgTargetLeft).toBeCloseTo(panel.panelLeft, 0);
    expect(panel.bgTargetTop).toBeCloseTo(panel.panelTop, 0);
    expect(panel.bgTargetLeft + panel.bgTargetW).toBeCloseTo(panel.panelRight, 0);
    expect(panel.bgTargetTop + panel.bgTargetH).toBeCloseTo(panel.panelBottom, 0);

    const paddingX = panel.panelW * SHOP_MODAL_PADDING_FRAC;
    const { paddingTop, innerH } = shopModalVerticalInset(panel.panelH);
    const innerW = Math.max(0, panel.panelW - 2 * paddingX);
    const contentRow = resolveShopContentRowRect(panel.panelH);
    const contentCol = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, panel.panelW);
    expect(panel.contentListsW).toBeCloseTo(contentCol.widthPanelPx * SHOP_CONTENT_LISTS_WIDTH_FRAC, 0);
    expect(panel.contentListsH).toBeCloseTo(contentRow.heightPanelPx, 0);
    expect(panel.contentListsLeft).toBeCloseTo(panel.panelLeft + contentCol.leftPanelPx, 0);
    expect(panel.contentListsTop).toBeCloseTo(panel.panelTop + contentRow.topPanelPx, 0);
    const contentListsRight = panel.contentListsLeft + panel.contentListsW;
    expect(layout.tabListLeft + layout.tabListViewportW).toBeLessThanOrEqual(contentListsRight + 2);
    expect(layout.gridLeft + layout.gridW).toBeLessThanOrEqual(contentListsRight + 2);

    expect(layout.cols).toBe(GRID_COLS);
    expect(layout.rows).toBe(tier.gridRows);

    const coverCrop = shopCoverCropFromPanel(panel);
    const gridCol = panelColScreenX(GRID_COL_START, GRID_COL_SPAN, layout.panelLeft, layout.panelW);
    const expectedGridLeft = gridCol.left;
    const gridZoneInset = resolveShopProductGridViewportInset(contentRow.heightPanelPx);
    const expectedGridTop =
      panel.panelTop + contentRow.topPanelPx + gridZoneInset.viewportTopOffsetPx;
    const expectedGridW = gridCol.width;
    const expectedGridH = gridZoneInset.viewportHeightPx;

    expect(Math.abs(layout.gridLeft - expectedGridLeft)).toBeLessThanOrEqual(3);
    expect(Math.abs(layout.gridTop - expectedGridTop)).toBeLessThanOrEqual(3);
    expect(Math.abs(layout.gridW - expectedGridW)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.gridH - expectedGridH)).toBeLessThanOrEqual(3);
    const tabModalAvailableH = expectedCategoryTabListModalAvailableHeight(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH,
      tier,
      coverCrop
    );
    expect(layout.tabListModalAvailableH).toBeCloseTo(tabModalAvailableH, 0);
    expect(layout.gridContentPadLeft).toBeCloseTo(
      artSpanPxW(
        GRID_CONTENT_PAD_LEFT_PX,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH,
        coverCrop
      ),
      0
    );
    expect(layout.gridContentPadRight).toBeCloseTo(
      artSpanPxW(
        GRID_CONTENT_PAD_RIGHT_PX,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH,
        coverCrop
      ),
      0
    );
    expect(layout.gridContentPadTop).toBeCloseTo(
      contentRow.heightPanelPx * SHOP_ITEM_GRID_PAD_TOP_FRAC,
      0
    );
    expect(layout.gridContentW).toBeCloseTo(
      layout.gridW - layout.gridContentPadLeft - layout.gridContentPadRight,
      0
    );
    expect(layout.cellW).toBeCloseTo(layout.gridContentW / GRID_COLS, 0);
    const rowPitch = (layout.gridH - layout.gridContentPadTop) / 2;
    expect(layout.cellH).toBeCloseTo(rowPitch, 0);
    expect(layout.gridContentPadTop + 2 * rowPitch).toBeLessThanOrEqual(layout.gridH + 2);
    const hitExtent =
      layout.cellH * (0.5 + (GRID_HIT_H_FRAC * SHOP_ITEM_CARD_SCALE) / 2);
    const lastRowBottom =
      layout.gridTop +
      layout.gridContentPadTop +
      (2 - 1) * rowPitch +
      hitExtent;
    expect(lastRowBottom).toBeLessThanOrEqual(layout.gridTop + layout.gridH + 2);
    expect(layout.rowGapPx).toBe(6);
    expect(layout.rowOverlapPx).toBe(0);
    expect(layout.cardScale).toBe(SHOP_ITEM_CARD_SCALE);
    expect(layout.gridWidthScale).toBe(SHOP_ITEM_GRID_WIDTH_SCALE);
    expect(layout.gapPxV).toBeGreaterThanOrEqual(0);
    expect(layout.row2FitsViewport).toBe(true);
    expect(layout.row2BottomPx).toBeLessThanOrEqual(layout.viewportBottomPx + 1);
    expect(layout.row2IconFitsViewport).toBe(true);
    expect(layout.row2IconTopPx).toBeGreaterThanOrEqual(layout.row2SlotTopPx - 1);
    expect(layout.row2IconBottomPx).toBeLessThanOrEqual(layout.row2SlotBottomPx + 1);
    expect(layout.row2IconBottomPx).toBeLessThanOrEqual(layout.viewportBottomPx + 1);

    const closeX = expectedCloseButtonScreenX(layout.panelLeft, layout.panelW);
    const closeY =
      layout.panelTop +
      paddingTop +
      innerH * (tier.headerRowTopFrac + tier.headerRowHeightFrac * 0.5);
    const expectedCloseW = innerW / SHOP_LAYOUT_COLS;
    const expectedCloseH = innerH * tier.headerRowHeightFrac;
    expect(Math.abs(layout.closeHit.centerX - closeX)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.closeHit.centerY - closeY)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.closeHit.width - expectedCloseW)).toBeLessThanOrEqual(3);
    expect(Math.abs(layout.closeHit.height - expectedCloseH)).toBeLessThanOrEqual(3);

    const tabLayout = expectedCategoryTabLayout(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH,
      tier,
      coverCrop
    );
    expect(Math.abs(layout.tabListTop - tabLayout.viewportTop)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.tabListLeft - tabLayout.viewportLeft)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.tabListViewportW - tabLayout.viewportW)).toBeLessThanOrEqual(4);
    expect(Math.abs(layout.tabListViewportH - tabLayout.viewportH)).toBeLessThanOrEqual(4);
    expect(layout.tabItemScale).toBeCloseTo(tabLayout.tabScale, 4);
    expect(layout.tabListContentH).toBeCloseTo(tabLayout.contentH, 0);
    expect(layout.tabMaxScrollOffset).toBe(0);
    expect(layout.tabScrollOffset).toBe(0);
    expect(layout.tabListViewportH).toBeGreaterThanOrEqual(layout.tabListContentH - 1);

    const INDEX_TO_CATEGORY = ['all', 'seeds', 'animals', 'decorations', 'foods', 'resources'] as const;
    const TAB_TEXTURES: Record<
      (typeof INDEX_TO_CATEGORY)[number],
      { inactive: string; active: string }
    > = {
      all: { inactive: 'shop_tab_all', active: 'shop_tab_all_active' },
      seeds: { inactive: 'shop_tab_seeds', active: 'shop_tab_seeds_active' },
      animals: { inactive: 'shop_tab_animals', active: 'shop_tab_animals_active' },
      decorations: { inactive: 'shop_tab_decorations', active: 'shop_tab_decorations_active' },
      foods: { inactive: 'shop_tab_foods', active: 'shop_tab_foods_active' },
      resources: { inactive: 'shop_tab_resources', active: 'shop_tab_resources_active' },
    };

    expect(layout.categoryTabs).toHaveLength(6);
    let prevCenterY = Number.NEGATIVE_INFINITY;
    layout.categoryTabs.forEach((tab, i) => {
      expect(Math.abs(tab.centerX - tabLayout.tabCenter(i).x)).toBeLessThanOrEqual(4);
      expect(tab.centerY).toBeGreaterThan(prevCenterY);
      if (i > 0) {
        expect(Math.abs(tab.centerY - prevCenterY - tabLayout.scaledStep)).toBeLessThanOrEqual(12);
      }
      expect(Math.abs(tab.hitW - tabLayout.tabW)).toBeLessThanOrEqual(4);
      expect(Math.abs(tab.hitH - tabLayout.tabH)).toBeLessThanOrEqual(4);
      expect(tab.glowW).toBeCloseTo(tab.hitW, 0);
      expect(tab.glowH).toBeCloseTo(tab.hitH, 0);
      prevCenterY = tab.centerY;
      const cat = INDEX_TO_CATEGORY[i]!;
      const expectedTexKey = activeCategory === cat ? TAB_TEXTURES[cat].active : TAB_TEXTURES[cat].inactive;
      expect(tab.textureKey).toBe(expectedTexKey);
    });
  });

  test('currency bar hidden in SHOP header', async ({ page }) => {
    const bar = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopCurrencyBar());
    expect(bar).toBeNull();
  });

  test('detail price row layout at 220×band+26, offset +89/+30 (ui_box hidden)', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1));
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopGridSlot(0));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(WHEAT_SEED);

    const priceBox = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetailPriceBox());
    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(priceBox).not.toBeNull();
    expect(layout).not.toBeNull();
    expect(panel).not.toBeNull();
    if (!priceBox || !layout || !panel) return;

    const expected = expectedDetailPriceBox(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH,
      shopCoverCropFromPanel(panel)
    );

    expect(priceBox.visible).toBe(false);
    expect(priceBox.unitPriceAmount).toBe('5');
    expect(Math.abs(priceBox.width - expected.width)).toBeLessThanOrEqual(10);
    expect(Math.abs(priceBox.height - expected.height)).toBeLessThanOrEqual(6);
    expect(Math.abs(priceBox.centerX - expected.centerX)).toBeLessThanOrEqual(10);
    expect(Math.abs(priceBox.centerY - expected.centerY)).toBeLessThanOrEqual(12);
  });

  test('buy CTA hit zone is offset +70px below baked art', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopGridSlot(0));
    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyControls());
    const priceBox = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetailPriceBox());
    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(controls).not.toBeNull();
    expect(priceBox).not.toBeNull();
    expect(layout).not.toBeNull();
    expect(panel).not.toBeNull();
    if (!controls || !priceBox || !layout || !panel) return;

    const expectedBuy = expectedBuyHitCenter(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH,
      shopCoverCropFromPanel(panel)
    );
    expect(Math.abs(controls.buy.centerX - expectedBuy.centerX)).toBeLessThanOrEqual(10);
    expect(Math.abs(controls.buy.centerY - expectedBuy.centerY)).toBeLessThanOrEqual(12);
    expect(controls.buy.centerY).toBeGreaterThan(
      priceBox.centerY + priceBox.height * 0.25
    );
  });

  test('shop modal has no pagination label UI', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('seeds');
    const detail = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    expect(detail?.pageCount).toBe(1);
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopPageLabelVisible())).toBe(
      false
    );
  });

  test('canvas grid clicks switch between seed items', async ({ page }) => {
    const canvas = page.locator('#game-container canvas');
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(WHEAT_SEED);

    const cornClick = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridCanvasClick(1));
    expect(cornClick).not.toBeNull();
    await canvas.click({ position: cornClick! });
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(CORN_SEED);

    const wheatClick = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridCanvasClick(0));
    expect(wheatClick).not.toBeNull();
    await canvas.click({ position: wheatClick! });
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(WHEAT_SEED);
  });

  test('seeds tab shows grid items and detail updates on selection', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('seeds');

    const visible = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount());
    expect(visible).toBeGreaterThanOrEqual(5);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopGridSlot(0));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(WHEAT_SEED);

    const detail = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    expect(detail?.title).toBe('Wheat Seeds');
    expect(detail?.priceLine).toContain('Giá: 5 xu');
    expect(detail?.unitPriceAmount).toBe('5');
    expect(detail?.buyEnabled).toBe(true);

    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), CORN_SEED);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(CORN_SEED);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.priceLine))
      .toContain('Giá: 8 xu');
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.unitPriceAmount))
      .toBe('8');
  });

  test('farming tab lists food items', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(4));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('foods');

    const visible = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount());
    expect(visible).toBeGreaterThanOrEqual(6);

    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), CANDY);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.title))
      .toBe('Candy');
  });

  test('resources tab lists crop resources', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(5));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('resources');

    const visible = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount());
    expect(visible).toBeGreaterThanOrEqual(0);
  });

  test('empty viewport slots always show card background without icon', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(3);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(0);
    });
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('decorations');

    const slots = await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      const out: { hasCardBg: boolean; hasIcon: boolean; itemId: string | null }[] = [];
      for (let i = 0; i < 8; i++) {
        const s = api?.getShopGridSlot(i);
        if (s) out.push(s);
      }
      return out;
    });

    expect(slots.length).toBe(8);
    expect(slots.every((s) => s.hasCardBg)).toBe(true);

    const emptySlots = slots.filter((s) => !s.itemId);
    expect(emptySlots.length).toBeGreaterThan(0);
    expect(emptySlots.every((s) => !s.hasIcon)).toBe(true);
  });

  test('vertical scroll reveals items beyond the first viewport', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(8);
    });

    const before = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopScrollOffset());
    expect(before).toBe(0);

    const layout = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(layout?.maxScrollOffset ?? 0).toBeGreaterThan(0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.shopScrollBy(3000));

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopScrollOffset() ?? 0))
      .toBeGreaterThan(0);

    const visibleAfterScroll = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount() ?? 0
    );
    expect(visibleAfterScroll).toBeGreaterThan(0);
  });

  test('grid page advances via vertical scroll (no pagination UI)', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(1);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(8);
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.pageCount))
      .toBeGreaterThan(1);

    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopPageLabelVisible())).toBe(
      false
    );
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.currentPage)).toBe(
      0
    );

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.shopScrollBy(600));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopScrollOffset() ?? 0))
      .toBeGreaterThan(0);
  });

  test('buy smoke: purchase wheat seeds deducts coins', async ({ page }) => {
    const coinsBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins());
    expect(coinsBefore).toBeGreaterThan(5);

    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    const buyHit = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyHitTest('buy'));
    expect(buyHit?.hitsBuyControl, JSON.stringify(buyHit)).toBe(true);

    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyControls());
    expect(controls).not.toBeNull();
    if (!controls) return;

    await page.mouse.click(controls.buy.clientCenterX, controls.buy.clientCenterY);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins()))
      .toBe((coinsBefore ?? 0) - 5);

    const detailAfter = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    expect(detailAfter?.unitPriceAmount).toBe('5');
    expect(detailAfter?.buyQuantity).toBe(1);
    expect(detailAfter?.buyEnabled).toBe(true);
  });

  test('buy qty minus/plus hit zones adjust quantity', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity())).toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyPlus());
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyPlus());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(3);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyMinus());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(2);

    const detail = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    expect(detail?.buyQuantity).toBe(2);
  });

  test('buy qty canvas clicks adjust quantity', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQtyControls());
    expect(controls).not.toBeNull();
    if (!controls) return;

    const plusHit = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQtyHitTest('plus'));
    expect(plusHit?.topIsBuyControl, JSON.stringify(plusHit)).toBe(true);

    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity())).toBe(1);

    await page.mouse.click(controls.plus.clientCenterX, controls.plus.clientCenterY);
    await page.mouse.click(controls.plus.clientCenterX, controls.plus.clientCenterY);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(3);

    await page.mouse.click(controls.minus.clientCenterX, controls.minus.clientCenterY);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(2);
  });

  test('buy qty field accepts typed input clamped to max', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    const detailBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    const maxQty = detailBefore?.maxBuyQuantity ?? 1;
    expect(maxQty).toBeGreaterThanOrEqual(5);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyField());
    const input = page.locator('input[aria-label="Buy quantity"]');
    await expect(input).toBeVisible();
    await input.fill('5');
    await input.blur();
    await expect(input).toBeHidden();

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(5);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyField());
    await expect(page.locator('input[aria-label="Buy quantity"]')).toBeVisible();
    await page.locator('input[aria-label="Buy quantity"]').fill(String(maxQty + 50));
    await page.locator('input[aria-label="Buy quantity"]').blur();
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity()))
      .toBe(maxQty);
  });

  test('buy qty minus/plus adjusts purchase amount', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity())).toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyPlus());
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyPlus());
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity())).toBe(3);

    const coinsBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins());
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopBuy());

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins()))
      .toBe((coinsBefore ?? 0) - 15);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopQtyMinus());
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQuantity())).toBe(2);
  });


  test('close button dismisses shop', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopClose());
    await expect.poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen())).toBe(false);
  });

  test('background uses object-cover and reapplies after viewport resize', async ({ page }) => {
    const initial = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(initial).not.toBeNull();
    if (!initial) return;
    expectPanelBackgroundObjectCover(initial);

    await page.setViewportSize({ width: 932, height: 430 });
    const resized = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(resized).not.toBeNull();
    if (!resized) return;
    expect(resized.viewportW).toBe(932);
    expect(resized.viewportH).toBe(430);
    expectPanelBackgroundObjectCover(resized);
  });

});

test.describe('Shop modal sizing @1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('panel maximizes viewport (contain, art aspect)', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(panel).not.toBeNull();
    if (!panel) return;

    const expected = expectedShopPanelSize(1920, 1080);
    expect(panel.viewportW).toBe(1920);
    expect(panel.viewportH).toBe(1080);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.artAspect).toBeCloseTo(SHOP_MODAL_ASPECT_W / SHOP_MODAL_ASPECT_H, 3);
    expect(panel.panelW / panel.panelH).toBeCloseTo(panel.artAspect / SHOP_MODAL_HEIGHT_SCALE, 2);
    expect(panel.panelLeft).toBeCloseTo((1920 - expected.panelW) / 2, 0);
    expect(panel.panelTop).toBeCloseTo((1080 - expected.panelH) / 2, 0);

    const tabs = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(tabs).not.toBeNull();
    if (!tabs) return;
    const tier = resolveLayoutTier(1920, 1080);
    const tabLayout = expectedCategoryTabLayout(
      panel.panelLeft,
      panel.panelTop,
      panel.panelW,
      panel.panelH,
      tier
    );
    expect(tabs.tabListContentH).toBeCloseTo(tabLayout.contentH, 0);
    expect(Math.abs(tabs.tabListViewportH - tabLayout.viewportH)).toBeLessThanOrEqual(4);
    expect(tabs.tabMaxScrollOffset).toBe(0);
    expect(tabs.categoryTabs).toHaveLength(6);
  });
});

test.describe('Shop modal sizing @1280×720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('panel maximizes viewport (contain, art aspect)', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(panel).not.toBeNull();
    if (!panel) return;

    const expected = expectedShopPanelSize(1280, 720);
    expect(panel.viewportW).toBe(1280);
    expect(panel.viewportH).toBe(720);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelLeft).toBeCloseTo((1280 - expected.panelW) / 2, 0);
    expect(panel.panelTop).toBeCloseTo((720 - expected.panelH) / 2, 0);
  });
});

test.describe('Shop modal sizing @844×390 landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('phone landscape maximizes height (contain, art aspect)', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(panel).not.toBeNull();
    if (!panel) return;

    const expected = expectedShopPanelSize(844, 390);
    expect(panel.viewportW).toBe(844);
    expect(panel.viewportH).toBe(390);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelH).toBeCloseTo(390 * SHOP_MODAL_HEIGHT_SCALE, 0);
    expect(panel.panelW).toBeLessThan(844);
    expect(panel.panelW / panel.panelH).toBeCloseTo(
      (SHOP_MODAL_ASPECT_W / SHOP_MODAL_ASPECT_H) / SHOP_MODAL_HEIGHT_SCALE,
      2
    );
    expect(panel.panelLeft).toBeCloseTo((844 - expected.panelW) / 2, 0);
    expect(panel.panelTop).toBeCloseTo((390 - expected.panelH) / 2, 0);

    const tabs = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(tabs).not.toBeNull();
    if (!tabs) return;
    const tier = resolveLayoutTier(844, 390);
    const tabLayout = expectedCategoryTabLayout(
      panel.panelLeft,
      panel.panelTop,
      panel.panelW,
      panel.panelH,
      tier
    );
    expect(tabs.tabListModalAvailableH).toBeGreaterThanOrEqual(0);
    expect(tabs.tabListContentH).toBeCloseTo(tabLayout.contentH, 0);
    expect(tabs.tabListContentH).toBeCloseTo(tabLayout.contentH, 0);
    expect(tabs.tabListViewportH).toBeCloseTo(tabLayout.viewportH, 0);
    expect(tabs.tabListViewportH).toBeGreaterThanOrEqual(tabs.tabListModalAvailableH - 1);
    expect(tabs.tabMaxScrollOffset).toBe(0);
    expect(tabs.tabListViewportH).toBeCloseTo(tabLayout.viewportH, 0);
  });
});

test.describe('Shop modal sizing @932×430 landscape', () => {
  test.use({ viewport: { width: 932, height: 430 } });

  test('phone landscape uses 4×2 viewport rows', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    const grid = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(panel).not.toBeNull();
    expect(grid).not.toBeNull();
    if (!panel || !grid) return;

    const expected = expectedShopPanelSize(932, 430);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(grid.rows).toBe(2);
    expect(grid.viewportRows).toBe(2);
    expect(grid.rows).toBe(2);
    expect(grid.row2FitsViewport).toBe(true);
  });
});

test.describe('Shop modal sizing @390×844 portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('portrait uses full width with letterbox (contain)', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(panel).not.toBeNull();
    if (!panel) return;

    const expected = expectedShopPanelSize(390, 844);
    expect(panel.viewportW).toBe(390);
    expect(panel.viewportH).toBe(844);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelW).toBeCloseTo(390, 0);
    expect(panel.panelH).toBeLessThan(panel.viewportH);
    expect(panel.panelW / panel.panelH).toBeCloseTo(
      (SHOP_MODAL_ASPECT_W / SHOP_MODAL_ASPECT_H) / SHOP_MODAL_HEIGHT_SCALE,
      2
    );
    expect(panel.panelTop).toBeGreaterThan(0);
    expect(panel.panelBottom).toBeLessThan(panel.viewportH);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TAB_ZONE_PAD_X_PX,
  SHOP_CATEGORY_TAB_COUNT,
  categoryTabListHeightsFromModalAvailable,
  computeCategoryTabDimensionsFromZone,
  resolveShopModalColRect,
  resolveShopDetailContentColRect,
  resolveShopModalRowRect,
  resolveShopContentRowRect,
  mapShopArtRectToPanelLocal,
  categoryTabListModalAvailableHeightPx,
  SHOP_LAYOUT_DETAIL_COL_SPAN,
  SHOP_LAYOUT_DETAIL_COL_START,
  SHOP_DETAIL_CONTENT_PAD_LEFT_FRAC,
  SHOP_DETAIL_CONTENT_PAD_RIGHT_FRAC,
  SHOP_LAYOUT_GRID_COL_SPAN,
  SHOP_LAYOUT_GRID_COL_START,
  SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
  SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
  SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
  SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
  SHOP_LAYOUT_TABS_COL_SPAN,
  SHOP_LAYOUT_TABS_COL_START,
  SHOP_ART_H,
  SHOP_ART_W,
  SHOP_MODAL_LAYOUT_COLS,
  SHOP_MODAL_COLUMN_WIDTH_FRACS,
  SHOP_MODAL_PADDING_FRAC,
  SHOP_MODAL_PADDING_BOTTOM_FRAC,
  SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
  SHOP_ITEM_GRID_PAD_TOP_FRAC,
  SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
  resolveShopProductGridViewportInset,
  resolveShopProductGridViewportRowRect,
  resolveShopModalVerticalInset,
  resolveShopLayoutTier,
} from '../../src/ui/shopModalLayout';

describe('resolveShopModalColRect', () => {
  it('splits panel width using normalized column fractions', () => {
    const panelW = 1200;
    const paddingX = panelW * SHOP_MODAL_PADDING_FRAC;
    const innerW = panelW - 2 * paddingX;
    const colWidths = SHOP_MODAL_COLUMN_WIDTH_FRACS.map((frac) => innerW * frac);
    const col3 = resolveShopModalColRect(3, 1, panelW);
    const expectedLeft = paddingX + colWidths[0] + colWidths[1];
    expect(col3.leftPanelPx).toBeCloseTo(expectedLeft, 6);
    expect(col3.widthPanelPx).toBeCloseTo(colWidths[2], 6);
    expect(col3.leftFrac).toBeCloseTo(expectedLeft / panelW, 6);
    expect(col3.widthFrac).toBeCloseTo(colWidths[2] / panelW, 6);
  });

  it('maps zone spans to panel-local rects', () => {
    const panelW = 960;
    const paddingX = panelW * SHOP_MODAL_PADDING_FRAC;
    const tabs = resolveShopModalColRect(
      SHOP_LAYOUT_TABS_COL_START,
      SHOP_LAYOUT_TABS_COL_SPAN,
      panelW
    );
    const grid = resolveShopModalColRect(
      SHOP_LAYOUT_GRID_COL_START,
      SHOP_LAYOUT_GRID_COL_SPAN,
      panelW
    );
    const detail = resolveShopModalColRect(
      SHOP_LAYOUT_DETAIL_COL_START,
      SHOP_LAYOUT_DETAIL_COL_SPAN,
      panelW
    );
    expect(tabs.leftPanelPx).toBeCloseTo(paddingX, 6);
    expect(grid.leftPanelPx).toBeCloseTo(tabs.leftPanelPx + tabs.widthPanelPx, 6);
    expect(detail.leftPanelPx).toBeCloseTo(grid.leftPanelPx + grid.widthPanelPx, 6);
    expect(tabs.leftPanelPx + tabs.widthPanelPx).toBeCloseTo(grid.leftPanelPx, 6);
    expect(grid.leftPanelPx + grid.widthPanelPx).toBeCloseTo(detail.leftPanelPx, 6);
    expect(detail.leftPanelPx + detail.widthPanelPx).toBeCloseTo(panelW - paddingX, 6);
  });
});

describe('resolveShopDetailContentColRect', () => {
  it('insets row-2 detail content band by 0% left and 12% right of detail width', () => {
    const panelW = 960;
    const detail = resolveShopModalColRect(
      SHOP_LAYOUT_DETAIL_COL_START,
      SHOP_LAYOUT_DETAIL_COL_SPAN,
      panelW
    );
    const content = resolveShopDetailContentColRect(panelW);
    const padLeft = detail.widthPanelPx * SHOP_DETAIL_CONTENT_PAD_LEFT_FRAC;
    const padRight = detail.widthPanelPx * SHOP_DETAIL_CONTENT_PAD_RIGHT_FRAC;
    expect(content.leftPanelPx).toBeCloseTo(detail.leftPanelPx + padLeft, 6);
    expect(content.widthPanelPx).toBeCloseTo(
      detail.widthPanelPx - padLeft - padRight,
      6
    );
    expect(content.leftFrac).toBeCloseTo(content.leftPanelPx / panelW, 6);
    expect(content.widthFrac).toBeCloseTo(content.widthPanelPx / panelW, 6);
    expect(content.leftPanelPx + content.widthPanelPx).toBeCloseTo(
      detail.leftPanelPx + detail.widthPanelPx - padRight,
      6
    );
  });
});

describe('resolveShopModalRowRect', () => {
  it('splits panel height into 15/85 rows', () => {
    const panelH = 1000;
    const { paddingTop, paddingBottom, innerH, innerBottom } =
      resolveShopModalVerticalInset(panelH);
    const header = resolveShopModalRowRect(
      SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
      SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
      panelH
    );
    const content = resolveShopModalRowRect(
      SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
      panelH
    );
    expect(paddingBottom).toBeCloseTo(panelH * SHOP_MODAL_PADDING_BOTTOM_FRAC, 6);
    expect(innerBottom).toBeCloseTo(panelH - paddingBottom, 6);
    expect(header.topPanelPx).toBeCloseTo(paddingTop, 6);
    expect(header.heightPanelPx).toBeCloseTo(innerH * SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC, 6);
    expect(content.topPanelPx).toBeCloseTo(
      paddingTop + innerH * SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
      6
    );
    expect(content.heightPanelPx).toBeCloseTo(innerH * SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC, 6);
    expect(content.topPanelPx + content.heightPanelPx).toBeCloseTo(innerBottom, 6);
  });
});

describe('mapShopArtRectToPanelLocal', () => {
  it('maps detail BUY band inside the content row', () => {
    const panelH = 782;
    const panelW = (panelH * SHOP_ART_W) / SHOP_ART_H;
    const content = resolveShopContentRowRect(panelH);
    const buy = mapShopArtRectToPanelLocal(1070, 650, 1330, 724, panelW, panelH);
    expect(buy.top).toBeGreaterThanOrEqual(content.topPanelPx - 1);
    expect(buy.top + buy.height).toBeLessThanOrEqual(content.topPanelPx + content.heightPanelPx + 2);
  });

  it('matches category tab list modal band height', () => {
    const panelH = 1000;
    expect(categoryTabListModalAvailableHeightPx(panelH)).toBeCloseTo(
      resolveShopContentRowRect(panelH).heightPanelPx,
      6
    );
  });
});

describe('category tab zone layout', () => {
  it('fits six tabs in the tab column height', () => {
    const zoneW = 200;
    const zoneH = 360;
    const { tabW, tabH, scaledStep, contentH } = computeCategoryTabDimensionsFromZone(
      zoneW,
      zoneH,
      SHOP_CATEGORY_TAB_COUNT,
      CATEGORY_TAB_ZONE_PAD_X_PX,
      0
    );
    expect(tabW).toBe(zoneW - 2 * CATEGORY_TAB_ZONE_PAD_X_PX);
    expect(tabH * SHOP_CATEGORY_TAB_COUNT).toBeCloseTo(zoneH, 6);
    expect(scaledStep).toBe(tabH);
    expect(contentH).toBeCloseTo(zoneH, 6);
  });

  it('matches tab viewport height to full stack (no scroll clip)', () => {
    const heights = categoryTabListHeightsFromModalAvailable(280, 500);
    expect(heights.viewportH).toBe(500);
    expect(heights.contentH).toBe(500);
    expect(heights.targetH).toBe(500);
    expect(heights.viewportH).toBe(heights.contentH);
  });

  it('uses preferred tab sprite dimensions without forcing zone fit', () => {
    const zoneW = 200;
    const zoneH = 260;
    const preferredW = 180;
    const preferredH = 120;
    const { tabW, tabH, scaledStep, contentH } = computeCategoryTabDimensionsFromZone(
      zoneW,
      zoneH,
      SHOP_CATEGORY_TAB_COUNT,
      0,
      0,
      preferredW,
      preferredH
    );
    expect(tabW).toBe(preferredW);
    expect(tabH).toBe(preferredH);
    expect(scaledStep).toBe(preferredH);
    expect(contentH).toBe(preferredH * SHOP_CATEGORY_TAB_COUNT);
    expect(contentH).toBeGreaterThan(zoneH);
  });
});

describe('resolveShopLayoutTier', () => {
  it('uses full-panel column fractions for major zones', () => {
    const tier = resolveShopLayoutTier(1280, 720);
    const grid = resolveShopModalColRect(
      SHOP_LAYOUT_GRID_COL_START,
      SHOP_LAYOUT_GRID_COL_SPAN
    );
    const detail = resolveShopModalColRect(
      SHOP_LAYOUT_DETAIL_COL_START,
      SHOP_LAYOUT_DETAIL_COL_SPAN
    );
    expect(tier.gridLeftFrac).toBeCloseTo(grid.leftFrac, 6);
    expect(tier.detailLeftFrac).toBeCloseTo(detail.leftFrac, 6);
    expect(tier.gridViewportWidthFrac).toBeCloseTo(grid.widthFrac * 1, 6);
    expect(tier.contentWidthFrac).toBeCloseTo(1 - 2 * SHOP_MODAL_PADDING_FRAC, 6);
    expect(tier.contentLeftFrac).toBeCloseTo(SHOP_MODAL_PADDING_FRAC, 6);
    expect(tier.headerRowTopFrac).toBeCloseTo(0, 6);
    expect(tier.headerRowHeightFrac).toBeCloseTo(0.15, 6);
    expect(tier.contentRowTopFrac).toBeCloseTo(0.15, 6);
    expect(tier.contentRowHeightFrac).toBeCloseTo(0.85, 6);

    // Product grid viewport is inset 5% top + 4% bottom inside the cols 3–9 zone.
    expect(tier.gridTopFrac).toBeCloseTo(
      tier.contentRowTopFrac + tier.contentRowHeightFrac * SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
      6
    );
    expect(tier.gridViewportHeightFrac).toBeCloseTo(
      tier.contentRowHeightFrac * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
      6
    );
    expect(tier.detailHeightFrac).toBeCloseTo(tier.contentRowHeightFrac, 6);
  });
});

describe('resolveShopProductGridViewportInset', () => {
  it('insets scroll viewport to 91% of the product zone (5% top + 4% bottom)', () => {
    const zoneH = 400;
    const inset = resolveShopProductGridViewportInset(zoneH);
    expect(inset.marginTopPx).toBeCloseTo(zoneH * 0.05, 6);
    expect(inset.marginBottomPx).toBeCloseTo(zoneH * 0.04, 6);
    expect(inset.viewportTopOffsetPx).toBeCloseTo(zoneH * SHOP_ITEM_GRID_MARGIN_TOP_FRAC, 6);
    expect(inset.viewportHeightPx).toBeCloseTo(zoneH * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC, 6);
    expect(
      inset.viewportTopOffsetPx + inset.viewportHeightPx + inset.marginBottomPx
    ).toBeCloseTo(zoneH, 6);
  });

  it('matches row resolver panel and art px bands', () => {
    const panelH = 1000;
    const contentRow = resolveShopContentRowRect(panelH);
    const viewportRow = resolveShopProductGridViewportRowRect(panelH);
    const inset = resolveShopProductGridViewportInset(contentRow.heightPanelPx);
    expect(viewportRow.topPanelPx).toBeCloseTo(
      contentRow.topPanelPx + inset.viewportTopOffsetPx,
      6
    );
    expect(viewportRow.heightPanelPx).toBeCloseTo(inset.viewportHeightPx, 6);
    expect(viewportRow.heightPanelPx).toBeCloseTo(
      contentRow.heightPanelPx * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
      6
    );
    expect(viewportRow.topFrac).toBeCloseTo(
      SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC +
        SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_MARGIN_TOP_FRAC,
      6
    );
    expect(viewportRow.heightFrac).toBeCloseTo(
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC * SHOP_ITEM_GRID_VIEWPORT_HEIGHT_FRAC,
      6
    );
  });
});

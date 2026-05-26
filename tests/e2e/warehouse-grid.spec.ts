import { expect, test } from '@playwright/test';

const WAREHOUSE_ART_W = 1536;
const WAREHOUSE_ART_H = 1024;
const GRID_LEFT_FRAC = 0.057;
const GRID_TOP_FRAC = 0.234;
const GRID_WIDTH_FRAC = 0.886;
/** Three visible rows inside beige inset on warehouse art. */
const GRID_HEIGHT_FRAC = 0.338;
const GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX = 10;
const GRID_COLS = 10;
const GRID_ROWS_VISIBLE = 3;
const CELL_SLOT_SHRINK_W_ART_PX = 5;
const CELL_SLOT_HEIGHT_EXTRA_ART_PX = 2;
const GRID_TOP_OFFSET_ART_PX = 66;

/** Lv1→2 costs from `WAREHOUSE.upgradeCosts[0]`. */
const EXPECTED_UPGRADE_COST = { coins: 200, wood: 10, stone: 5 };

interface WarehouseGridLayout {
  panelW: number;
  panelH: number;
  panelLeft: number;
  panelTop: number;
  gridLeft: number;
  gridTop: number;
  gridViewportW: number;
  gridViewportH: number;
  gridContentOffsetX: number;
  gridContentW: number;
  cellW: number;
  cellH: number;
  cols: number;
  visibleRows: number;
  scrollOffset: number;
  maxScrollOffset: number;
  slotCount: number;
  debugGrid: boolean;
  upgradePanelCells: { id: string; left: number; top: number; width: number; height: number }[];
  upgradeCostTexts: {
    id: 'coin' | 'wood' | 'stone';
    slotId: string;
    x: number;
    y: number;
    text: string;
  }[];
  sellControlsCells: { id: string; left: number; top: number; width: number; height: number }[];
  headerCells: { id: string; left: number; top: number; width: number; height: number }[];
  activeTab: string;
  capacityFillRatio: number;
  capacityText: { x: number; y: number; originX: number; originY: number };
  tabSprites: {
    id: string;
    cellId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    textureKey: string;
    active: boolean;
  }[];
  closeHit: { centerX: number; centerY: number; radius: number };
}

const CLOSE_BTN_OFFSET_X_PX = -20;
const CLOSE_BTN_OFFSET_X_PANEL_FRAC = 0.05;
const CLOSE_BTN_OFFSET_Y_PX = 40;
const CLOSE_BTN_CENTER_X_FRAC = (1405 + CLOSE_BTN_OFFSET_X_PX) / WAREHOUSE_ART_W;
const CLOSE_BTN_CENTER_Y_FRAC = (120 + CLOSE_BTN_OFFSET_Y_PX) / WAREHOUSE_ART_H;
const CLOSE_BTN_RADIUS_ART_PX = 56;

/** Dark-pill text areas (right of icon), measured from `warehouse.png`. */
const UPGRADE_PANEL_CELLS = [
  { id: 'upgradeIcon', x0: 0.662, y0: 0.688, x1: 0.748, y1: 0.818 },
  { id: 'levelBox', x0: 0.7572, y0: 0.6924, x1: 0.8932, y1: 0.7295 },
  { id: 'capacityBox', x0: 0.7572, y0: 0.7432, x1: 0.8932, y1: 0.7813 },
  { id: 'coinSlot', x0: 0.7044, y0: 0.8223, x1: 0.735, y1: 0.8584 },
  { id: 'woodSlot', x0: 0.776, y0: 0.8223, x1: 0.8118, y1: 0.8584 },
  { id: 'stoneSlot', x0: 0.8542, y0: 0.8233, x1: 0.89, y1: 0.8584 },
] as const;

/** Matches `UPGRADE_COIN_SLOT_EXPAND_LEFT_PX` in InventoryPanel.ts */
const UPGRADE_COIN_SLOT_EXPAND_LEFT_PX = 5;

const COST_SLOT_IDS = ['coinSlot', 'woodSlot', 'stoneSlot'] as const;
const COST_POS_TOLERANCE_PX = 4;

const CAPACITY_TRACK_SLOT_Y0_FRAC = 125 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_SLOT_H_FRAC = 134 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_X0_FRAC = 355 / WAREHOUSE_ART_W;
const CAPACITY_TRACK_OFFSET_X_PANEL_FRAC = -0.01;
const CAPACITY_TRACK_W_FRAC = 668 / WAREHOUSE_ART_W;
const CAPACITY_TRACK_H_FRAC = CAPACITY_TRACK_SLOT_H_FRAC * 0.5;
const CAPACITY_TRACK_Y0_FRAC =
  CAPACITY_TRACK_SLOT_Y0_FRAC + (CAPACITY_TRACK_SLOT_H_FRAC - CAPACITY_TRACK_H_FRAC) / 2;
const CAPACITY_FILL_MAX_W_FRAC = 398 / WAREHOUSE_ART_W;
const CAPACITY_FILL_MAX_TRACK_W_FRAC = CAPACITY_FILL_MAX_W_FRAC / CAPACITY_TRACK_W_FRAC;
const CAPACITY_FILL_OFFSET_X = 42;
const CAPACITY_FILL_OFFSET_X_PANEL_FRAC = 0.0075;
const CAPACITY_FILL_OFFSET_Y_PANEL_FRAC = -0.0025;
const CAPACITY_FILL_H_FRAC = (82 / WAREHOUSE_ART_H) * 0.5;
const CAPACITY_TEXT_PILL_W_FRAC = 84 / WAREHOUSE_ART_W;
const CAPACITY_TEXT_TRACK_X_FRAC = 0.84;
const CAPACITY_TEXT_OFFSET_X_PANEL_FRAC = -0.055;
const CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC = -0.0015;
const CAPACITY_TEXT_PILL_WIDTH_EXTRA_PX = 80;
const CAPACITY_TEXT_PILL_OFFSET_X = -72;
const CAPACITY_TEXT_OFFSET_X = 4;

function artSpanW(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): number {
  return artFracSpanW(artPx / WAREHOUSE_ART_W, panelLeft, panelTop, panelW, panelH);
}

function artSpanH(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): number {
  return artFracSpanH(artPx / WAREHOUSE_ART_H, panelLeft, panelTop, panelW, panelH);
}

function capacityTrackRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number
): { left: number; top: number; width: number; height: number } {
  const base = rectFromArtFrac(
    CAPACITY_TRACK_X0_FRAC,
    CAPACITY_TRACK_X0_FRAC + CAPACITY_TRACK_W_FRAC,
    CAPACITY_TRACK_Y0_FRAC,
    CAPACITY_TRACK_Y0_FRAC + CAPACITY_TRACK_H_FRAC,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const trackOffsetX = panelW * CAPACITY_TRACK_OFFSET_X_PANEL_FRAC;
  return {
    left: base.left + trackOffsetX,
    top: base.top,
    width: base.width,
    height: base.height,
  };
}

function capacityFillRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number
): { left: number; top: number; width: number; height: number } {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop);
  const fillHeight = artSpanH(82, panelLeft, panelTop, panelW, panelH) * 0.5;
  const fillCenterY = track.top + track.height / 2 + panelH * CAPACITY_FILL_OFFSET_Y_PANEL_FRAC;
  const fillTop = fillCenterY - fillHeight / 2;
  const fillMaxWidth = Math.max(
    0,
    track.width * CAPACITY_FILL_MAX_TRACK_W_FRAC -
      artSpanW(CAPACITY_FILL_OFFSET_X, panelLeft, panelTop, panelW, panelH)
  );
  const fillLeft =
    track.left +
    artSpanW(CAPACITY_FILL_OFFSET_X, panelLeft, panelTop, panelW, panelH) +
    panelW * CAPACITY_FILL_OFFSET_X_PANEL_FRAC;
  return { left: fillLeft, top: fillTop, width: fillMaxWidth, height: fillHeight };
}

function capacityTextPillRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number
): { left: number; top: number; width: number; height: number } {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop);
  const pillWidth =
    artSpanW(CAPACITY_TEXT_PILL_W_FRAC * WAREHOUSE_ART_W, panelLeft, panelTop, panelW, panelH) +
    artSpanW(CAPACITY_TEXT_PILL_WIDTH_EXTRA_PX, panelLeft, panelTop, panelW, panelH);
  const centerX =
    track.left +
    track.width * CAPACITY_TEXT_TRACK_X_FRAC +
    artSpanW(CAPACITY_TEXT_PILL_OFFSET_X, panelLeft, panelTop, panelW, panelH) +
    panelW * CAPACITY_TEXT_OFFSET_X_PANEL_FRAC;
  return {
    left: centerX - pillWidth / 2,
    top: track.top,
    width: pillWidth,
    height: track.height,
  };
}

const TAB_DISPLAY_SCALE = 0.5;
const TAB_EXTRA_W_ART_PX = 68;
const TAB_EXTRA_H_ART_PX = 13;
const CAPACITY_TAB_MIN_GAP_ART_PX = 8;
const TAB_ROW_LEFT_ART_PX = 473 - 266 / 2;
const TAB_ROW_RIGHT_ART_PX = 1352.5 + 263 / 2;
const TAB_ROW_LEFT_FRAC = TAB_ROW_LEFT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_RIGHT_FRAC = TAB_ROW_RIGHT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_SCALE = 0.874;

/** Matches InventoryPanel `computeObjectCoverCrop` / `artPxToScreen`. */
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

function artFracToScreen(
  xFrac: number,
  yFrac: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { x: number; y: number } {
  const crop = computeObjectCoverCrop(WAREHOUSE_ART_W, WAREHOUSE_ART_H, panelW, panelH);
  const artX = xFrac * WAREHOUSE_ART_W;
  const artY = yFrac * WAREHOUSE_ART_H;
  const u = crop.cropW > 0 ? (artX - crop.cropX) / crop.cropW : 0;
  const v = crop.cropH > 0 ? (artY - crop.cropY) / crop.cropH : 0;
  return { x: panelLeft + u * panelW, y: panelTop + v * panelH };
}

function artFracSpanW(fracW: number, panelLeft: number, panelTop: number, panelW: number, panelH: number): number {
  return Math.abs(
    artFracToScreen(fracW, 0, panelLeft, panelTop, panelW, panelH).x -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH).x
  );
}

function artFracSpanH(fracH: number, panelLeft: number, panelTop: number, panelW: number, panelH: number): number {
  return Math.abs(
    artFracToScreen(0, fracH, panelLeft, panelTop, panelW, panelH).y -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH).y
  );
}

function rectFromArtFrac(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { left: number; top: number; width: number; height: number } {
  const tl = artFracToScreen(x0, y0, panelLeft, panelTop, panelW, panelH);
  const br = artFracToScreen(x1, y1, panelLeft, panelTop, panelW, panelH);
  return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
}

const WAREHOUSE_TAB_SPECS = [
  { id: 'tabAll', tabId: 'all', centerY: 156 / WAREHOUSE_ART_H, artW: 266, artH: 136 },
  { id: 'tabResources', tabId: 'resources', centerY: 169 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabSeeds', tabId: 'seeds', centerY: 168 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabFood', tabId: 'food', centerY: 156 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabMaterials', tabId: 'materials', centerY: 157 / WAREHOUSE_ART_H, artW: 263, artH: 136 },
] as const;

const TAB_ROW_CENTER_Y_FRAC =
  WAREHOUSE_TAB_SPECS.reduce((sum, tab) => sum + tab.centerY, 0) / WAREHOUSE_TAB_SPECS.length;
/** Nudge tab row vertically as fraction of panel height (negative = up). */
const TAB_ROW_OFFSET_Y_PANEL_FRAC = -0.01;

function tabDisplaySizePx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  tab: (typeof WAREHOUSE_TAB_SPECS)[number]
): { w: number; h: number } {
  return {
    w:
      artSpanW(tab.artW, panelLeft, panelTop, panelW, panelH) * TAB_DISPLAY_SCALE +
      artSpanW(TAB_EXTRA_W_ART_PX, panelLeft, panelTop, panelW, panelH),
    h:
      artSpanH(tab.artH, panelLeft, panelTop, panelW, panelH) * TAB_DISPLAY_SCALE +
      artSpanH(TAB_EXTRA_H_ART_PX, panelLeft, panelTop, panelW, panelH),
  };
}

function layoutTabRowBandPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { rowLeft: number; rowWidth: number } {
  const rowLeftBase = artFracToScreen(TAB_ROW_LEFT_FRAC, 0, panelLeft, panelTop, panelW, panelH).x;
  const rowRightBase = artFracToScreen(TAB_ROW_RIGHT_FRAC, 0, panelLeft, panelTop, panelW, panelH).x;
  const fullWidth = rowRightBase - rowLeftBase;
  const rowWidth = fullWidth * TAB_ROW_SCALE;
  const panelCenterX = artFracToScreen(0.5, 0, panelLeft, panelTop, panelW, panelH).x;
  const rowLeft = panelCenterX - rowWidth / 2;
  return { rowLeft, rowWidth };
}

function expectedTabRect(
  layout: WarehouseGridLayout,
  panelLeft: number,
  panelTop: number,
  index: number,
  tab: (typeof WAREHOUSE_TAB_SPECS)[number]
): { left: number; top: number; width: number; height: number } {
  const size = tabDisplaySizePx(panelLeft, panelTop, layout.panelW, layout.panelH, tab);
  const { rowLeft, rowWidth } = layoutTabRowBandPx(panelLeft, panelTop, layout.panelW, layout.panelH);
  const n = WAREHOUSE_TAB_SPECS.length;
  const left =
    n <= 1
      ? rowLeft + (rowWidth - size.w) / 2
      : rowLeft + (index * (rowWidth - size.w)) / (n - 1);
  const track = capacityTrackRectPx(layout.panelW, layout.panelH, panelLeft, panelTop);
  const minCenterY =
    track.top +
    track.height +
    artSpanH(CAPACITY_TAB_MIN_GAP_ART_PX, panelLeft, panelTop, layout.panelW, layout.panelH) +
    size.h / 2;
  const artRowY = artFracToScreen(0, TAB_ROW_CENTER_Y_FRAC, panelLeft, panelTop, layout.panelW, layout.panelH).y;
  const sharedCenterY =
    Math.max(artRowY, minCenterY) + layout.panelH * TAB_ROW_OFFSET_Y_PANEL_FRAC;
  return {
    left,
    top: sharedCenterY - size.h / 2,
    width: size.w,
    height: size.h,
  };
}

function buildExpectedHeaderCells(
  layout: WarehouseGridLayout,
  panelLeft: number,
  panelTop: number
): { id: string; left: number; top: number; width: number; height: number }[] {
  const track = capacityTrackRectPx(layout.panelW, layout.panelH, panelLeft, panelTop);
  const fill = capacityFillRectPx(layout.panelW, layout.panelH, panelLeft, panelTop);
  const pill = capacityTextPillRectPx(layout.panelW, layout.panelH, panelLeft, panelTop);

  const capacityCells = [
    { id: 'capacityTrack', ...track },
    { id: 'capacityFill', ...fill },
    { id: 'capacityTextPill', ...pill },
  ];

  const tabCells = WAREHOUSE_TAB_SPECS.map((tab, index) => ({
    id: tab.id,
    ...expectedTabRect(layout, panelLeft, panelTop, index, tab),
  }));

  return [...capacityCells, ...tabCells];
}

const TAB_TEXTURE_KEYS: Record<(typeof WAREHOUSE_TAB_SPECS)[number]['tabId'], { inactive: string; active: string }> = {
  all: { inactive: 'ui_tab_all', active: 'ui_tab_all_active' },
  resources: { inactive: 'ui_tab_resources', active: 'ui_tab_resources_active' },
  seeds: { inactive: 'ui_tab_seeds', active: 'ui_tab_seeds_active' },
  food: { inactive: 'ui_tab_food', active: 'ui_tab_food_active' },
  materials: { inactive: 'ui_tab_materials', active: 'ui_tab_materials_active' },
};

function panelOrigin(layout: WarehouseGridLayout): { left: number; top: number } {
  return { left: layout.panelLeft, top: layout.panelTop };
}

function slotRect(
  layout: WarehouseGridLayout,
  slotId: string
): { left: number; top: number; width: number; height: number; centerX: number; centerY: number } {
  const cell = layout.upgradePanelCells.find((c) => c.id === slotId);
  if (!cell) throw new Error(`missing slot ${slotId}`);
  return {
    ...cell,
    centerX: cell.left + cell.width / 2,
    centerY: cell.top + cell.height / 2,
  };
}

function pointInRect(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  tolerance = COST_POS_TOLERANCE_PX
): boolean {
  return (
    x >= rect.left - tolerance &&
    x <= rect.left + rect.width + tolerance &&
    y >= rect.top - tolerance &&
    y <= rect.top + rect.height + tolerance
  );
}

async function waitForTestApi(page: import('@playwright/test').Page) {
  await page.goto('/?debugWarehouse=1');
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

test.describe('Warehouse grid layout', () => {
  test('opens warehouse and exposes grid metrics aligned to art fractions', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout).not.toBeNull();

    expect(layout!.cols).toBe(GRID_COLS);
    expect(layout!.visibleRows).toBe(GRID_ROWS_VISIBLE);
    expect(layout!.debugGrid).toBe(true);

    const aspect = WAREHOUSE_ART_W / WAREHOUSE_ART_H;
    expect(layout!.panelW / layout!.panelH).toBeCloseTo(aspect, 2);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const gridBand = rectFromArtFrac(
      GRID_LEFT_FRAC,
      GRID_LEFT_FRAC + GRID_WIDTH_FRAC,
      GRID_TOP_FRAC,
      GRID_TOP_FRAC + GRID_HEIGHT_FRAC,
      panelLeft,
      panelTop,
      layout!.panelW,
      layout!.panelH
    );
    expect(layout!.gridViewportW).toBeCloseTo(gridBand.width, 1);
    expect(layout!.gridViewportH).toBeCloseTo(
      gridBand.height + artSpanH(GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH),
      1
    );

    expect(layout!.gridContentW).toBeCloseTo(layout!.gridViewportW, 1);

    const pitchCellW = layout!.gridViewportW / GRID_COLS;
    const pitchCellH = layout!.gridViewportH / GRID_ROWS_VISIBLE;
    expect(layout!.cellW).toBeCloseTo(
      pitchCellW - artSpanW(CELL_SLOT_SHRINK_W_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH),
      1
    );
    expect(layout!.cellH).toBeCloseTo(
      pitchCellH + artSpanH(CELL_SLOT_HEIGHT_EXTRA_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH),
      1
    );

    const totalGridWidth = layout!.cols * layout!.cellW;
    expect(layout!.gridContentOffsetX).toBeCloseTo(
      (layout!.gridViewportW - totalGridWidth) / 2,
      1
    );

    expect(panelLeft).toBeGreaterThan(0);
    expect(panelTop).toBeGreaterThan(0);
    expect(layout!.gridLeft).toBeCloseTo(
      gridBand.left,
      1
    );
    expect(layout!.gridTop).toBeCloseTo(
      gridBand.top + artSpanH(GRID_TOP_OFFSET_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH),
      1
    );
  });

  test('scrolls when more than 30 visible slots need extra rows', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItems(20);
      api?.clickBag();
      api?.setWarehouseMinScrollRows(8);
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const before = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.scrollOffset ?? -1
    );
    expect(before).toBe(0);

    const maxScroll = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.maxScrollOffset ?? 0
    );
    expect(maxScroll).toBeGreaterThan(0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.warehouseScrollBy(400));

    const after = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.scrollOffset ?? 0
    );
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(maxScroll);

    const slotCount = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.slotCount ?? 0
    );
    expect(slotCount).toBeGreaterThan(0);
  });

  test('upgrade panel cells align to art fractions', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.upgradePanelCells?.length).toBe(UPGRADE_PANEL_CELLS.length);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);

    for (const expected of UPGRADE_PANEL_CELLS) {
      const actual = layout!.upgradePanelCells.find((c) => c.id === expected.id);
      expect(actual, `missing upgrade cell ${expected.id}`).toBeDefined();

      const expRect = rectFromArtFrac(
        expected.x0,
        expected.x1,
        expected.y0,
        expected.y1,
        panelLeft,
        panelTop,
        layout!.panelW,
        layout!.panelH
      );
      let expLeft = expRect.left;
      const expTop = expRect.top;
      let expW = expRect.width;
      const expH = expRect.height;
      if (expected.id === 'coinSlot') {
        const expand = artSpanW(UPGRADE_COIN_SLOT_EXPAND_LEFT_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH);
        expLeft -= expand;
        expW += expand;
      }

      expect(actual!.left).toBeCloseTo(expLeft, 0);
      expect(actual!.top).toBeCloseTo(expTop, 0);
      expect(actual!.width).toBeCloseTo(expW, 0);
      expect(actual!.height).toBeCloseTo(expH, 0);
    }
  });

  test('upgrade cost texts sit in correct slots and match upgrade cost', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const cost = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseUpgradeCost());
    expect(cost).toEqual(EXPECTED_UPGRADE_COST);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.upgradeCostTexts?.length).toBe(3);

    const slots = Object.fromEntries(
      COST_SLOT_IDS.map((id) => [id, slotRect(layout!, id)])
    ) as Record<(typeof COST_SLOT_IDS)[number], ReturnType<typeof slotRect>>;

    for (const costText of layout!.upgradeCostTexts) {
      const own = slots[costText.slotId as (typeof COST_SLOT_IDS)[number]];
      expect(own, `missing slot ${costText.slotId}`).toBeDefined();
      expect(
        pointInRect(costText.x, costText.y, own),
        `${costText.id} at (${costText.x},${costText.y}) outside ${costText.slotId}`
      ).toBe(true);
      expect(costText.x).toBeCloseTo(own.centerX, 0);
      expect(costText.y).toBeCloseTo(own.centerY, 0);

      for (const otherId of COST_SLOT_IDS) {
        if (otherId === costText.slotId) continue;
        const other = slots[otherId];
        expect(
          pointInRect(costText.x, costText.y, other, 0),
          `${costText.id} overlaps ${otherId}`
        ).toBe(false);
      }
    }

    const coin = layout!.upgradeCostTexts.find((c) => c.id === 'coin');
    const wood = layout!.upgradeCostTexts.find((c) => c.id === 'wood');
    const stone = layout!.upgradeCostTexts.find((c) => c.id === 'stone');
    expect(coin?.text).toBe(String(EXPECTED_UPGRADE_COST.coins));
    expect(wood?.text).toBe(String(EXPECTED_UPGRADE_COST.wood));
    expect(stone?.text).toBe(String(EXPECTED_UPGRADE_COST.stone));

    expect(coin!.x).toBeLessThan(slots.woodSlot.left);
    expect(wood!.x).toBeGreaterThan(slots.coinSlot.left + slots.coinSlot.width);
    expect(wood!.x).toBeLessThan(slots.stoneSlot.left);
    expect(stone!.x).toBeGreaterThan(slots.woodSlot.left + slots.woodSlot.width);
  });

  test('close button hit zone aligns to art and closes warehouse', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.closeHit).toBeDefined();

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const expCenter = artFracToScreen(
      CLOSE_BTN_CENTER_X_FRAC,
      CLOSE_BTN_CENTER_Y_FRAC,
      panelLeft,
      panelTop,
      layout!.panelW,
      layout!.panelH
    );
    const expCenterX = expCenter.x + layout!.panelW * CLOSE_BTN_OFFSET_X_PANEL_FRAC;
    const expCenterY = expCenter.y;
    const expRadius = artSpanW(CLOSE_BTN_RADIUS_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH);

    expect(layout!.closeHit.centerX).toBeCloseTo(expCenterX, 0);
    expect(layout!.closeHit.centerY).toBeCloseTo(expCenterY, 0);
    expect(layout!.closeHit.radius).toBeCloseTo(expRadius, 0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(false);
  });

  test('warehouse header cells align to art fractions', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.headerCells?.length).toBe(3 + WAREHOUSE_TAB_SPECS.length);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const expectedHeaderCells = buildExpectedHeaderCells(layout!, panelLeft, panelTop);

    for (const expected of expectedHeaderCells) {
      const actual = layout!.headerCells.find((c) => c.id === expected.id);
      expect(actual, `missing header cell ${expected.id}`).toBeDefined();

      expect(Math.abs(actual!.left - expected.left)).toBeLessThan(2);
      expect(Math.abs(actual!.top - expected.top)).toBeLessThan(2);
      expect(Math.abs(actual!.width - expected.width)).toBeLessThan(2);
      expect(Math.abs(actual!.height - expected.height)).toBeLessThan(2);
    }

    for (const tab of WAREHOUSE_TAB_SPECS) {
      const wFrac = (tab.artW / WAREHOUSE_ART_W) * TAB_DISPLAY_SCALE;
      expect(wFrac).toBeGreaterThan(0.08);
      expect(wFrac).toBeLessThan(0.095);
    }

    WAREHOUSE_TAB_SPECS.forEach((tab, index) => {
      const cell = layout!.headerCells.find((c) => c.id === tab.id);
      expect(cell, `missing tab cell ${tab.id}`).toBeDefined();
      const exp = expectedTabRect(layout!, panelLeft, panelTop, index, tab);
      const expCenterX = exp.left + exp.width / 2;
      const actualCenterX = cell!.left + cell!.width / 2;
      expect(actualCenterX).toBeCloseTo(expCenterX, 0);
    });
  });

  test('tab sprites align to header cells and tab click switches texture', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layoutBefore = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layoutBefore?.tabSprites?.length).toBe(WAREHOUSE_TAB_SPECS.length);

    for (const sprite of layoutBefore!.tabSprites) {
      const cell = layoutBefore!.headerCells.find((c) => c.id === sprite.cellId);
      expect(cell, `missing header cell for ${sprite.id}`).toBeDefined();
      expect(sprite.left).toBeCloseTo(cell!.left, 0);
      expect(sprite.top).toBeCloseTo(cell!.top, 0);
      expect(sprite.width).toBeCloseTo(cell!.width, 0);
      expect(sprite.height).toBeCloseTo(cell!.height, 0);
      const tabWFrac = sprite.width / layoutBefore!.panelW;
      const maxTabW =
        Math.max(
          ...WAREHOUSE_TAB_SPECS.map((t) =>
            tabDisplaySizePx(
              layoutBefore!.panelLeft,
              layoutBefore!.panelTop,
              layoutBefore!.panelW,
              layoutBefore!.panelH,
              t
            ).w
          )
        );
      const minTabW =
        Math.min(
          ...WAREHOUSE_TAB_SPECS.map((t) =>
            tabDisplaySizePx(
              layoutBefore!.panelLeft,
              layoutBefore!.panelTop,
              layoutBefore!.panelW,
              layoutBefore!.panelH,
              t
            ).w
          )
        );
      expect(sprite.width).toBeGreaterThan(minTabW * 0.98);
      expect(sprite.width).toBeLessThan(maxTabW * 1.02);
    }

    expect(layoutBefore!.activeTab).toBe('all');
    const allSprite = layoutBefore!.tabSprites.find((s) => s.id === 'all');
    expect(allSprite?.textureKey).toBe(TAB_TEXTURE_KEYS.all.active);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseTab('seeds'));

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseActiveTab()))
      .toBe('seeds');

    const layoutAfter = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    const seedsSprite = layoutAfter!.tabSprites.find((s) => s.id === 'seeds');
    const allAfter = layoutAfter!.tabSprites.find((s) => s.id === 'all');
    expect(seedsSprite?.textureKey).toBe(TAB_TEXTURE_KEYS.seeds.active);
    expect(seedsSprite?.active).toBe(true);
    expect(allAfter?.textureKey).toBe(TAB_TEXTURE_KEYS.all.inactive);
    expect(allAfter?.active).toBe(false);
  });

  test('capacity fill ratio matches warehouse usage', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItems(5);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    const ratio = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseCapacityFillRatio());

    expect(ratio).not.toBeNull();
    expect(layout?.capacityFillRatio).toBeCloseTo(ratio!, 4);
    expect(ratio!).toBeGreaterThan(0);
    expect(ratio!).toBeLessThanOrEqual(1);

    const fillCell = layout!.headerCells.find((c) => c.id === 'capacityFill');
    expect(fillCell).toBeDefined();
    const trackCell = layout!.headerCells.find((c) => c.id === 'capacityTrack');
    expect(trackCell).toBeDefined();
    expect(fillCell!.top).toBeGreaterThanOrEqual(trackCell!.top);
    expect(fillCell!.top + fillCell!.height).toBeLessThanOrEqual(trackCell!.top + trackCell!.height + 2);

    const pillCell = layout!.headerCells.find((c) => c.id === 'capacityTextPill');
    expect(pillCell).toBeDefined();
    const pillCenterX = pillCell!.left + pillCell!.width / 2;
    const pillCenterY = pillCell!.top + pillCell!.height / 2;
    expect(layout!.capacityText.originX).toBeCloseTo(0.5, 4);
    expect(layout!.capacityText.originY).toBeCloseTo(0.5, 4);
    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    expect(layout!.capacityText.x).toBeCloseTo(
      pillCenterX + artSpanW(CAPACITY_TEXT_OFFSET_X, panelLeft, panelTop, layout!.panelW, layout!.panelH),
      0
    );
    expect(layout!.capacityText.y).toBeCloseTo(
      pillCenterY + layout!.panelH * CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC,
      0
    );
  });

  test('sell qty minus/plus and set quantity API', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseSellable(8);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.sellControlsCells?.some((c) => c.id === 'qtyPlus')).toBe(true);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseSellControl('qtyPlus'));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(2);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseSellControl('qtyMinus'));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setWarehouseSellQuantity(5));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(5);
  });

  test('selecting seed or food shows sell footer name and owned', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItem('wheat_seed', 3);
      api?.seedWarehouseItem('candy', 2);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickWarehouseTab('seeds');
      window.__FARMER_WORLD_TEST__?.selectWarehouseItem('wheat_seed');
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.name))
      .toBe('WHEAT SEEDS');

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.owned ?? 0))
      .toBeGreaterThanOrEqual(3);

    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickWarehouseTab('food');
      window.__FARMER_WORLD_TEST__?.selectWarehouseItem('candy');
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.name))
      .toBe('CANDY');

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.owned ?? 0))
      .toBeGreaterThanOrEqual(2);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.sellable))
      .toBe(false);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.useVisible))
      .toBe(true);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.useLabel))
      .toBe('USE');
  });
});

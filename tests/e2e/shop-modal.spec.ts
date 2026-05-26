import { expect, test } from '@playwright/test';

/** Item ids passed into browser evaluate (not bundled in page context). */
const WHEAT_SEED = 'wheat_seed';
const CORN_SEED = 'corn_seed';
const CANDY = 'candy';

const SHOP_ART_W = 1536;
const SHOP_ART_H = 1024;
const SHOP_PANEL_WIDTH_FRAC = 1;
const SHOP_PANEL_HEIGHT_FRAC = 1;
const WAREHOUSE_PANEL_WIDTH_FRAC = 0.96;
const WAREHOUSE_PANEL_HEIGHT_FRAC = 0.88;

function expectedShopPanelSize(viewportW: number, viewportH: number): { panelW: number; panelH: number } {
  const aspect = SHOP_ART_W / SHOP_ART_H;
  const maxW = viewportW * SHOP_PANEL_WIDTH_FRAC;
  const maxH = viewportH * SHOP_PANEL_HEIGHT_FRAC;
  let panelW = maxW;
  let panelH = panelW / aspect;
  if (panelH > maxH) {
    panelH = maxH;
    panelW = panelH * aspect;
  }
  return { panelW, panelH };
}

function expectedWarehousePanelSize(viewportW: number, viewportH: number): { panelW: number; panelH: number } {
  const aspect = SHOP_ART_W / SHOP_ART_H;
  const panelW = Math.min(
    viewportW * WAREHOUSE_PANEL_WIDTH_FRAC,
    viewportH * WAREHOUSE_PANEL_HEIGHT_FRAC * aspect
  );
  const panelH = panelW / aspect;
  return { panelW, panelH };
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

function artFracToScreen(
  xFrac: number,
  yFrac: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { x: number; y: number } {
  const crop = computeObjectCoverCrop(SHOP_ART_W, SHOP_ART_H, panelW, panelH);
  const artX = xFrac * SHOP_ART_W;
  const artY = yFrac * SHOP_ART_H;
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

const GRID_COLS = 4;
const GRID_ROWS = 3;
const CONTENT_LEFT_PX = 150;
const CONTENT_RIGHT_PX = 1350;
const TABS_WIDTH_FRAC = 0.125;
const GRID_WIDTH_FRAC = 0.625;
const CONTENT_WIDTH_PX = CONTENT_RIGHT_PX - CONTENT_LEFT_PX;
const TABS_WIDTH_PX = Math.round(CONTENT_WIDTH_PX * TABS_WIDTH_FRAC);
const GRID_WIDTH_PX = Math.round(CONTENT_WIDTH_PX * GRID_WIDTH_FRAC);
const GRID_LEFT_PX = CONTENT_LEFT_PX + TABS_WIDTH_PX;
const GRID_LEFT_FRAC = GRID_LEFT_PX / SHOP_ART_W;
const GRID_TOP_FRAC = 235 / SHOP_ART_H;
const GRID_ART_WIDTH_FRAC = GRID_WIDTH_PX / SHOP_ART_W;
const GRID_HEIGHT_FRAC = 520 / SHOP_ART_H;
const GRID_CONTENT_PAD_LEFT_PX = 20;
const GRID_CONTENT_PAD_RIGHT_PX = 15;
const GRID_CONTENT_PAD_TOP_PX = 10;
const CLOSE_BTN_OFFSET_X_PX = -20;
const CLOSE_BTN_OFFSET_Y_PX = 40;
const CLOSE_BTN_CENTER_X_FRAC = (1405 + CLOSE_BTN_OFFSET_X_PX) / SHOP_ART_W;
const CLOSE_BTN_CENTER_Y_FRAC = (120 + CLOSE_BTN_OFFSET_Y_PX) / SHOP_ART_H;
const CLOSE_BTN_RADIUS_ART_PX = 56;

const CATEGORY_TAB_OFFSET_X_PX = 123;
const CATEGORY_TAB_OFFSET_Y_PX = -17;
const CATEGORY_TAB_GAP_PX = 0;
const CATEGORY_TAB_FIRST_CENTER_Y_ART_PX = 291;
const CATEGORY_TAB_HIT_W_PX = 165;
const CATEGORY_TAB_HIT_H_PX = 92;
const CATEGORY_TAB_COUNT = 6;
const CATEGORY_TAB_CENTER_X_PX = 92 + CATEGORY_TAB_OFFSET_X_PX;
const CATEGORY_TAB_CENTER_X_FRAC = CATEGORY_TAB_CENTER_X_PX / SHOP_ART_W;
const CATEGORY_TAB_HIT_W_FRAC = CATEGORY_TAB_HIT_W_PX / SHOP_ART_W;
const CATEGORY_TAB_HIT_H_FRAC = CATEGORY_TAB_HIT_H_PX / SHOP_ART_H;

function buildCategoryTabCenterYPx(): number[] {
  const startY = CATEGORY_TAB_FIRST_CENTER_Y_ART_PX + CATEGORY_TAB_OFFSET_Y_PX;
  const step = CATEGORY_TAB_HIT_H_PX + CATEGORY_TAB_GAP_PX;
  return Array.from({ length: CATEGORY_TAB_COUNT }, (_, i) => startY + step * i);
}

const CATEGORY_TAB_CENTER_Y_PX = buildCategoryTabCenterYPx();
const CATEGORY_TAB_CENTERS_Y_FRAC = CATEGORY_TAB_CENTER_Y_PX.map((y) => y / SHOP_ART_H);

/** Top currency capsules under SHOP title — baked art px (1536×1024). */
const CURRENCY_BAR_OFFSET_Y = 8;
const CURRENCY_SLOT_GAP_PX = 0;
const CURRENCY_BAR_X0_PX = 518;
const CURRENCY_BAR_X1_PX = 1018;
const CURRENCY_BAR_Y0_PX = 158;
const CURRENCY_BAR_Y1_PX = 212;
const CURRENCY_ICON_TEXT_GAP_PX = 4;

function buildCurrencySlotArtPx(): { x0: number; x1: number; y0: number; y1: number }[] {
  const totalW = CURRENCY_BAR_X1_PX - CURRENCY_BAR_X0_PX;
  const slotCount = 3;
  const gapTotal = CURRENCY_SLOT_GAP_PX * (slotCount - 1);
  const boxesW = totalW - gapTotal;
  const baseW = Math.floor(boxesW / slotCount);
  const remainder = boxesW - baseW * slotCount;
  const slots: { x0: number; x1: number; y0: number; y1: number }[] = [];
  let x = CURRENCY_BAR_X0_PX;
  for (let i = 0; i < slotCount; i++) {
    const w = baseW + (i >= slotCount - remainder ? 1 : 0);
    slots.push({
      x0: x,
      x1: x + w,
      y0: CURRENCY_BAR_Y0_PX + CURRENCY_BAR_OFFSET_Y,
      y1: CURRENCY_BAR_Y1_PX + CURRENCY_BAR_OFFSET_Y,
    });
    x += w + (i < slotCount - 1 ? CURRENCY_SLOT_GAP_PX : 0);
  }
  return slots;
}

const CURRENCY_SLOT_ART_PX = buildCurrencySlotArtPx();

/** Detail price row — baked coin slot + amount band art px; offsets in screen px. */
const DETAIL_COIN_BOX_X0_PX = 1092;
const DETAIL_COIN_BOX_X1_PX = 1162;
const DETAIL_COIN_BOX_Y0_PX = 592;
const DETAIL_COIN_BOX_Y1_PX = 628;
const DETAIL_PRICE_AMOUNT_Y0_PX = 652;
const DETAIL_PRICE_AMOUNT_Y1_PX = 674;
const DETAIL_PRICE_BOX_OFFSET_X_ART_PX = 89;
const DETAIL_PRICE_BOX_OFFSET_Y_ART_PX = 30;
const DETAIL_PRICE_BOX_EXTRA_H_PX = 35;
const DETAIL_PRICE_BOX_DISPLAY_W_PX = 257;
const DETAIL_BUY_X0_PX = 1070;
const DETAIL_BUY_X1_PX = 1330;
const DETAIL_BUY_Y0_PX = 650;
const DETAIL_BUY_Y1_PX = 724;
const DETAIL_BUY_OFFSET_Y_ART_PX = 70;

function artSpanPxW(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): number {
  return artFracSpanW(artPx / SHOP_ART_W, panelLeft, panelTop, panelW, panelH);
}

function artSpanPxH(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): number {
  return artFracSpanH(artPx / SHOP_ART_H, panelLeft, panelTop, panelW, panelH);
}

function expectedDetailPriceBox(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { centerX: number; centerY: number; width: number; height: number } {
  const coinTl = artFracToScreen(
    DETAIL_COIN_BOX_X0_PX / SHOP_ART_W,
    DETAIL_COIN_BOX_Y0_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const coinBr = artFracToScreen(
    DETAIL_COIN_BOX_X1_PX / SHOP_ART_W,
    DETAIL_COIN_BOX_Y1_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const priceTl = artFracToScreen(
    DETAIL_COIN_BOX_X0_PX / SHOP_ART_W,
    DETAIL_PRICE_AMOUNT_Y0_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const priceBr = artFracToScreen(
    DETAIL_COIN_BOX_X1_PX / SHOP_ART_W,
    DETAIL_PRICE_AMOUNT_Y1_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const coinCenterX = (coinTl.x + coinBr.x) / 2;
  const priceBandCenterY = (priceTl.y + priceBr.y) / 2;
  const priceBandHeight = Math.abs(priceBr.y - priceTl.y);
  return {
    centerX: coinCenterX + artSpanPxW(DETAIL_PRICE_BOX_OFFSET_X_ART_PX, panelLeft, panelTop, panelW, panelH),
    centerY: priceBandCenterY + artSpanPxH(DETAIL_PRICE_BOX_OFFSET_Y_ART_PX, panelLeft, panelTop, panelW, panelH),
    width: artSpanPxW(DETAIL_PRICE_BOX_DISPLAY_W_PX, panelLeft, panelTop, panelW, panelH),
    height: priceBandHeight + artSpanPxH(DETAIL_PRICE_BOX_EXTRA_H_PX, panelLeft, panelTop, panelW, panelH),
  };
}

function expectedBuyHitCenter(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { centerX: number; centerY: number } {
  const tl = artFracToScreen(
    DETAIL_BUY_X0_PX / SHOP_ART_W,
    DETAIL_BUY_Y0_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  const br = artFracToScreen(
    DETAIL_BUY_X1_PX / SHOP_ART_W,
    DETAIL_BUY_Y1_PX / SHOP_ART_H,
    panelLeft,
    panelTop,
    panelW,
    panelH
  );
  return {
    centerX: (tl.x + br.x) / 2,
    centerY: (tl.y + br.y) / 2 + artSpanPxH(DETAIL_BUY_OFFSET_Y_ART_PX, panelLeft, panelTop, panelW, panelH),
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
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  rowGapPx: number;
  rowOverlapPx: number;
  gapPxV: number;
  closeHit: { centerX: number; centerY: number; radius: number };
  categoryTabs: {
    index: number;
    centerX: number;
    centerY: number;
    hitW: number;
    hitH: number;
    glowW: number;
    glowH: number;
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
    expect(layout).not.toBeNull();
    expect(panel).not.toBeNull();
    if (!layout || !panel) return;

    const expected = expectedShopPanelSize(panel.viewportW, panel.viewportH);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelW).toBeLessThanOrEqual(panel.viewportW * SHOP_PANEL_WIDTH_FRAC + 1);
    expect(panel.panelH).toBeLessThanOrEqual(panel.viewportH * SHOP_PANEL_HEIGHT_FRAC + 1);
    expect(panel.panelLeft).toBeGreaterThanOrEqual(0);
    expect(panel.panelTop).toBeGreaterThanOrEqual(0);
    expect(panel.panelRight).toBeLessThanOrEqual(panel.viewportW + 1);
    expect(panel.panelBottom).toBeLessThanOrEqual(panel.viewportH + 1);

    expect(layout.cols).toBe(GRID_COLS);
    expect(layout.rows).toBe(GRID_ROWS);

    const gridTl = artFracToScreen(
      GRID_LEFT_FRAC,
      GRID_TOP_FRAC,
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    const gridBr = artFracToScreen(
      GRID_LEFT_FRAC + GRID_ART_WIDTH_FRAC,
      GRID_TOP_FRAC + GRID_HEIGHT_FRAC,
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    const expectedGridLeft = gridTl.x;
    const expectedGridTop = gridTl.y;
    const expectedGridW = Math.abs(gridBr.x - gridTl.x);
    const expectedGridH = Math.abs(gridBr.y - gridTl.y);

    expect(layout.gridLeft).toBeCloseTo(expectedGridLeft, 0);
    expect(layout.gridTop).toBeCloseTo(expectedGridTop, 0);
    expect(layout.gridW).toBeCloseTo(expectedGridW, 0);
    expect(layout.gridH).toBeCloseTo(expectedGridH, 0);
    expect(layout.gridContentPadLeft).toBeCloseTo(
      artSpanPxW(GRID_CONTENT_PAD_LEFT_PX, layout.panelLeft, layout.panelTop, layout.panelW, layout.panelH),
      0
    );
    expect(layout.gridContentPadRight).toBeCloseTo(
      artSpanPxW(GRID_CONTENT_PAD_RIGHT_PX, layout.panelLeft, layout.panelTop, layout.panelW, layout.panelH),
      0
    );
    expect(layout.gridContentPadTop).toBeCloseTo(
      artSpanPxH(GRID_CONTENT_PAD_TOP_PX, layout.panelLeft, layout.panelTop, layout.panelW, layout.panelH),
      0
    );
    expect(layout.gridContentW).toBeCloseTo(
      layout.gridW - layout.gridContentPadLeft - layout.gridContentPadRight,
      0
    );
    expect(layout.cellW).toBeCloseTo(layout.gridContentW / GRID_COLS, 0);
    expect(layout.cellH).toBeCloseTo(layout.gridH / GRID_ROWS, 0);
    expect(layout.rowGapPx).toBe(0);
    expect(layout.rowOverlapPx).toBe(0);
    expect(layout.gapPxV).toBeGreaterThanOrEqual(0);
    expect(layout.gapPxV).toBeLessThanOrEqual(1);

    const closePt = artFracToScreen(
      CLOSE_BTN_CENTER_X_FRAC,
      CLOSE_BTN_CENTER_Y_FRAC,
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    const closeX = closePt.x;
    const closeY = closePt.y;
    const closeR = artFracSpanW(
      CLOSE_BTN_RADIUS_ART_PX / SHOP_ART_W,
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    expect(layout.closeHit.centerX).toBeCloseTo(closeX, 0);
    expect(layout.closeHit.centerY).toBeCloseTo(closeY, 0);
    expect(layout.closeHit.radius).toBeCloseTo(closeR, 0);

    expect(layout.categoryTabs).toHaveLength(6);
    layout.categoryTabs.forEach((tab, i) => {
      const cyFrac = CATEGORY_TAB_CENTERS_Y_FRAC[i] ?? CATEGORY_TAB_CENTERS_Y_FRAC[0];
      const pt = artFracToScreen(
        CATEGORY_TAB_CENTER_X_FRAC,
        cyFrac,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH
      );
      const expectedW = artFracSpanW(
        CATEGORY_TAB_HIT_W_FRAC,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH
      );
      const expectedH = artFracSpanH(
        CATEGORY_TAB_HIT_H_FRAC,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH
      );
      expect(tab.centerX).toBeCloseTo(pt.x, 0);
      expect(tab.centerY).toBeCloseTo(pt.y, 0);
      expect(tab.hitW).toBeCloseTo(expectedW, 0);
      expect(tab.hitH).toBeCloseTo(expectedH, 0);
      expect(tab.glowW).toBeCloseTo(tab.hitW, 0);
      expect(tab.glowH).toBeCloseTo(tab.hitH, 0);
    });
  });

  test('currency bar uses ui_box backgrounds on baked capsule slots', async ({ page }) => {
    const bar = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopCurrencyBar());
    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    const coins = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins());
    expect(bar).not.toBeNull();
    expect(layout).not.toBeNull();
    if (!bar || !layout) return;

    expect(bar.slots).toHaveLength(3);
    bar.slots.forEach((slot, i) => {
      const art = CURRENCY_SLOT_ART_PX[i];
      expect(art).toBeDefined();
      if (!art) return;

      const tl = artFracToScreen(
        art.x0 / SHOP_ART_W,
        art.y0 / SHOP_ART_H,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH
      );
      const br = artFracToScreen(
        art.x1 / SHOP_ART_W,
        art.y1 / SHOP_ART_H,
        layout.panelLeft,
        layout.panelTop,
        layout.panelW,
        layout.panelH
      );
      const expectedCenterX = (tl.x + br.x) / 2;
      const expectedCenterY = (tl.y + br.y) / 2;
      const expectedW = Math.abs(br.x - tl.x);
      const expectedH = Math.abs(br.y - tl.y);

      expect(slot.hasBox).toBe(true);
      expect(slot.boxTexture).toBe('ui_box');
      expect(slot.centerX).toBeCloseTo(expectedCenterX, 0);
      expect(slot.centerY).toBeCloseTo(expectedCenterY, 0);
      expect(slot.width).toBeCloseTo(expectedW, 0);
      expect(slot.height).toBeCloseTo(expectedH, 0);
      expect(slot.left).toBeCloseTo(tl.x, 0);
      expect(slot.right).toBeCloseTo(br.x, 0);

      expect(slot.iconTextGap).toBeCloseTo(CURRENCY_ICON_TEXT_GAP_PX, 0);
      expect(slot.groupCenterX).toBeCloseTo(slot.centerX, 0);
    });

    const expectedSlotGapPx = artFracSpanW(
      CURRENCY_SLOT_GAP_PX / SHOP_ART_W,
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    for (let i = 0; i < bar.slots.length - 1; i++) {
      const left = bar.slots[i];
      const right = bar.slots[i + 1];
      const gap = (right?.left ?? 0) - (left?.right ?? 0);
      expect(gap).toBeCloseTo(expectedSlotGapPx, 0);
    }

    expect(bar.slots[0]?.value).toBe(String(coins ?? 0));
  });

  test('detail price box uses ui_box at 220×band+26, offset +89/+30', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopGridSlot(0));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopSelectedItemId()))
      .toBe(WHEAT_SEED);

    const priceBox = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetailPriceBox());
    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    expect(priceBox).not.toBeNull();
    expect(layout).not.toBeNull();
    if (!priceBox || !layout) return;

    const expected = expectedDetailPriceBox(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );

    expect(priceBox.visible).toBe(true);
    expect(priceBox.texture).toBe('ui_box');
    expect(priceBox.unitPriceAmount).toBe('5');
    expect(priceBox.width).toBeCloseTo(expected.width, 0);
    expect(priceBox.height).toBeCloseTo(expected.height, 0);
    expect(priceBox.centerX).toBeCloseTo(expected.centerX, 0);
    expect(priceBox.centerY).toBeCloseTo(expected.centerY, 0);
  });

  test('buy CTA hit zone is offset +70px below baked art', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopGridSlot(0));
    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyControls());
    const priceBox = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetailPriceBox());
    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopGridLayout() as ShopGridLayout | null
    );
    expect(controls).not.toBeNull();
    expect(priceBox).not.toBeNull();
    expect(layout).not.toBeNull();
    if (!controls || !priceBox || !layout) return;

    const expectedBuy = expectedBuyHitCenter(
      layout.panelLeft,
      layout.panelTop,
      layout.panelW,
      layout.panelH
    );
    expect(controls.buy.centerX).toBeCloseTo(expectedBuy.centerX, 0);
    expect(controls.buy.centerY).toBeCloseTo(expectedBuy.centerY, 0);
    expect(controls.buy.centerY).toBeGreaterThan(
      priceBox.centerY + priceBox.height * 0.25
    );
  });

  test('single-page grid hides pagination label', async ({ page }) => {
    const detail = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail());
    expect(detail?.pageCount).toBe(1);
    expect(detail?.pageLabel).toBe('1/1');
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopPageLabelVisible())).toBe(
      false
    );
  });

  test('canvas grid clicks switch between seed items', async ({ page }) => {
    const canvas = page.locator('#game-container canvas');
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(0));
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
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(0));
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
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(2));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('farming');

    const visible = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount());
    expect(visible).toBeGreaterThanOrEqual(6);

    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), CANDY);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.title))
      .toBe('Candy');
  });

  test('empty viewport slots always show card background without icon', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(5);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(0);
    });
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopActiveCategory()))
      .toBe('storage');

    const slots = await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      const out: { hasCardBg: boolean; hasIcon: boolean; itemId: string | null }[] = [];
      for (let i = 0; i < 12; i++) {
        const s = api?.getShopGridSlot(i);
        if (s) out.push(s);
      }
      return out;
    });

    expect(slots.length).toBe(12);
    expect(slots.every((s) => s.hasCardBg)).toBe(true);

    const emptySlots = slots.filter((s) => !s.itemId);
    expect(emptySlots.length).toBeGreaterThan(0);
    expect(emptySlots.every((s) => !s.hasIcon)).toBe(true);
  });

  test('vertical scroll reveals items beyond the first viewport', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(0);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(8);
    });

    const before = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopScrollOffset());
    expect(before).toBe(0);

    const layout = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(layout?.maxScrollOffset ?? 0).toBeGreaterThan(0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.shopScrollBy(600));

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopScrollOffset() ?? 0))
      .toBeGreaterThan(0);

    const visibleAfterScroll = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getShopVisibleGridCount() ?? 0
    );
    expect(visibleAfterScroll).toBeGreaterThan(0);
  });

  test('pagination advances when grid is padded beyond one page', async ({ page }) => {
    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickShopCategoryTab(0);
      window.__FARMER_WORLD_TEST__?.padShopGridForTest(8);
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.pageCount))
      .toBeGreaterThan(1);

    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.pageLabel)).toBe('1/2');

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopPage(1));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.currentPage))
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopDetail()?.pageLabel))
      .toBe('2/2');
  });

  test('buy smoke: purchase wheat seeds deducts coins', async ({ page }) => {
    const coinsBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins());
    expect(coinsBefore).toBeGreaterThan(5);

    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);

    const buyHit = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyHitTest('buy'));
    expect(buyHit?.topIsBuyControl, JSON.stringify(buyHit)).toBe(true);
    expect(buyHit?.topHitName).toBe('buyMainHit');

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

  test('buy canvas click works with debug grid on', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setShopDebugGrid(true));

    const buyHit = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyHitTest('buy'));
    expect(buyHit?.topIsBuyControl, JSON.stringify(buyHit)).toBe(true);

    const coinsBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins());
    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyControls());
    expect(controls).not.toBeNull();
    if (!controls) return;

    await page.mouse.click(controls.buy.clientCenterX, controls.buy.clientCenterY);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getPlayerCoins()))
      .toBe((coinsBefore ?? 0) - 5);
  });

  test('close button dismisses shop', async ({ page }) => {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopClose());
    await expect.poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen())).toBe(false);
  });

  test('debug grids off by default; toggle via test API', async ({ page }) => {
    const layoutOff = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(layoutOff?.debugGrid).toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setShopDebugGrid(true));
    const layoutOn = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(layoutOn?.debugGrid).toBe(true);
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopDebugGrid())).toBe(true);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setShopDebugGrid(false));
    const layoutOffAgain = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopGridLayout());
    expect(layoutOffAgain?.debugGrid).toBe(false);
  });

  test('buy qty canvas clicks work with debug grid on', async ({ page }) => {
    await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.selectShopItem(id), WHEAT_SEED);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setShopDebugGrid(true));

    const plusHit = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQtyHitTest('plus'));
    expect(plusHit?.topIsBuyControl, JSON.stringify(plusHit)).toBe(true);

    const controls = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopBuyQtyControls());
    expect(controls).not.toBeNull();
    if (!controls) return;

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
    const warehouse = expectedWarehousePanelSize(1920, 1080);
    expect(panel.viewportW).toBe(1920);
    expect(panel.viewportH).toBe(1080);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelW).toBeGreaterThan(warehouse.panelW);
    expect(panel.panelLeft).toBeCloseTo((1920 - expected.panelW) / 2, 0);
    expect(panel.panelTop).toBeCloseTo((1080 - expected.panelH) / 2, 0);
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

test.describe('Shop modal sizing @390×844 portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('portrait uses full width with letterbox (contain)', async ({ page }) => {
    await waitForGame(page);
    await openShop(page);

    const panel = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopLayoutMetrics());
    expect(panel).not.toBeNull();
    if (!panel) return;

    const expected = expectedShopPanelSize(390, 844);
    const warehouse = expectedWarehousePanelSize(390, 844);
    expect(panel.viewportW).toBe(390);
    expect(panel.viewportH).toBe(844);
    expect(panel.panelW).toBeCloseTo(expected.panelW, 0);
    expect(panel.panelH).toBeCloseTo(expected.panelH, 0);
    expect(panel.panelW).toBeCloseTo(390, 0);
    expect(panel.panelH).toBeLessThan(panel.viewportH);
    expect(panel.panelH).toBeGreaterThan(warehouse.panelH);
    expect(panel.panelTop).toBeGreaterThan(0);
    expect(panel.panelBottom).toBeLessThan(panel.viewportH);
  });
});

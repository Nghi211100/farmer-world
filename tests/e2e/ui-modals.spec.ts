import { expect, test } from '@playwright/test';

interface FarmerWorldTestApi {
  clickBag: () => void;
  clickShop: () => void;
  closeModals: () => void;
  isWarehouseOpen: () => boolean;
  isShopOpen: () => boolean;
  getWarehouseTitle: () => string | null;
  getShopTitle: () => string | null;
}

async function waitForGame(page: import('@playwright/test').Page): Promise<FarmerWorldTestApi> {
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
  const api = await page.evaluate(() => window.__FARMER_WORLD_TEST__);
  if (!api) throw new Error('__FARMER_WORLD_TEST__ not installed (dev server required)');
  return api;
}

/** Left-bar bag tap: ~1.5% left inset + half icon (see HUD_BAG_LEFT_VW_FRAC). */
const HUD_BAG_LEFT_X_FRAC = 0.05;
const HUD_BAG_BOTTOM_Y_FRAC = 0.965;

async function clickHudButton(
  page: import('@playwright/test').Page,
  slot: 'bag' | 'shop'
): Promise<void> {
  const canvas = page.locator('#game-container canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found');
  const xRatio = slot === 'bag' ? HUD_BAG_LEFT_X_FRAC : 0.9;
  const yRatio = slot === 'bag' ? HUD_BAG_BOTTOM_Y_FRAC : 0.97;
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.mouse.click(x, y);
}

test.describe('Bag and Shop modals', () => {
  test('Bag opens Warehouse modal; Shop opens store', async ({ page }) => {
    await waitForGame(page);

    await clickHudButton(page, 'bag');
    await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen() === true);
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseTitle())).toBe(
      'Warehouse'
    );

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeModals());
    await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen() === false);

    await clickHudButton(page, 'shop');
    await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isShopOpen() === true);
    expect(await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getShopTitle())).toBe('SHOP');
  });

  test('test API opens modals (smoke)', async ({ page }) => {
    await waitForGame(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeModals());

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShop());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen()))
      .toBe(true);
  });

  test('outside click does not close modals', async ({ page }) => {
    await waitForGame(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);
    await page.mouse.click(8, 8);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShop());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen()))
      .toBe(true);
    await page.mouse.click(8, 8);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen()))
      .toBe(true);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickShopClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isShopOpen()))
      .toBe(false);
  });
});

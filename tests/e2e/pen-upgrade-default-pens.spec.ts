import { expect, test } from '@playwright/test';

/** Default map anchors from livestockPenLayout.ts */
const PIG_PEN = { gx: 15, gy: 8, label: 'pig' };
const RUMINANT_PEN = { gx: 6, gy: 2, label: 'ruminant (dê/cừu)' };

async function waitForGame(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('your-farm-save-v4');
    localStorage.removeItem('your-farm-save-v4-grid');
  });
  await page.goto('/');
  await page.waitForSelector('#game-container canvas', { timeout: 30_000 });
  await page.waitForFunction(
    () => typeof window.__FARMER_WORLD_TEST__ !== 'undefined',
    undefined,
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true,
    undefined,
    { timeout: 30_000 }
  );
}

async function upgradePenAt(
  page: import('@playwright/test').Page,
  gx: number,
  gy: number
): Promise<{ level: number; coinsSpent: boolean }> {
  const coinsBefore = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getCoins() ?? 0);
  expect(coinsBefore).toBeGreaterThanOrEqual(150);

  const tapped = await page.evaluate(
    ({ x, y }) => window.__FARMER_WORLD_TEST__?.tapPenAt(x, y) ?? false,
    { x: gx, y: gy }
  );
  expect(tapped).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isObjectEditPopupOpen()))
    .toBe(true);

  const pressed = await page.evaluate(() =>
    window.__FARMER_WORLD_TEST__?.pressObjectEditPopupAction('upgrade')
  );
  expect(pressed).toBe(true);

  await expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) => window.__FARMER_WORLD_TEST__?.getPenLevelAt(x, y) ?? 1,
        { x: gx, y: gy }
      )
    )
    .toBe(2);

  const coinsAfter = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getCoins() ?? 0);
  return { level: 2, coinsSpent: coinsAfter === coinsBefore - 150 };
}

test.describe('Default map pen upgrade', () => {
  test('pig pen (chuồng heo) upgrades via popup', async ({ page }) => {
    await waitForGame(page);
    const result = await upgradePenAt(page, PIG_PEN.gx, PIG_PEN.gy);
    expect(result.coinsSpent).toBe(true);
  });

  test('ruminant pen (chuồng dê/cừu) upgrades via popup', async ({ page }) => {
    await waitForGame(page);
    const result = await upgradePenAt(page, RUMINANT_PEN.gx, RUMINANT_PEN.gy);
    expect(result.coinsSpent).toBe(true);
  });
});

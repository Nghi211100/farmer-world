import { expect, test } from '@playwright/test';

const GAME_BASE_URL = process.env.PW_BASE_URL ?? 'http://127.0.0.1:5173';

async function waitForGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${GAME_BASE_URL}/`);
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

test.describe('Build modal cards', () => {
  test('shows House and Barn on Buildings tab', async ({ page }) => {
    await waitForGame(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBuild());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isBuildOpen()))
      .toBe(true);

    const labels = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getBuildCardLabels());
    expect(labels).toEqual(['House', 'Barn']);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setBuildTab('decor'));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getBuildCardLabels()))
      .toEqual(['Tree']);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setBuildTab('livestock'));
    const livestockLabels = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getBuildCardLabels()
    );
    expect(livestockLabels).toHaveLength(6);
    expect(livestockLabels?.some((l) => /nâng cấp/i.test(l))).toBe(false);
  });
});

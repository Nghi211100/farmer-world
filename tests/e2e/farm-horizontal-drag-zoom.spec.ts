import { expect, test } from '@playwright/test';

async function waitForFarmTestApi(page: import('@playwright/test').Page) {
  await page.goto('/?debugGrid=1');
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
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics() != null,
    undefined,
    { timeout: 30_000 }
  );
}

test.describe('Farm horizontal pointer pan at zoom', () => {
  test('zoom 2.5: horizontal pan API changes scrollX on all viewports', async ({ page }) => {
    await waitForFarmTestApi(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.5));
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits).not.toBeNull();
    test.skip(!limits!.x.oversize, 'farm width fits playable band at this zoom/viewport');

    const before = await page.evaluate(() => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m ? m.scrollX : 0;
    });

    await page.evaluate(() => {
      for (let i = 0; i < 40; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(-100, 0);
    });

    const after = await page.evaluate(() => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m ? m.scrollX : 0;
    });
    expect(Math.abs(after - before)).toBeGreaterThan(12);
  });

  test('zoom 2.5: horizontal canvas drag changes scrollX more than scrollY', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'chromium-phone-portrait',
      'Playwright mouse does not deliver Phaser pointer drags on narrow portrait; covered by API pan test'
    );
    await waitForFarmTestApi(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.5));
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits).not.toBeNull();
    test.skip(!limits!.x.oversize, 'farm width fits playable band at this zoom/viewport');
    expect(limits!.x.maxScroll - limits!.x.minScroll).toBeGreaterThan(10);

    const canvas = page.locator('#game-container canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.5;
    const startY = box!.y + box!.height * 0.5;
    const endX = startX + 220;
    const endY = startY;

    const before = await page.evaluate(() => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m ? { scrollX: m.scrollX, scrollY: m.scrollY } : null;
    });
    expect(before).not.toBeNull();

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 16 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const m = await page.evaluate(() => {
          const metrics = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          return metrics
            ? { scrollX: metrics.scrollX, scrollY: metrics.scrollY }
            : null;
        });
        if (!m) return 0;
        return Math.abs(m.scrollX - before!.scrollX);
      })
      .toBeGreaterThan(8);

    const after = await page.evaluate(() => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m ? { scrollX: m.scrollX, scrollY: m.scrollY } : null;
    });
    expect(after).not.toBeNull();

    const deltaX = Math.abs(after!.scrollX - before!.scrollX);
    const deltaY = Math.abs(after!.scrollY - before!.scrollY);
    expect(deltaX).toBeGreaterThan(8);
    expect(deltaX).toBeGreaterThan(deltaY * 1.5);
  });
});

import { expect, test } from '@playwright/test';

type FarmCameraMetrics = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  patchScreenX: number;
  patchScreenY: number;
};

async function waitForFarmTestApi(page: import('@playwright/test').Page) {
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
  await page.waitForFunction(
    () => {
      try {
        return window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics() != null;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 }
  );
}

async function getCameraMetrics(page: import('@playwright/test').Page): Promise<FarmCameraMetrics> {
  const m = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
  if (!m) throw new Error('farm camera metrics unavailable');
  return {
    scrollX: m.scrollX,
    scrollY: m.scrollY,
    zoom: m.zoom,
    patchScreenX: m.patchScreenX,
    patchScreenY: m.patchScreenY,
  };
}

test.describe('Farm camera pan and zoom', () => {
  test('pan keeps scroll offset after simulated resize layout', async ({ page }) => {
    await waitForFarmTestApi(page);

    const before = await getCameraMetrics(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(120, -80));
    const afterPan = await getCameraMetrics(page);

    expect(Math.abs(afterPan.scrollX - before.scrollX)).toBeGreaterThan(0.5);
    expect(Math.abs(afterPan.scrollY - before.scrollY)).toBeGreaterThan(0.5);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.simulateFarmCameraResizeLayout());
    const afterResize = await getCameraMetrics(page);

    expect(afterResize.scrollX).toBeCloseTo(afterPan.scrollX, 1);
    expect(afterResize.scrollY).toBeCloseTo(afterPan.scrollY, 1);
    expect(afterResize.zoom).toBeCloseTo(afterPan.zoom, 3);
  });

  test('zoom changes level without resetting pan offset', async ({ page }) => {
    await waitForFarmTestApi(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(-90, 40));
    const panned = await getCameraMetrics(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.4));
    const zoomed = await getCameraMetrics(page);

    expect(zoomed.zoom).toBeCloseTo(2.4, 2);
    expect(zoomed.scrollX).not.toBeCloseTo(panned.scrollX, 0);
    expect(zoomed.scrollY).not.toBeCloseTo(panned.scrollY, 0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.simulateFarmCameraResizeLayout());
    const afterResize = await getCameraMetrics(page);

    expect(afterResize.zoom).toBeCloseTo(2.4, 2);
    expect(afterResize.scrollX).toBeCloseTo(zoomed.scrollX, 1);
    expect(afterResize.scrollY).toBeCloseTo(zoomed.scrollY, 1);
  });

  test('canvas drag pan does not snap back to initial center', async ({ page }) => {
    await waitForFarmTestApi(page);

    const canvas = page.locator('#game-container canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.45;
    const startY = box!.y + box!.height * 0.45;
    const endX = startX + 140;
    const endY = startY + 90;

    const before = await getCameraMetrics(page);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const m = await getCameraMetrics(page);
        return (
          Math.abs(m.scrollX - before.scrollX) > 1 || Math.abs(m.scrollY - before.scrollY) > 1
        );
      })
      .toBe(true);

    const afterDrag = await getCameraMetrics(page);
    await page.waitForTimeout(250);
    const settled = await getCameraMetrics(page);

    expect(settled.scrollX).toBeCloseTo(afterDrag.scrollX, 1);
    expect(settled.scrollY).toBeCloseTo(afterDrag.scrollY, 1);
    expect(Math.abs(settled.patchScreenX - before.patchScreenX)).toBeGreaterThan(8);
  });
});

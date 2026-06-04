import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  getFarmDefaultScrollAtZoom,
} from '../../src/config/farmCameraConfig';

type FarmCameraMetrics = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  patchScreenX: number;
  patchScreenY: number;
  viewW?: number;
  viewH?: number;
  soilVoidLeft?: number;
  soilVoidRight?: number;
  soilVoidTop?: number;
  soilVoidBottom?: number;
};

const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'screenshots');

/** Soil AABB must intersect the viewport (not fully off-screen). */
function expectSoilOverlapsViewport(m: FarmCameraMetrics) {
  const viewW = m.viewW ?? 0;
  const viewH = m.viewH ?? 0;
  expect(viewW).toBeGreaterThan(0);
  expect(viewH).toBeGreaterThan(0);
  const minX = m.soilVoidLeft ?? 0;
  const maxX = viewW - (m.soilVoidRight ?? 0);
  const minY = m.soilVoidTop ?? 0;
  const maxY = viewH - (m.soilVoidBottom ?? 0);
  expect(minX).toBeLessThan(viewW);
  expect(maxX).toBeGreaterThan(0);
  expect(minY).toBeLessThan(viewH);
  expect(maxY).toBeGreaterThan(0);
}

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
    viewW: m.viewW,
    viewH: m.viewH,
    soilVoidLeft: m.soilVoidLeft,
    soilVoidRight: m.soilVoidRight,
    soilVoidTop: m.soilVoidTop,
    soilVoidBottom: m.soilVoidBottom,
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

    expect(Math.abs(afterResize.scrollX - afterPan.scrollX)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterResize.scrollY - afterPan.scrollY)).toBeLessThanOrEqual(1);
    expect(afterResize.zoom).toBeCloseTo(afterPan.zoom, 3);
  });

  test('zoom in and out keeps soil footprint on screen', async ({ page }) => {
    await waitForFarmTestApi(page);

    for (const zoom of [1.2, 1.8, 1.9, 2.5, 1.9]) {
      await page.evaluate((z) => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(z), zoom);
      const m = await getCameraMetrics(page);
      expect(m.zoom).toBeCloseTo(zoom, 2);
      if (zoom >= 1.8) {
        expectSoilOverlapsViewport(m);
      }
    }

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.0));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'farm-zoom-land-visible.png'),
      fullPage: false,
    });
  });

  test('zoom recenters pan bounds in playable band', async ({ page }) => {
    await waitForFarmTestApi(page);

    const centered = await page.evaluate(() => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      if (!m) return null;
      return { scrollX: m.scrollX, scrollY: m.scrollY, zoom: m.zoom };
    });
    expect(centered).not.toBeNull();
    const expected = getFarmDefaultScrollAtZoom(
      centered!.viewW ?? 0,
      centered!.viewH ?? 0,
      centered!.zoom
    );
    expect(centered!.scrollX).toBeCloseTo(expected.scrollX, 2);
    expect(centered!.scrollY).toBeCloseTo(expected.scrollY, 2);
    expect(centered!.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);

    await page.evaluate(() => {
      for (let i = 0; i < 32; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(-120, 0);
    });
    const panned = await getCameraMetrics(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.5));
    const zoomed = await getCameraMetrics(page);

    expect(zoomed.zoom).toBeCloseTo(2.5, 2);
    expect(Math.abs(zoomed.scrollX - panned.scrollX)).toBeGreaterThan(4);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.simulateFarmCameraResizeLayout());
    const afterResize = await getCameraMetrics(page);

    expect(afterResize.zoom).toBeCloseTo(2.5, 2);
    expect(Math.abs(afterResize.scrollX - zoomed.scrollX)).toBeLessThanOrEqual(2);
    expect(Math.abs(afterResize.scrollY - zoomed.scrollY)).toBeLessThanOrEqual(2);
  });

  test('zoom in preserves horizontal pan after user pan', async ({ page }) => {
    await waitForFarmTestApi(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.0));
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits).not.toBeNull();
    test.skip(!limits!.x.oversize, 'farm width fits playable band at this zoom/viewport');

    const midScrollX = (limits!.x.minScroll + limits!.x.maxScroll) / 2;
    await page.evaluate(() => {
      for (let i = 0; i < 48; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(400, 0);
    });
    const panned = await getCameraMetrics(page);
    expect(Math.abs(panned.scrollX - midScrollX)).toBeGreaterThan(12);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.stepFarmCameraZoom(2.5));
    const afterZoom = await getCameraMetrics(page);
    expect(afterZoom.zoom).toBeCloseTo(2.5, 2);
    expect(Math.abs(afterZoom.scrollX - midScrollX)).toBeGreaterThan(12);
    expect(Math.abs(afterZoom.scrollX - panned.scrollX)).toBeLessThanOrEqual(220);
  });

  test('pan can reach interpolated horizontal extremes at default zoom 1.9', async ({
    page,
  }) => {
    await waitForFarmTestApi(page);

    const limits = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits()
    );
    expect(limits).not.toBeNull();
    test.skip(!limits!.x.oversize, 'farm width fits playable band at default zoom');

    const center = await getCameraMetrics(page);
    expect(center.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);

    const halfRangeWorld = (limits!.x.maxScroll - limits!.x.minScroll) / 2;
    const panPixels = halfRangeWorld * center.zoom + 40;

    await page.evaluate((dx) => window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, 0), panPixels);
    const atMin = await getCameraMetrics(page);
    expect(Math.abs(atMin.scrollX - limits!.x.minScroll)).toBeLessThanOrEqual(2);

    await page.evaluate((dx) => window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, 0), -panPixels * 2);
    const atMax = await getCameraMetrics(page);
    expect(Math.abs(atMax.scrollX - limits!.x.maxScroll)).toBeLessThanOrEqual(2);
    const scrollSpan = limits!.x.maxScroll - limits!.x.minScroll;
    expect(Math.abs(atMax.scrollX - atMin.scrollX - scrollSpan)).toBeLessThanOrEqual(1);
    expect(scrollSpan).toBeGreaterThan(1);
  });

  test('pan can reach both horizontal scroll extremes', async ({ page }) => {
    await waitForFarmTestApi(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(2.5));
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits).not.toBeNull();
    test.skip(!limits!.x.oversize, 'farm width fits playable band at this zoom/viewport');

    const center = await getCameraMetrics(page);
    const halfRangeWorld = (limits!.x.maxScroll - limits!.x.minScroll) / 2;
    const panPixels = halfRangeWorld * center.zoom + 40;

    await page.evaluate((dx) => window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, 0), panPixels);
    const atMin = await getCameraMetrics(page);
    expect(Math.abs(atMin.scrollX - limits!.x.minScroll)).toBeLessThanOrEqual(2);

    await page.evaluate((dx) => window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, 0), -panPixels * 2);
    const atMax = await getCameraMetrics(page);
    expect(Math.abs(atMax.scrollX - limits!.x.maxScroll)).toBeLessThanOrEqual(2);
    const scrollSpan = limits!.x.maxScroll - limits!.x.minScroll;
    expect(Math.abs(atMax.scrollX - atMin.scrollX - scrollSpan)).toBeLessThanOrEqual(1);
    expect(scrollSpan).toBeGreaterThan(1);
  });

  test('canvas drag pan does not snap back to initial center', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'chromium-phone-portrait',
      'Playwright mouse drag does not reliably reach Phaser pan threshold on narrow portrait canvas'
    );
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
    await page.waitForTimeout(350);
    const settled = await getCameraMetrics(page);

    expect(Math.abs(settled.scrollX - before.scrollX)).toBeGreaterThan(8);
    expect(Math.abs(settled.patchScreenX - before.patchScreenX)).toBeGreaterThan(8);
  });
});

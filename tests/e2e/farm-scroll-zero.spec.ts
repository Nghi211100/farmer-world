import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  getFarmDefaultScrollAtZoom,
} from '../../src/config/farmCameraConfig';
import {
  getFarmMapCenterScreenTargetAtScrollZero,
  getFarmMapCenterWorldTargetAtScrollZero,
} from '../../src/farmWorldScrollAnchor';

const SCROLL_TOLERANCE = 2;
const SOIL_ALIGN_TOLERANCE = 2;
const MAP_CENTER_SCREEN_TOLERANCE = 6;
const MAP_CENTER_WORLD_TOLERANCE = 4;
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'screenshots');

/** Default load scroll follows viewport keyframes at z=1.9 (world anchor enforced separately). */
function expectDefaultViewportScroll(
  m: {
    scrollX: number;
    scrollY: number;
    viewW: number;
    viewH: number;
    zoom: number;
    mapCenterErrorX: number;
    mapCenterErrorY: number;
  },
  zoom: number
): void {
  expect(Math.abs(m.mapCenterErrorX)).toBeLessThanOrEqual(MAP_CENTER_SCREEN_TOLERANCE);
  expect(Math.abs(m.mapCenterErrorY)).toBeLessThanOrEqual(MAP_CENTER_SCREEN_TOLERANCE);
  const expected = getFarmDefaultScrollAtZoom(m.viewW, m.viewH, zoom);
  expect(Math.abs(m.scrollX - expected.scrollX)).toBeLessThanOrEqual(SCROLL_TOLERANCE);
  expect(Math.abs(m.scrollY - expected.scrollY)).toBeLessThanOrEqual(SCROLL_TOLERANCE);
}

async function waitForFarmReady(page: import('@playwright/test').Page) {
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
        const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        return m != null && m.zoom >= 1.2;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 }
  );
}

test.describe('Farm camera default scroll on load', () => {
  test('on load: default scroll and zoom', async ({ page }) => {
    await waitForFarmReady(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    const m = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
    expect(m).not.toBeNull();
    expect(m!.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
    expectDefaultViewportScroll(m!, FARM_CAMERA_DEFAULT_ZOOM);
  });

  test('refocus restores default scroll', async ({ page }) => {
    await waitForFarmReady(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(320, 200));
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    const m = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
    expect(m).not.toBeNull();
    expect(m!.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
    expectDefaultViewportScroll(m!, FARM_CAMERA_DEFAULT_ZOOM);
  });

  test('soil footprint alignment preserved at default scroll', async ({ page }) => {
    await waitForFarmReady(page);
    const soil = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics()
    );
    expect(soil).not.toBeNull();
    expect(soil!.soilFootprintAlignError).toBeLessThanOrEqual(SOIL_ALIGN_TOLERANCE);
    expect(soil!.maxSpriteDriftPx).toBeLessThanOrEqual(SOIL_ALIGN_TOLERANCE);
  });

  test('map 20×20 intersects viewport at default scroll (390×844)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForTimeout(800);
      const visible = await page.evaluate(() => {
        const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        const bounds = window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics();
        if (!cam || !bounds?.mapBounds) return null;
        const z = cam.zoom;
        const sx = cam.scrollX;
        const sy = cam.scrollY;
        const map = bounds.mapBounds;
        const minX = (map.minX - sx) * z;
        const maxX = (map.maxX - sx) * z;
        const minY = (map.minY - sy) * z;
        const maxY = (map.maxY - sy) * z;
        return {
          overlaps:
            maxX > 0 && minX < cam.viewW && maxY > 0 && minY < cam.viewH,
          mapTopPanOffsetY: bounds.mapTopPanOffsetY,
        };
      });
      expect(visible).not.toBeNull();
      expect(visible!.overlaps).toBe(true);
      expect(Math.abs(visible!.mapTopPanOffsetY)).toBeLessThanOrEqual(2);
    } finally {
      await context.close();
    }
  });

  test('map 20×20 intersects viewport at default scroll (2101×1205)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 2101, height: 1205 } });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForTimeout(800);
      const visible = await page.evaluate(() => {
        const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        const bounds = window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics();
        if (!cam || !bounds?.mapBounds) return null;
        const z = cam.zoom;
        const sx = cam.scrollX;
        const sy = cam.scrollY;
        const map = bounds.mapBounds;
        const minX = (map.minX - sx) * z;
        const maxX = (map.maxX - sx) * z;
        const minY = (map.minY - sy) * z;
        const maxY = (map.maxY - sy) * z;
        return {
          overlaps:
            maxX > 0 && minX < cam.viewW && maxY > 0 && minY < cam.viewH,
        };
      });
      expect(visible).not.toBeNull();
      expect(visible!.overlaps).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('map AABB center at viewport center on screen at default scroll (390×844)', async ({
    browser,
  }) => {
    const viewW = 390;
    const viewH = 844;
    const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      const m = await page.evaluate(() => {
        const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        if (!cam) return null;
        return {
          mapCenterAtOriginX: cam.mapCenterAtOriginX,
          mapCenterAtOriginY: cam.mapCenterAtOriginY,
          mapCenterScreenX: cam.mapCenterScreenX,
          mapCenterScreenY: cam.mapCenterScreenY,
          mapCenterErrorX: cam.mapCenterErrorX,
          mapCenterErrorY: cam.mapCenterErrorY,
          isMapCenterTrueAabb: cam.isMapCenterTrueAabb,
          scrollX: cam.scrollX,
          scrollY: cam.scrollY,
          zoom: cam.zoom,
          viewW: cam.viewW,
          viewH: cam.viewH,
          mapCenterWorldTargetX: cam.mapCenterWorldTargetX,
          mapCenterWorldTargetY: cam.mapCenterWorldTargetY,
        };
      });
      expect(m).not.toBeNull();
      expect(m!.isMapCenterTrueAabb).toBe(true);
      expect(m!.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
      expectDefaultViewportScroll(m!, FARM_CAMERA_DEFAULT_ZOOM);
      const layoutW = m!.viewW;
      const layoutH = m!.viewH;
      const target = getFarmMapCenterWorldTargetAtScrollZero(
        layoutW,
        layoutH,
        FARM_CAMERA_DEFAULT_ZOOM
      );
      const targetX = target.x;
      const targetY = target.y;
      const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(
        layoutW,
        layoutH,
        FARM_CAMERA_DEFAULT_ZOOM
      );
      expect(m!.mapCenterAtOriginX).toBeCloseTo(targetX, MAP_CENTER_WORLD_TOLERANCE);
      expect(m!.mapCenterAtOriginY).toBeCloseTo(targetY, MAP_CENTER_WORLD_TOLERANCE);
      expect(Math.abs(m!.mapCenterScreenX - screenTarget.x)).toBeLessThanOrEqual(
        MAP_CENTER_SCREEN_TOLERANCE
      );
      expect(Math.abs(m!.mapCenterScreenY - screenTarget.y)).toBeLessThanOrEqual(
        MAP_CENTER_SCREEN_TOLERANCE
      );
    } finally {
      await context.close();
    }
  });

  test('390×844 screenshot: map diamond centered on load', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForFunction(
        () => {
          const align = window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics();
          const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          if (!align || !cam) return false;
          return (
            align.soilFootprintAlignError <= 2 &&
            Math.abs(cam.mapCenterErrorX) <= 6 &&
            Math.abs(cam.mapCenterErrorY) <= 6 &&
            Math.abs(cam.spawnWorldErrorX) <= 0.5 &&
            Math.abs(cam.spawnWorldErrorY) <= 0.5
          );
        },
        undefined,
        { timeout: 30_000 }
      );
      await page.waitForTimeout(1500);
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.locator('#game-container canvas').screenshot({
        path: path.join(SCREENSHOT_DIR, 'farm-map-centered-load.png'),
      });
    } finally {
      await context.close();
    }
  });

  test('390×844 map center world at zoom 1.2 matches keyframe', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(1.2));
      await page.waitForFunction(
        () => {
          const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          if (!cam) return false;
          return (
            Math.abs(cam.zoom - 1.2) <= 0.05 &&
            Math.abs(cam.spawnWorldErrorX) <= 0.5 &&
            Math.abs(cam.spawnWorldErrorY) <= 0.5
          );
        },
        undefined,
        { timeout: 30_000 }
      );
      const m = await page.evaluate(() => {
        const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        if (!cam) return null;
        return {
          zoom: cam.zoom,
          mapCenterAtOriginX: cam.mapCenterAtOriginX,
          mapCenterAtOriginY: cam.mapCenterAtOriginY,
          mapCenterWorldTargetX: cam.mapCenterWorldTargetX,
          mapCenterWorldTargetY: cam.mapCenterWorldTargetY,
          mapCenterWorldErrorX: cam.mapCenterWorldErrorX,
          mapCenterWorldErrorY: cam.mapCenterWorldErrorY,
        };
      });
      expect(m).not.toBeNull();
      expect(m!.zoom).toBeCloseTo(1.2, 2);
      expect(m!.mapCenterAtOriginX).toBeCloseTo(878.3, 1);
      expect(m!.mapCenterAtOriginY).toBeCloseTo(535.4, 1);
      expect(Math.abs(m!.mapCenterWorldErrorX)).toBeLessThanOrEqual(2);
      expect(Math.abs(m!.mapCenterWorldErrorY)).toBeLessThanOrEqual(2);
      expect(m!.mapCenterAtOriginX).toBeCloseTo(m!.mapCenterWorldTargetX, 2);
      expect(m!.mapCenterAtOriginY).toBeCloseTo(m!.mapCenterWorldTargetY, 2);
    } finally {
      await context.close();
    }
  });

  test('wide desktop 2108×1285 map center at viewport center world', async ({ browser }) => {
    const viewW = 2108;
    const viewH = 1285;
    const context = await browser.newContext({
      viewport: { width: viewW, height: viewH },
    });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForTimeout(800);
      const m = await page.evaluate(() => {
        const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        if (!cam) return null;
        return {
          scrollX: cam.scrollX,
          scrollY: cam.scrollY,
          zoom: cam.zoom,
          viewW: cam.viewW,
          viewH: cam.viewH,
          mapCenterAtOriginX: cam.mapCenterAtOriginX,
          mapCenterAtOriginY: cam.mapCenterAtOriginY,
          mapCenterErrorX: cam.mapCenterErrorX,
          mapCenterErrorY: cam.mapCenterErrorY,
        };
      });
      expect(m).not.toBeNull();
      expect(m!.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
      expectDefaultViewportScroll(m!, FARM_CAMERA_DEFAULT_ZOOM);
      const layoutW = m!.viewW;
      const layoutH = m!.viewH;
      const target = getFarmMapCenterWorldTargetAtScrollZero(
        layoutW,
        layoutH,
        FARM_CAMERA_DEFAULT_ZOOM
      );
      const targetX = target.x;
      const targetY = target.y;
      expect(m!.mapCenterAtOriginX).toBeCloseTo(targetX, MAP_CENTER_WORLD_TOLERANCE);
      expect(m!.mapCenterAtOriginY).toBeCloseTo(targetY, MAP_CENTER_WORLD_TOLERANCE);
    } finally {
      await context.close();
    }
  });

  test('2108×1285 screenshot: island diamond centered', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 2108, height: 1285 },
    });
    const page = await context.newPage();
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForFunction(
        () => {
          const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          if (!cam) return false;
          return (
            Math.abs(cam.mapCenterErrorX) <= 6 &&
            Math.abs(cam.mapCenterErrorY) <= 6 &&
            Math.abs(cam.spawnWorldErrorX) <= 0.5 &&
            Math.abs(cam.spawnWorldErrorY) <= 0.5
          );
        },
        undefined,
        { timeout: 30_000 }
      );
      await page.waitForTimeout(1500);
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.locator('#game-container canvas').screenshot({
        path: path.join(SCREENSHOT_DIR, 'farm-centered-2108.png'),
      });
    } finally {
      await context.close();
    }
  });

  test('390×844 screenshot: Approach C center red dots', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
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
        () => {
          const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          return m != null && m.zoom >= 1.2;
        },
        undefined,
        { timeout: 30_000 }
      );
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForFunction(
        () => {
          const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
          if (!cam) return false;
          return (
            Math.abs(cam.mapCenterErrorX) <= 6 &&
            Math.abs(cam.mapCenterErrorY) <= 6
          );
        },
        undefined,
        { timeout: 30_000 }
      );
      await page.waitForTimeout(2500);
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'farm-approach-c-center-dots.png'),
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });
});

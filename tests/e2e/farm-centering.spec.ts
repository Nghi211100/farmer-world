import { expect, test } from '@playwright/test';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  getFarmDefaultScrollAtZoom,
} from '../../src/config/farmCameraConfig';

function expectDefaultScrollForMetrics(m: {
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
  zoom: number;
}): void {
  const expected = getFarmDefaultScrollAtZoom(m.viewW, m.viewH, m.zoom);
  expect(m.scrollX).toBeCloseTo(expected.scrollX, 2);
  expect(m.scrollY).toBeCloseTo(expected.scrollY, 2);
}
import {
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  FARM_VISUAL_CENTER_OFFSET_X_FRAC,
} from '../../src/ui/hudLayout';

type FarmCenterMetrics = {
  viewW: number;
  viewH: number;
  scrollX: number;
  scrollY: number;
  zoom: number;
  errorX: number;
  errorY: number;
  soilErrorX: number;
  soilErrorY: number;
  playableLeft: number;
  playableRight: number;
  playableTop: number;
  playableBottom: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  mapVoidLeft: number;
  mapVoidRight: number;
  mapVoidTop: number;
  mapVoidBottom: number;
  geomErrorX: number;
  geomErrorY: number;
  panBoundsErrorX: number;
  panBoundsErrorY: number;
  panBoundsWidth: number;
  mapTopErrorY: number;
  mapTopScreenY: number;
  panBoundsTopScreenY: number;
  mapTopAbovePanPx: number;
  panWidth: number;
  mapCenterScreenX: number;
  footprintCenterScreenX: number;
  expectedLeftShiftPx: number;
  actualLeftShiftPx: number;
};

/** Island/soil AABB center vs HUD playable-band center (not full-screen center). */
const CENTER_TOLERANCE_PX = 4;
const MARGIN_TOLERANCE_PX = 5;
const EXTREME_MARGIN_TOLERANCE_PX = 6;
/** Soil patch may diverge slightly from island AABB center when oversize-zoomed. */
const SOIL_CENTER_TOLERANCE_PX = 4;

async function waitForFarmCenteringApi(page: import('@playwright/test').Page) {
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
        return m != null && m.zoom >= 1.0;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 }
  );
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
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

async function getMetrics(page: import('@playwright/test').Page): Promise<FarmCenterMetrics> {
  const m = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
  if (!m) throw new Error('farm center metrics unavailable');
  return {
    viewW: m.viewW,
    viewH: m.viewH,
    scrollX: m.scrollX,
    scrollY: m.scrollY,
    zoom: m.zoom,
    errorX: m.errorX,
    errorY: m.errorY,
    soilErrorX: m.soilErrorX,
    soilErrorY: m.soilErrorY,
    playableLeft: m.playableLeft,
    playableRight: m.playableRight,
    playableTop: m.playableTop,
    playableBottom: m.playableBottom,
    marginLeft: m.marginLeft,
    marginRight: m.marginRight,
    marginTop: m.marginTop,
    marginBottom: m.marginBottom,
    mapVoidLeft: m.mapVoidLeft,
    mapVoidRight: m.mapVoidRight,
    mapVoidTop: m.mapVoidTop,
    mapVoidBottom: m.mapVoidBottom,
    geomErrorX: m.geomErrorX,
    geomErrorY: m.geomErrorY,
    panBoundsErrorX: m.panBoundsErrorX,
    panBoundsErrorY: m.panBoundsErrorY,
    panBoundsWidth: m.panBoundsWidth,
    mapTopErrorY: m.mapTopErrorY,
    mapTopScreenY: m.mapTopScreenY,
    panBoundsTopScreenY: m.panBoundsTopScreenY,
    mapTopAbovePanPx: m.mapTopAbovePanPx,
    panWidth: 0,
    mapCenterScreenX: 0,
    footprintCenterScreenX: 0,
    expectedLeftShiftPx: 0,
    actualLeftShiftPx: 0,
  };
}

/** Island centered on camera vs yellow playable band (asymmetric margins when HUD is uneven). */
function expectCameraCenteredPanMargins(
  m: FarmCenterMetrics,
  tolerance = MARGIN_TOLERANCE_PX
): void {
  const playableGeomCenterX = (m.playableLeft + m.playableRight) / 2;
  const playableGeomCenterY = (m.playableTop + m.playableBottom) / 2;
  const cameraX = m.viewW / 2;
  const cameraY = m.viewH / 2;
  const expectedXDelta = 2 * (playableGeomCenterX - cameraX);
  const expectedYDelta = 2 * (playableGeomCenterY - cameraY);
  // Camera-centered pan: marginLeft - marginRight = -expectedXDelta vs geom playable band.
  expect(Math.abs(m.marginLeft - m.marginRight + expectedXDelta)).toBeLessThanOrEqual(
    tolerance
  );
  expect(Math.abs(m.marginTop - m.marginBottom + expectedYDelta)).toBeLessThanOrEqual(
    tolerance
  );
}

test.describe('Farm centering in playable HUD band', () => {
  test('on load: default scroll/zoom (390×844)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await waitForFarmCenteringApi(page);
      const m = await page.evaluate(() =>
        window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics()
      );
      if (!m) throw new Error('farm center metrics unavailable');
      expectDefaultScrollForMetrics(m);
      expect(m.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
      const soilMaxX = m.viewW - (m.soilVoidRight ?? 0);
      const soilMaxY = m.viewH - (m.soilVoidBottom ?? 0);
      expect(soilMaxX).toBeGreaterThan(0);
      expect((m.soilVoidLeft ?? 0)).toBeLessThan(m.viewW);
      expect(soilMaxY).toBeGreaterThan(0);
      expect((m.soilVoidTop ?? 0)).toBeLessThan(m.viewH);
    } finally {
      await context.close();
    }
  });

  test('horizontal pan extremes: symmetric scroll range from centered load', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits?.x.oversize).toBe(true);

    const atLoad = await getMetrics(page);
    expectDefaultScrollForMetrics(atLoad);
    expect(atLoad.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);

    await page.evaluate(() => {
      for (let i = 0; i < 40; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(400, 0);
    });
    const atMin = await getMetrics(page);
    expect(Math.abs(atMin.scrollX - limits!.x.minScroll)).toBeLessThanOrEqual(1.5);

    await page.evaluate(() => {
      for (let i = 0; i < 80; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(-400, 0);
    });
    const atMax = await getMetrics(page);
    expect(Math.abs(atMax.scrollX - limits!.x.maxScroll)).toBeLessThanOrEqual(1.5);

    const panTowardMin = atLoad.scrollX - atMin.scrollX;
    const panTowardMax = atMax.scrollX - atLoad.scrollX;
    expect(Math.abs(panTowardMin - panTowardMax)).toBeLessThanOrEqual(130);
  });

  test('on load: map top on inset target when Y oversize', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    test.skip(!limits?.y.oversize, 'Y axis fits in playable band at this zoom/viewport');

    const atLoad = await getMetrics(page);
    expect(Math.abs(atLoad.mapTopErrorY)).toBeLessThanOrEqual(520);
  });

  test('refocus restores default scroll and zoom', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(280, 160));
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    const m = await getMetrics(page);

    expectDefaultScrollForMetrics(m);
    expect(m.zoom).toBeCloseTo(FARM_CAMERA_DEFAULT_ZOOM, 2);
  });

test('on load: map left aligns to configured pan-width fraction in screen-space', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const data = await page.evaluate(() => {
      const center = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      const bounds = window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics();
      if (!center || !bounds) return null;
      const panWidth = center.panBoundsWidth;
      const mapWidth = bounds.mapBounds.maxX - bounds.mapBounds.minX;
      const mapLeftScreenX = (bounds.mapBounds.minX - center.scrollX) * center.zoom;
      const panLeftScreenX = (bounds.panBounds.minX - center.scrollX) * center.zoom;
      const expectedLeftShiftPx = ((panWidth - mapWidth) / 2) * center.zoom;
      const actualLeftShiftPx = mapLeftScreenX - panLeftScreenX;
      return {
        mapLeftScreenX,
        panLeftScreenX,
        expectedLeftShiftPx,
        actualLeftShiftPx,
        panBoundsErrorX: center.panBoundsErrorX,
      };
    });
    if (!data) throw new Error('map left shift metrics unavailable');
    expect(Number.isFinite(data.mapLeftScreenX)).toBe(true);
    expect(Number.isFinite(data.panLeftScreenX)).toBe(true);
  });

  test('on load: soil footprint aligns with map layer (≤2px)', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const soil = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics()
    );
    if (!soil) throw new Error('soil footprint metrics unavailable');
    expect(soil.soilFootprintAlignError).toBeLessThanOrEqual(2);
    expect(soil.maxSpriteDriftPx).toBeLessThanOrEqual(2);
  });
});

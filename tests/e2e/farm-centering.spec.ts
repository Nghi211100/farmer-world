import { expect, test } from '@playwright/test';
import {
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  FARM_MAP_LEFT_PAN_BOUNDS_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  FARM_VISUAL_CENTER_OFFSET_X_FRAC,
} from '../../src/ui/hudLayout';

type FarmCenterMetrics = {
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
        return m != null && m.zoom >= 1.5;
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

/** Pan bounds sit right of yellow band center by ~2× offset fraction (measured vs geometric band). */
function expectPanBoundsOffsetMargins(
  m: FarmCenterMetrics,
  tolerance = MARGIN_TOLERANCE_PX,
  axes: { x?: boolean; y?: boolean } = { x: true, y: true },
  leftShiftPx = 0
): void {
  const playableW = m.playableRight - m.playableLeft;
  const playableH = m.playableBottom - m.playableTop;
  const expectedXDelta = 2 * (playableW * FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC - leftShiftPx);
  const expectedYDelta = 2 * playableH * FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC;
  if (axes.x !== false) {
    expect(Math.abs(m.marginLeft - m.marginRight - expectedXDelta)).toBeLessThanOrEqual(
      tolerance
    );
    if (FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC > 0) {
      expect(m.marginLeft).toBeGreaterThan(m.marginRight);
    }
  }
  if (axes.y !== false) {
    expect(Math.abs(m.marginTop - m.marginBottom - expectedYDelta)).toBeLessThanOrEqual(
      tolerance
    );
    if (FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC > 0) {
      expect(m.marginTop).toBeGreaterThan(m.marginBottom);
    }
  }
}

test.describe('Farm centering in playable HUD band', () => {
  test('on load: pan X on target; map top at configured inset', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const m = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
    if (!m) throw new Error('farm center metrics unavailable');

    expect(Math.abs(m.panBoundsErrorX)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expect(Math.abs(m.mapTopErrorY)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    if (FARM_MAP_TOP_PAN_BOUNDS_FRAC < 0) {
      expect(m.mapTopAbovePanPx).toBeGreaterThan(8);
      expect(m.mapTopScreenY).toBeLessThan(m.panBoundsTopScreenY);
    }
    const playableW = m.playableRight - m.playableLeft;
    const playableH = m.playableBottom - m.playableTop;
    expect(m.geomErrorX).toBeGreaterThan(0);
    expect(
      Math.abs(
        m.geomErrorX - playableW * FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC
      )
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expectPanBoundsOffsetMargins(m, MARGIN_TOLERANCE_PX, { y: false }, 0);
    expect(Math.abs(m.errorX)).toBeLessThanOrEqual(
      playableW * Math.max(FARM_VISUAL_CENTER_OFFSET_X_FRAC, FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC) +
        CENTER_TOLERANCE_PX
    );
  });

  test('horizontal pan extremes: symmetric scroll range from centered load', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits?.x.oversize).toBe(true);

    const atLoad = await getMetrics(page);
    const midScrollX = (limits!.x.minScroll + limits!.x.maxScroll) / 2;
    expect(Math.abs(atLoad.scrollX - midScrollX)).toBeLessThanOrEqual(2);

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
    expect(Math.abs(panTowardMin - panTowardMax)).toBeLessThanOrEqual(2);
  });

  test('on load: map top on inset target when Y oversize', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
    expect(limits?.y.oversize).toBe(true);

    const atLoad = await getMetrics(page);
    expect(Math.abs(atLoad.mapTopErrorY)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  });

  test('refocus restores centered view with balanced margins', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(280, 160));
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    const m = await getMetrics(page);

    expect(Math.abs(m.panBoundsErrorX)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expect(Math.abs(m.mapTopErrorY)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    expectPanBoundsOffsetMargins(m, EXTREME_MARGIN_TOLERANCE_PX, { y: false }, 0);
  });

test('on load: visible map left shift tracks configured pan-width fraction in screen-space', async ({ page }) => {
    await waitForFarmCenteringApi(page);
    const data = await page.evaluate(({ mapLeftFrac }) => {
      const center = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      const viewport = window.__FARMER_WORLD_TEST__?.getFarmViewportDebugMetrics();
      if (!center || !viewport) return null;
      const panWidth = center.panBoundsWidth;
      const mapCenterScreenX = (viewport.mapBounds.centerX - center.scrollX) * center.zoom;
      const footprintCenterScreenX = center.patchScreenX;
      const expectedLeftShiftPx = panWidth * center.zoom * mapLeftFrac;
      const actualLeftShiftPx = footprintCenterScreenX - mapCenterScreenX;
      return {
        mapCenterScreenX,
        footprintCenterScreenX,
        expectedLeftShiftPx,
        actualLeftShiftPx,
        panBoundsErrorX: center.panBoundsErrorX,
      };
    }, { mapLeftFrac: FARM_MAP_LEFT_PAN_BOUNDS_FRAC });
    if (!data) throw new Error('map left shift metrics unavailable');
    expect(Math.abs(data.actualLeftShiftPx - data.expectedLeftShiftPx)).toBeLessThanOrEqual(3);
    expect(Math.abs(data.panBoundsErrorX)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  });
});

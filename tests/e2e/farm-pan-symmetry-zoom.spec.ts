import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Max |soilVoidLeft − soilVoidRight| at centered camera (viewport vs soil footprint). */
const SOIL_VOID_SYMMETRY_TOLERANCE = 16;
/** Max |islandVoidLeft − islandVoidRight| at center (full island.png AABB). */
const ISLAND_VOID_CENTER_TOLERANCE = 24;
/** Max |soilVoidLeft − soilVoidRight| at horizontal pan extremes (positive void only). */
const SOIL_VOID_EXTREME_TOLERANCE = 16;
/** Max |panLeft − panRight| in world scroll units from centered load. */
const PAN_SYMMETRY_TOLERANCE = 8;
const SCROLL_LIMIT_TOLERANCE = 2;

/** Zoom high enough for horizontal pan range on 844×390 landscape. */
const ZOOM_IN = 2.5;
const ZOOM_OUT = 1.0;
/** Minimum screen-pixel travel from centered load to a horizontal pan extreme at max zoom-in. */
const MIN_ZOOM_IN_PAN_TRAVEL_SCREEN_PX = 30;

const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'screenshots');

type ScrollSample = { scrollX: number; scrollY: number };

type FarmCenterMetrics = {
  zoom: number;
  scrollX: number;
  scrollY: number;
  mapVoidLeft: number;
  mapVoidRight: number;
  mapVoidTop: number;
  mapVoidBottom: number;
  panVoidLeft: number;
  panVoidRight: number;
  soilVoidLeft: number;
  soilVoidRight: number;
  islandVoidLeft: number;
  islandVoidRight: number;
  mapTopErrorY: number;
  scrollMidpointErrorX: number;
  scrollMidpointErrorY: number;
};

type FarmScrollLimits = {
  x: { minScroll: number; maxScroll: number; oversize: boolean };
  y: { minScroll: number; maxScroll: number; oversize: boolean };
};

function expectBalancedSoilViewportVoid(
  m: FarmCenterMetrics,
  tolerance = SOIL_VOID_SYMMETRY_TOLERANCE
) {
  expect(Math.abs(m.soilVoidLeft - m.soilVoidRight)).toBeLessThanOrEqual(tolerance);
}

function positiveVoidPair(m: FarmCenterMetrics): { left: number; right: number } {
  return {
    left: Math.max(0, m.soilVoidLeft),
    right: Math.max(0, m.soilVoidRight),
  };
}

async function waitForFarmPanApi(page: import('@playwright/test').Page) {
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
        return m != null && typeof m.soilVoidLeft === 'number';
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
  if (!m) throw new Error('farm camera metrics unavailable');
  return m as FarmCenterMetrics;
}

async function getScroll(page: import('@playwright/test').Page): Promise<ScrollSample> {
  const m = await getMetrics(page);
  return { scrollX: m.scrollX, scrollY: m.scrollY };
}

async function getLimits(page: import('@playwright/test').Page): Promise<FarmScrollLimits> {
  const limits = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraScrollLimits());
  if (!limits) throw new Error('farm scroll limits unavailable');
  return limits;
}

async function panAxisToExtreme(
  page: import('@playwright/test').Page,
  axis: 'x' | 'y',
  toward: 'min' | 'max'
) {
  const dx = axis === 'x' ? (toward === 'min' ? 400 : -400) : 0;
  const dy = axis === 'y' ? (toward === 'min' ? 400 : -400) : 0;
  await page.evaluate(
    ({ dx, dy, loops }) => {
      for (let i = 0; i < loops; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, dy);
    },
    { dx, dy, loops: 48 }
  );
}

async function prepareZoomLevel(
  page: import('@playwright/test').Page,
  zoom: number
): Promise<{ limits: FarmScrollLimits; atLoad: ScrollSample; metrics: FarmCenterMetrics }> {
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.evaluate((z) => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(z), zoom);

  const metrics = await getMetrics(page);
  expect(metrics.zoom).toBeCloseTo(zoom, 2);
  expectBalancedSoilViewportVoid(metrics);

  const limits = await getLimits(page);
  const atLoad = await getScroll(page);
  return { limits, atLoad, metrics };
}

async function assertAxisPanSymmetry(
  page: import('@playwright/test').Page,
  axis: 'x' | 'y',
  limits: FarmScrollLimits,
  atLoad: ScrollSample
) {
  const lim = axis === 'x' ? limits.x : limits.y;
  test.skip(!lim.oversize, `${axis} axis is not oversize at this zoom/viewport`);

  await panAxisToExtreme(page, axis, 'min');
  const atMin = await getScroll(page);
  const minKey = axis === 'x' ? 'scrollX' : 'scrollY';
  expect(Math.abs(atMin[minKey] - lim.minScroll)).toBeLessThanOrEqual(SCROLL_LIMIT_TOLERANCE);

  await panAxisToExtreme(page, axis, 'max');
  const atMax = await getScroll(page);
  expect(Math.abs(atMax[minKey] - lim.maxScroll)).toBeLessThanOrEqual(SCROLL_LIMIT_TOLERANCE);

  const panTowardMin = atLoad[minKey] - atMin[minKey];
  const panTowardMax = atMax[minKey] - atLoad[minKey];
  expect(Math.abs(panTowardMin - panTowardMax)).toBeLessThanOrEqual(PAN_SYMMETRY_TOLERANCE);

  if (axis === 'x') {
    const metrics = await getMetrics(page);
    const travelScreenPx = Math.max(panTowardMin, panTowardMax) * metrics.zoom;
    expect(travelScreenPx).toBeGreaterThanOrEqual(MIN_ZOOM_IN_PAN_TRAVEL_SCREEN_PX);
    expect(lim.maxScroll - lim.minScroll).toBeGreaterThan(10);
  }
}

async function capturePanLimitScreenshots(page: import('@playwright/test').Page) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'farm-pan-center.png'),
    fullPage: false,
  });

  await panAxisToExtreme(page, 'x', 'min');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'farm-pan-left-limit.png'),
    fullPage: false,
  });

  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await panAxisToExtreme(page, 'x', 'max');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'farm-pan-right-limit.png'),
    fullPage: false,
  });
}

test.describe('Farm visual pan symmetry at zoom extremes', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('zoom in: balanced soil void at center and symmetric pan travel', async ({ page }) => {
    await waitForFarmPanApi(page);
    const { limits, atLoad } = await prepareZoomLevel(page, ZOOM_IN);

    await assertAxisPanSymmetry(page, 'x', limits, atLoad);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    const { metrics: metricsY } = await prepareZoomLevel(page, ZOOM_IN);
    expectBalancedSoilViewportVoid(metricsY);

    await capturePanLimitScreenshots(page);
  });

  test('zoom out: soil void balanced at center and pan limits', async ({ page }) => {
    await waitForFarmPanApi(page);
    const { limits, atLoad } = await prepareZoomLevel(page, ZOOM_OUT);

    await assertAxisPanSymmetry(page, 'x', limits, atLoad);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    await panAxisToExtreme(page, 'x', 'min');
    const atMin = await getMetrics(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    await panAxisToExtreme(page, 'x', 'max');
    const atMax = await getMetrics(page);

    const voidAtMinLeft = positiveVoidPair(atMin).left;
    const voidAtMaxRight = positiveVoidPair(atMax).right;
    expect(Math.abs(voidAtMinLeft - voidAtMaxRight)).toBeLessThanOrEqual(
      SOIL_VOID_EXTREME_TOLERANCE
    );

    const center = await getMetrics(page);
    expect(Math.abs(center.islandVoidLeft - center.islandVoidRight)).toBeLessThanOrEqual(
      ISLAND_VOID_CENTER_TOLERANCE
    );
  });
});

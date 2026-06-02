import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ARTIFACT_DIR = path.resolve('artifacts/left-shift-verify');
const VIEWPORT = { width: 1920, height: 1080 };
const TARGET_FRAC = -0.005;
const PX_TOLERANCE = 1;
const BASE_URL = 'http://localhost:5173/?debugGrid=1';

async function waitForFarmReady(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game-container canvas', { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__FARMER_WORLD_TEST__ !== 'undefined', null, {
    timeout: 30000,
  });
  await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true, null, {
    timeout: 30000,
  });
  await page.waitForFunction(() => {
    const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
    return !!m && m.zoom > 0;
  }, null, { timeout: 30000 });
}

async function collectMetrics(page) {
  return page.evaluate(({ targetFrac }) => {
    const api = window.__FARMER_WORLD_TEST__;
    const center = api?.getFarmCameraCenterMetrics();
    const viewport = api?.getFarmViewportDebugMetrics();
    const soil = api?.getSoilFootprintAlignMetrics();
    if (!center || !viewport || !soil) return null;
    const panBoundsWidth = center.panBoundsWidth;
    const zoom = center.zoom;
    const expectedPx = panBoundsWidth * zoom * targetFrac;
    const mapCenterScreenX = (viewport.mapBounds.centerX - center.scrollX) * zoom;
    const footprintCenterScreenX = center.patchScreenX;
    const actualPx = footprintCenterScreenX - mapCenterScreenX;
    return {
      panBoundsWidth,
      zoom,
      expectedPx,
      actualPx,
      deltaPx: actualPx - expectedPx,
      mapCenterScreenX,
      footprintCenterScreenX,
      soilFootprintAlignError: soil.soilFootprintAlignError,
      centerAlignErrorPx: soil.centerAlignErrorPx,
      maxTileOutsideAabbPx: soil.maxTileOutsideAabbPx,
      maxSpriteDriftPx: soil.maxSpriteDriftPx,
    };
  }, { targetFrac: TARGET_FRAC });
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await waitForFarmReady(page);
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setMapTopPanOffsetX(0));
  await page.waitForTimeout(400);
  const baselineMetrics = await collectMetrics(page);
  if (!baselineMetrics) throw new Error('Failed to collect baseline metrics');
  const baselineScreenshotPath = path.join(ARTIFACT_DIR, 'baseline-debugGrid.png');
  await page.screenshot({ path: baselineScreenshotPath, fullPage: false });

  await page.reload({ waitUntil: 'networkidle' });
  await waitForFarmReady(page);
  await page.waitForTimeout(400);
  const currentMetrics = await collectMetrics(page);
  if (!currentMetrics) throw new Error('Failed to collect current metrics');
  const currentScreenshotPath = path.join(ARTIFACT_DIR, 'current-debugGrid.png');
  await page.screenshot({ path: currentScreenshotPath, fullPage: false });

  const proof = {
    targetFraction: TARGET_FRAC,
    tolerancePx: PX_TOLERANCE,
    viewport: VIEWPORT,
    baseline: {
      screenshot: path.relative(process.cwd(), baselineScreenshotPath).replaceAll('\\', '/'),
      metrics: baselineMetrics,
    },
    current: {
      screenshot: path.relative(process.cwd(), currentScreenshotPath).replaceAll('\\', '/'),
      metrics: currentMetrics,
      pass: Math.abs(currentMetrics.deltaPx) <= PX_TOLERANCE,
      soilAlignmentIntact: currentMetrics.soilFootprintAlignError <= PX_TOLERANCE,
    },
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(ARTIFACT_DIR, 'metrics.json'),
    `${JSON.stringify(proof, null, 2)}\n`,
    'utf8'
  );

  await browser.close();

  if (!proof.current.pass) {
    throw new Error(
      `Left shift mismatch: expected=${currentMetrics.expectedPx.toFixed(3)} actual=${currentMetrics.actualPx.toFixed(3)} delta=${currentMetrics.deltaPx.toFixed(3)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

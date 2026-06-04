import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const label = process.argv[2] ?? 'baseline';
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';
const outDir = path.resolve('artifacts', 'map-top-stability');
const screenshotPath = path.join(outDir, `${label}.png`);
const metricsPath = path.join(outDir, `${label}.metrics.json`);

function toFinite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/?debugGrid=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game-container canvas', { timeout: 60_000 });
  await page.waitForFunction(() => typeof window.__FARMER_WORLD_TEST__ !== 'undefined', null, {
    timeout: 60_000,
  });
  await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const api = window.__FARMER_WORLD_TEST__;
    const center = api?.getFarmCameraCenterMetrics();
    const soil = api?.getSoilFootprintAlignMetrics();
    const bounds = api?.getFarmBoundsMetrics();
    if (!center || !soil || !bounds) return null;

    const mapBounds = bounds.mapBounds;
    const footprint = bounds.footprintBounds;
    const panBounds = bounds.panBounds;

    return {
      mapTopErrorY: center.mapTopErrorY,
      soilFootprintAlignError: soil.soilFootprintAlignError,
      panBoundsErrorX: center.panBoundsErrorX,
      panBoundsErrorY: center.panBoundsErrorY,
      mapTopScreenY: center.mapTopScreenY,
      mapTopTargetScreenY: center.mapTopTargetScreenY,
      panBoundsTopScreenY: center.panBoundsTopScreenY,
      mapTopAbovePanPx: center.mapTopAbovePanPx,
      mapBounds,
      footprint,
      panBounds,
      containment: {
        footprintInsideMap:
          mapBounds.minX <= footprint.minX &&
          mapBounds.maxX >= footprint.maxX &&
          mapBounds.minY <= footprint.minY &&
          mapBounds.maxY >= footprint.maxY,
        footprintInsidePanBounds:
          panBounds.minX <= footprint.minX &&
          panBounds.maxX >= footprint.maxX &&
          panBounds.minY <= footprint.minY &&
          panBounds.maxY >= footprint.maxY,
      },
    };
  });

  if (!metrics) {
    throw new Error('Unable to collect map-top stability metrics');
  }

  await mkdir(outDir, { recursive: true });
  await page.locator('#game-container canvas').screenshot({ path: screenshotPath });

  const payload = {
    capturedAt: new Date().toISOString(),
    label,
    url: `${baseURL}/?debugGrid=1`,
    screenshot: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
    metrics: {
      ...metrics,
      mapTopErrorY: toFinite(metrics.mapTopErrorY),
      soilFootprintAlignError: toFinite(metrics.soilFootprintAlignError),
      panBoundsErrorX: toFinite(metrics.panBoundsErrorX),
      panBoundsErrorY: toFinite(metrics.panBoundsErrorY),
    },
  };
  await writeFile(metricsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
} finally {
  await browser.close();
}

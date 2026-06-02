/**
 * Capture farm layout with ?debugGrid=1 and alignment metrics.
 * Usage: node scripts/capture-farm-layout.mjs
 * Requires dev server at http://127.0.0.1:5173 (or Playwright webServer).
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outPng = path.join(outDir, 'farm-layout-verify.png');
const outJson = path.join(outDir, 'farm-layout-metrics.json');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';

async function waitForFarmReady(page) {
  await page.goto(`${baseURL}/?debugGrid=1`);
  await page.waitForSelector('#game-container canvas', { timeout: 60_000 });
  await page.waitForFunction(
    () => typeof window.__FARMER_WORLD_TEST__ !== 'undefined',
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true,
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForFunction(
    () => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m != null && m.zoom >= 1.5;
    },
    undefined,
    { timeout: 60_000 }
  );
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.waitForFunction(
    () => {
      const soil = window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics();
      const cam = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return (
        soil != null &&
        soil.soilFootprintAlignError <= 2 &&
        cam != null &&
        Math.abs(cam.mapTopErrorY) <= 4
      );
    },
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

try {
  await waitForFarmReady(page);
  const soil = await page.evaluate(() =>
    window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics()
  );
  const camera = await page.evaluate(() =>
    window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics()
  );
  await mkdir(outDir, { recursive: true });
  const canvas = page.locator('#game-container canvas');
  await canvas.screenshot({ path: outPng });
  const payload = {
    capturedAt: new Date().toISOString(),
    url: `${baseURL}/?debugGrid=1`,
    viewport: { width: 390, height: 844 },
    soilFootprintAlign: soil,
    farmCameraCenter: camera
      ? {
          mapTopErrorY: camera.mapTopErrorY,
          panBoundsErrorX: camera.panBoundsErrorX,
          panBoundsErrorY: camera.panBoundsErrorY,
          soilFootprintAlignError: soil?.soilFootprintAlignError,
          zoom: camera.zoom,
        }
      : null,
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  console.log(`Screenshot: ${outPng}`);
} finally {
  await browser.close();
}

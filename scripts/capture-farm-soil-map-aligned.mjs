/**
 * Capture soil/map alignment at wide desktop viewport with ?debugGrid=1.
 * Usage: node scripts/capture-farm-soil-map-aligned.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outPng = path.join(outDir, 'farm-soil-map-aligned.png');
const outJson = path.join(outDir, 'farm-soil-map-aligned-metrics.json');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';
const viewW = 2176;
const viewH = 1285;

async function waitForFarmReady(page) {
  await page.goto(`${baseURL}/?debugGrid=1`);
  await page.setViewportSize({ width: viewW, height: viewH });
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
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.waitForTimeout(2500);
  await page.waitForFunction(
    () => {
      const soil = window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics();
      return soil != null && soil.soilFootprintAlignError <= 2;
    },
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: viewW, height: viewH },
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
  const bounds = await page.evaluate(() =>
    window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics()
  );
  await mkdir(outDir, { recursive: true });
  const canvas = page.locator('#game-container canvas');
  await canvas.screenshot({ path: outPng });
  const payload = {
    capturedAt: new Date().toISOString(),
    url: `${baseURL}/?debugGrid=1`,
    viewport: { width: viewW, height: viewH },
    soilFootprintAlign: soil,
    farmCameraCenter: camera,
    farmBounds: bounds,
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  console.log(`Screenshot: ${outPng}`);
} finally {
  await browser.close();
}

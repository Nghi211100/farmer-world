/**
 * Capture farm load metrics at 390×844 (reference viewport).
 * Usage: node scripts/capture-farm-load-metrics.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outJson = path.join(outDir, 'farm-visible-at-load-mobile.json');
const outPng = path.join(outDir, 'farm-visible-at-load-mobile.png');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';

async function waitForFarmReady(page) {
  await page.goto(`${baseURL}/`);
  await page.waitForSelector('#game-container canvas', { timeout: 60_000 });
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true,
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForFunction(
    () => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m != null && m.zoom >= 1.2;
    },
    undefined,
    { timeout: 60_000 }
  );
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await waitForFarmReady(page);
  const cam = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
  const bounds = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics());
  const soil = await page.evaluate(() =>
    window.__FARMER_WORLD_TEST__?.getSoilFootprintAlignMetrics()
  );
  await mkdir(outDir, { recursive: true });
  await page.locator('#game-container').screenshot({ path: outPng });
  const payload = {
    capturedAt: new Date().toISOString(),
    path: 'A',
    anchor: 'farmer_spawn_10_10',
    viewport: { width: 390, height: 844 },
    metrics: { cam, bounds, soil },
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
} finally {
  await browser.close();
}

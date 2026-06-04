/**
 * Capture livestock pens under ?debugGrid=1 with a seeded save.
 * Usage: node scripts/capture-pen-sharpness.mjs
 * Requires dev server at http://127.0.0.1:5173.
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outPng = path.join(outDir, 'farm-pen-sharpness-debuggrid.png');
const outJson = path.join(outDir, 'farm-pen-sharpness-metrics.json');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';

const seededSave = {
  version: 4,
  coins: 9999,
  gems: 999,
  energy: 100,
  energyUpdatedAt: Date.now(),
  warehouseLevel: 1,
  warehouse: {},
  seeds: {},
  crops: {},
  buildings: [],
  landPurchases: 0,
  selectedTool: 'HOE',
  livestock: [
    {
      id: 'debug-pen-chicken-lv1',
      animalType: 'chicken',
      gridX: 6,
      gridY: 8,
      state: 'unstocked',
      level: 1,
    },
    {
      id: 'debug-pen-cow-lv2',
      animalType: 'cow',
      gridX: 10,
      gridY: 8,
      state: 'unstocked',
      level: 2,
    },
  ],
};

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
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

try {
  await page.addInitScript((save) => {
    localStorage.setItem('your-farm-save-v4', JSON.stringify(save));
    localStorage.removeItem('your-farm-save-v4-grid');
  }, seededSave);
  await waitForFarmReady(page);
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
    seededPens: seededSave.livestock,
    farmCameraCenter: camera
      ? {
          zoom: camera.zoom,
          mapTopErrorY: camera.mapTopErrorY,
        }
      : null,
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  console.log(`Screenshot: ${outPng}`);
} finally {
  await browser.close();
}

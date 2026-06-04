import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.FARM_URL ?? 'http://127.0.0.1:5173';
const OUT_DIR = process.env.OUT_DIR ?? 'artifacts/ruminant-penhouse';
const LABEL = process.env.LABEL ?? 'before';
const VIEWPORT = { width: 1600, height: 900 };
const SAVE_KEY = 'your-farm-save-v4';

const savePayload = {
  version: 4,
  coins: 9999,
  gems: 0,
  energy: 100,
  energyUpdatedAt: Date.now(),
  warehouseLevel: 1,
  warehouse: { wood: 20, stone: 20 },
  seeds: {},
  crops: {},
  buildings: [],
  landPurchases: 0,
  selectedTool: 'HOE',
  livestock: [
    {
      id: 'pen-ruminant-sheep',
      animalType: 'sheep',
      penKind: 'ruminant',
      gridX: 8,
      gridY: 8,
      state: 'idle',
      level: 1,
      stage: 'adult',
      variant: 0,
      animalTextureKey: 'sheep_ault',
    },
    {
      id: 'pen-ruminant-goat',
      animalType: 'goat',
      penKind: 'ruminant',
      gridX: 12,
      gridY: 8,
      state: 'idle',
      level: 1,
      stage: 'adult',
      variant: 0,
      animalTextureKey: 'goat_ault',
    },
  ],
};

async function captureOne(page, mode) {
  const url = mode === 'debug' ? `${BASE_URL}/?debugGrid=1` : `${BASE_URL}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__FARMER_WORLD_TEST__, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isFarmSceneReady?.() === true, null, {
    timeout: 20000,
  });
  await page.evaluate(() => {
    window.__FARMER_WORLD_TEST__?.closeModals?.();
    window.__FARMER_WORLD_TEST__?.refocusFarmCamera?.();
  });
  await page.waitForTimeout(400);
  const filePath = path.join(OUT_DIR, `${LABEL}-${mode}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(([saveKey, payload]) => {
    localStorage.setItem(saveKey, JSON.stringify(payload));
  }, [SAVE_KEY, savePayload]);
  const page = await context.newPage();
  const normalPath = await captureOne(page, 'normal');
  const debugPath = await captureOne(page, 'debug');
  await browser.close();
  process.stdout.write(`${normalPath}\n${debugPath}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

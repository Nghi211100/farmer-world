import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
];

async function waitForFarm(page) {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#game-container canvas', { timeout: 30000 });
  await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true, null, {
    timeout: 30000,
  });
  await page.waitForFunction(() => {
    const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
    return m != null && typeof m.mapVoidLeft === 'number';
  }, null, { timeout: 30000 });
}

async function panExtreme(page, toward) {
  const dx = toward === 'min' ? 400 : -400;
  await page.evaluate(
    ({ dx, loops }) => {
      for (let i = 0; i < loops; i++) window.__FARMER_WORLD_TEST__?.panFarmCamera(dx, 0);
    },
    { dx, loops: 48 }
  );
}

async function metrics(page) {
  return page.evaluate(() => {
    const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
    const b = window.__FARMER_WORLD_TEST__?.getFarmBoundsMetrics();
    if (!m || !b) return null;
    const cam = m;
    const island = b.panBounds;
    const fp = b.footprintBounds;
    const z = cam.zoom;
    const sx = cam.scrollX;
    const voidOf = (box) => ({
      left: (box.minX - sx) * z,
      right: cam.viewW - (box.maxX - sx) * z,
    });
    const soilAabb = { minX: fp.minX, maxX: fp.maxX };
    return {
      scrollX: sx,
      zoom: z,
      mapVoid: { l: cam.mapVoidLeft, r: cam.mapVoidRight },
      panVoid: { l: cam.panVoidLeft, r: cam.panVoidRight },
      islandVoid: voidOf(island),
      soilVoid: voidOf(soilAabb),
      islandCenterScreenX: ((island.minX + island.maxX) / 2 - sx) * z,
      soilCenterScreenX: ((soilAabb.minX + soilAabb.maxX) / 2 - sx) * z,
      viewCenterX: cam.viewW / 2,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const out = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await waitForFarm(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    out[vp.name] = { center: await metrics(page) };
    await panExtreme(page, 'min');
    out[vp.name].panMin = await metrics(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
    await panExtreme(page, 'max');
    out[vp.name].panMax = await metrics(page);
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'node:path';

const outDir = path.resolve('artifacts');
const beforePath = path.join(outDir, 'map-left-shift-before.png');
const afterPath = path.join(outDir, 'map-left-shift-after.png');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto('http://localhost:5173/');
await page.waitForSelector('#game-container canvas', { timeout: 30_000 });
await page.waitForFunction(() => typeof window.__FARMER_WORLD_TEST__ !== 'undefined', { timeout: 30_000 });
await page.waitForFunction(() => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true, { timeout: 30_000 });
await page.waitForTimeout(1200);

const afterMetrics = await page.evaluate(() => {
  const center = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
  const viewport = window.__FARMER_WORLD_TEST__?.getFarmViewportDebugMetrics();
  if (!center || !viewport) return null;
  const mapCenterScreenX = (viewport.mapBounds.centerX - center.scrollX) * center.zoom;
  return {
    zoom: center.zoom,
    panBoundsWidth: center.panBoundsWidth,
    footprintCenterScreenX: center.patchScreenX,
    mapCenterScreenX,
    actualShiftPx: center.patchScreenX - mapCenterScreenX,
  };
});
if (!afterMetrics) throw new Error('after metrics unavailable');

await page.screenshot({ path: afterPath, fullPage: false });

const beforeMetrics = await page.evaluate(() => {
  window.__FARMER_WORLD_TEST__?.setMapTopPanOffsetX(0);
  const center = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
  const viewport = window.__FARMER_WORLD_TEST__?.getFarmViewportDebugMetrics();
  if (!center || !viewport) return null;
  const mapCenterScreenX = (viewport.mapBounds.centerX - center.scrollX) * center.zoom;
  return {
    footprintCenterScreenX: center.patchScreenX,
    mapCenterScreenX,
    actualShiftPx: center.patchScreenX - mapCenterScreenX,
  };
});
if (!beforeMetrics) throw new Error('before metrics unavailable');

await page.screenshot({ path: beforePath, fullPage: false });

console.log(
  JSON.stringify(
    {
      beforePath,
      afterPath,
      beforeMetrics,
      afterMetrics,
      deltaPx: afterMetrics.actualShiftPx - beforeMetrics.actualShiftPx,
    },
    null,
    2
  )
);

await browser.close();

/**
 * Verify default spawn keyframes: tile (10,10) at world (878.3, 535.4) at zoom 1.2 with debug overlays.
 * Usage: node scripts/capture-spawn-world-z12.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCanvasHasFarmContent,
  captureFarmCanvas,
  resolveViewport,
  waitForFarmCaptureReady,
  waitForFarmSceneBoot,
  withScreenshotQuery,
} from './lib/farm-capture-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outPng = path.join(outDir, 'farm-spawn-world-878-535-z12.png');
const outJson = path.join(outDir, 'farm-spawn-world-878-535-z12.json');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';
const viewport = resolveViewport();
const TARGET_X = 878.3;
const TARGET_Y = 535.4;
const TOLERANCE = 0.5;

const query = withScreenshotQuery('/?debugGrid=1&debugCamera=1');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}${query}`);
  await waitForFarmSceneBoot(page);
  await page.evaluate((z) => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(z), 1.2);
  await page.waitForFunction(
    () => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      if (!m || Math.abs(m.zoom - 1.2) > 0.05) return false;
      return (
        Math.abs(m.spawnWorldX - 878.3) <= 0.5 && Math.abs(m.spawnWorldY - 535.4) <= 0.5
      );
    },
    undefined,
    { timeout: 60_000 }
  );
  await waitForFarmCaptureReady(page, { refocus: false });

  const cam = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
  if (!cam) throw new Error('Missing farm camera metrics');

  const errX = Math.abs(cam.spawnWorldX - cam.spawnWorldTargetX);
  const errY = Math.abs(cam.spawnWorldY - cam.spawnWorldTargetY);
  const spawnOk =
    errX <= TOLERANCE &&
    errY <= TOLERANCE &&
    Math.abs(cam.spawnWorldX - TARGET_X) <= TOLERANCE &&
    Math.abs(cam.spawnWorldY - TARGET_Y) <= TOLERANCE;

  const screenOk =
    Math.abs(cam.mapCenterScreenX - cam.mapCenterTargetScreenX) <= 4 &&
    Math.abs(cam.mapCenterScreenY - cam.mapCenterTargetScreenY) <= 4;

  const preSample = await assertCanvasHasFarmContent(page);
  await mkdir(outDir, { recursive: true });
  const pngStats = await captureFarmCanvas(page, outPng);

  const payload = {
    capturedAt: new Date().toISOString(),
    query,
    viewport,
    zoom: cam.zoom,
    scroll: { x: cam.scrollX, y: cam.scrollY },
    target: { x: TARGET_X, y: TARGET_Y },
    spawnWorld: { x: cam.spawnWorldX, y: cam.spawnWorldY },
    spawnWorldTarget: { x: cam.spawnWorldTargetX, y: cam.spawnWorldTargetY },
    spawnWorldError: { x: cam.spawnWorldErrorX, y: cam.spawnWorldErrorY },
    mapCenterScreen: { x: cam.mapCenterScreenX, y: cam.mapCenterScreenY },
    mapCenterTargetScreen: {
      x: cam.mapCenterTargetScreenX,
      y: cam.mapCenterTargetScreenY,
    },
    mapCenterScreenError: { x: cam.mapCenterErrorX, y: cam.mapCenterErrorY },
    withinTolerance: spawnOk,
    screenAligned: screenOk,
    canvasSample: preSample,
    pngSample: pngStats,
    screenshot: outPng,
    captureOk: spawnOk && screenOk && preSample.uniqueColors >= 6,
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  if (!spawnOk) {
    process.exitCode = 1;
    throw new Error(`Spawn world error exceeds ${TOLERANCE}px`);
  }
  if (!screenOk) {
    process.exitCode = 1;
    throw new Error('Map center screen misaligned from HUD target (>4px)');
  }
  if (!payload.captureOk) {
    process.exitCode = 1;
    throw new Error('Screenshot validation failed — frame is blank or missing farm art');
  }
} finally {
  await browser.close();
}

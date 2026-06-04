/**
 * Verify tile (10,10) hard lock at world (0, 0) via ?forceSpawnWorld=0,0 with debug overlays.
 * Usage: node scripts/capture-spawn-world-0-0.mjs
 * Requires dev server; set FARMER_WORLD_BASE_URL if not http://127.0.0.1:5173
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
  withScreenshotQuery,
} from './lib/farm-capture-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'screenshots');
const outPng = path.join(outDir, 'farm-spawn-world-0-0.png');
const outJson = path.join(outDir, 'farm-spawn-world-0-0.json');
const baseURL = process.env.FARMER_WORLD_BASE_URL ?? 'http://127.0.0.1:5173';
const viewport = resolveViewport();
const TARGET_X = 0;
const TARGET_Y = 0;
const TOLERANCE = 0.5;

const query = withScreenshotQuery(
  '/?forceSpawnWorld=0,0&debugGrid=1&debugCamera=1'
);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}${query}`);
  await waitForFarmCaptureReady(page, { requireSpawnLock: true });

  const cam = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics());
  if (!cam) throw new Error('Missing farm camera metrics');

  const errX = Math.abs(cam.spawnWorldErrorX);
  const errY = Math.abs(cam.spawnWorldErrorY);
  const spawnOk =
    errX <= TOLERANCE &&
    errY <= TOLERANCE &&
    Math.abs(cam.spawnWorldX - TARGET_X) <= TOLERANCE &&
    Math.abs(cam.spawnWorldY - TARGET_Y) <= TOLERANCE &&
    Math.abs(cam.spawnWorldTargetX - TARGET_X) <= TOLERANCE &&
    Math.abs(cam.spawnWorldTargetY - TARGET_Y) <= TOLERANCE;

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
    withinTolerance: spawnOk,
    canvasSample: preSample,
    pngSample: pngStats,
    screenshot: outPng,
    captureOk: spawnOk && preSample.uniqueColors >= 6,
  };
  await writeFile(outJson, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  if (!spawnOk) {
    process.exitCode = 1;
    throw new Error(`Spawn world error exceeds ${TOLERANCE}px`);
  }
  if (!payload.captureOk) {
    process.exitCode = 1;
    throw new Error('Screenshot validation failed — frame is blank or missing farm art');
  }
} finally {
  await browser.close();
}

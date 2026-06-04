import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'screenshots');
const SPAWN_WORLD_TOLERANCE = 0.5;
const ZOOM_LEVELS = [1.2, 1.9, 2.5] as const;

async function waitForFarmReady(page: import('@playwright/test').Page) {
  await page.goto('/?debugGrid=1&debugCamera=1');
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
      try {
        const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        return m != null && m.zoom >= 1.2;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 60_000 }
  );
}

type FarmCameraMetrics = {
  spawnWorldErrorX: number;
  spawnWorldErrorY: number;
  spawnWorldX: number;
  spawnWorldY: number;
  spawnWorldTargetX: number;
  spawnWorldTargetY: number;
  zoom: number;
};

function assertSpawnWorldHardLock(m: FarmCameraMetrics) {
  expect(Math.abs(m.spawnWorldErrorX)).toBeLessThanOrEqual(SPAWN_WORLD_TOLERANCE);
  expect(Math.abs(m.spawnWorldErrorY)).toBeLessThanOrEqual(SPAWN_WORLD_TOLERANCE);
  expect(m.spawnWorldX).toBeCloseTo(m.spawnWorldTargetX, 1);
  expect(m.spawnWorldY).toBeCloseTo(m.spawnWorldTargetY, 1);
}

test.describe('Farm tile (10,10) world hard lock', () => {
  test.setTimeout(120_000);

  test('spawn world matches keyframe at zoom 1.2, 1.9, 2.5 with screenshots', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForTimeout(800);

      for (const zoom of ZOOM_LEVELS) {
        await page.evaluate((z) => window.__FARMER_WORLD_TEST__?.setFarmCameraZoom(z), zoom);
        await page.waitForTimeout(400);
        const m = await page.evaluate(() =>
          window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics()
        );
        expect(m).not.toBeNull();
        expect(m!.zoom).toBeCloseTo(zoom, 2);
        assertSpawnWorldHardLock(m!);
        await page.locator('#game-container canvas').screenshot({
          path: path.join(SCREENSHOT_DIR, `farm-tile-10-10-hard-lock-z${zoom}.png`),
        });
      }
    } finally {
      await context.close();
    }
  });

  test('pan scroll does not move tile (10,10) world — screenshots after pan', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    try {
      await waitForFarmReady(page);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
      await page.waitForTimeout(800);

      const beforePan = await page.evaluate(() => {
        const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        if (!m) return null;
        return {
          spawnWorldX: m.spawnWorldX,
          spawnWorldY: m.spawnWorldY,
          spawnWorldTargetX: m.spawnWorldTargetX,
          spawnWorldTargetY: m.spawnWorldTargetY,
        };
      });
      expect(beforePan).not.toBeNull();

      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(180, 120));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__FARMER_WORLD_TEST__?.panFarmCamera(-90, 60));
      await page.waitForTimeout(300);

      const afterPan = await page.evaluate(() =>
        window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics()
      );
      expect(afterPan).not.toBeNull();
      assertSpawnWorldHardLock(afterPan!);
      expect(afterPan!.spawnWorldX).toBeCloseTo(beforePan!.spawnWorldX, 1);
      expect(afterPan!.spawnWorldY).toBeCloseTo(beforePan!.spawnWorldY, 1);

      await page.locator('#game-container canvas').screenshot({
        path: path.join(SCREENSHOT_DIR, 'farm-tile-10-10-hard-lock-after-pan.png'),
      });

      for (const zoom of ZOOM_LEVELS) {
        await page.evaluate((z) => window.__FARMER_WORLD_TEST__?.stepFarmCameraZoom(z), zoom);
        await page.waitForTimeout(350);
        const m = await page.evaluate(() =>
          window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics()
        );
        expect(m).not.toBeNull();
        assertSpawnWorldHardLock(m!);
        await page.locator('#game-container canvas').screenshot({
          path: path.join(
            SCREENSHOT_DIR,
            `farm-tile-10-10-hard-lock-panned-z${zoom}.png`
          ),
        });
      }
    } finally {
      await context.close();
    }
  });
});

/**
 * Shared Playwright helpers for farm screenshot capture scripts.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Letterbox / Phaser clear color (#1b2e16). */
export const FARM_LETTERBOX_RGB = '27,46,22';

export const DEFAULT_VIEWPORT = { width: 390, height: 844 };
export const DESKTOP_VIEWPORT = { width: 2108, height: 1285 };

export function resolveViewport() {
  const raw = process.env.FARM_CAPTURE_VIEWPORT ?? 'mobile';
  if (raw === 'desktop') return DESKTOP_VIEWPORT;
  if (raw.includes('x')) {
    const [w, h] = raw.split('x').map((n) => parseInt(n, 10));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h };
    }
  }
  return DEFAULT_VIEWPORT;
}

export function withScreenshotQuery(path) {
  const url = new URL(path, 'http://local');
  url.searchParams.set('screenshot', '1');
  return `${url.pathname}${url.search}`;
}

export async function waitForFarmSceneBoot(page) {
  await page.waitForSelector('#game-container canvas', { timeout: 60_000 });
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true,
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForFunction(
    () => {
      const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
      return m != null && m.zoom >= 1.0;
    },
    undefined,
    { timeout: 60_000 }
  );
}

/**
 * Wait until farm scene, camera metrics, and WebGL buffer show real farm pixels.
 */
export async function waitForFarmCaptureReady(page, { requireSpawnLock = false, refocus = true } = {}) {
  await waitForFarmSceneBoot(page);
  if (refocus) {
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.refocusFarmCamera());
  }
  if (requireSpawnLock) {
    await page.waitForFunction(
      () => {
        const m = window.__FARMER_WORLD_TEST__?.getFarmCameraCenterMetrics();
        return (
          m != null &&
          Math.abs(m.spawnWorldErrorX) <= 0.5 &&
          Math.abs(m.spawnWorldErrorY) <= 0.5
        );
      },
      undefined,
      { timeout: 60_000 }
    );
  }
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmCanvasCaptureReady?.() === true,
    undefined,
    { timeout: 60_000 }
  );
  await page.waitForTimeout(400);
}

/** Sample WebGL pixels in-page (works once preserveDrawingBuffer is enabled). */
export async function sampleCanvasColors(page, sampleCount = 64) {
  return page.evaluate(
    ({ sampleCount, letterbox }) => {
      const canvas = document.querySelector('#game-container canvas');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return null;
      const counts = new Map();
      let letterboxHits = 0;
      for (let i = 0; i < sampleCount; i++) {
        const x = Math.floor(((i * 17) % 97) / 97 * (canvas.width - 1));
        const y = Math.floor(((i * 31) % 89) / 89 * (canvas.height - 1));
        const buf = new Uint8Array(4);
        gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const key = `${buf[0]},${buf[1]},${buf[2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (key === letterbox) letterboxHits++;
      }
      let dominant = '';
      let dominantCount = 0;
      for (const [k, v] of counts) {
        if (v > dominantCount) {
          dominantCount = v;
          dominant = k;
        }
      }
      return {
        width: canvas.width,
        height: canvas.height,
        preserveDrawingBuffer: gl.getContextAttributes()?.preserveDrawingBuffer === true,
        uniqueColors: counts.size,
        dominantColorRgb: dominant,
        dominantPct: (dominantCount / sampleCount) * 100,
        letterboxPct: (letterboxHits / sampleCount) * 100,
      };
    },
    { sampleCount, letterbox: FARM_LETTERBOX_RGB }
  );
}

export async function assertCanvasHasFarmContent(page) {
  const stats = await sampleCanvasColors(page);
  if (!stats) {
    throw new Error('Farm canvas/WebGL not available for capture validation');
  }
  if (!stats.preserveDrawingBuffer) {
    throw new Error(
      'WebGL preserveDrawingBuffer is false — add ?screenshot=1 to the capture URL'
    );
  }
  if (stats.uniqueColors < 6) {
    throw new Error(
      `Canvas looks empty (${stats.uniqueColors} unique sample colors); farm did not render`
    );
  }
  if (stats.dominantPct >= 95 || stats.letterboxPct >= 95) {
    throw new Error(
      `Canvas is >95% solid letterbox (${stats.dominantColorRgb} @ ${stats.dominantPct.toFixed(1)}%)`
    );
  }
  return stats;
}

/**
 * Validate written PNG by re-sampling file bytes (fallback if GL read fails post-shot).
 * Uses a lightweight scan without extra deps: read IHDR + IDAT is heavy; skip if no pngjs.
 */
export async function assertPngNotSolidLetterbox(pngPath, { maxDominantPct = 95 } = {}) {
  try {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(readFileSync(pngPath));
    const step = Math.max(1, Math.floor(Math.min(png.width, png.height) / 48));
    const counts = new Map();
    let total = 0;
    for (let y = 0; y < png.height; y += step) {
      for (let x = 0; x < png.width; x += step) {
        const i = (png.width * y + x) << 2;
        const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        total++;
      }
    }
    let max = 0;
    let dom = '';
    for (const [k, v] of counts) {
      if (v > max) {
        max = v;
        dom = k;
      }
    }
    const pct = (max / total) * 100;
    if (pct >= maxDominantPct) {
      throw new Error(
        `PNG ${pngPath} is ${pct.toFixed(1)}% single color (${dom}) — not a valid farm capture`
      );
    }
    return { dominantPct: pct, dominantColorRgb: dom, uniqueColors: counts.size };
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw e;
  }
}

/**
 * Playwright `canvas.screenshot()` often returns a tiny solid letterbox on mobile
 * viewports even with `preserveDrawingBuffer`; `toDataURL` matches WebGL readbacks.
 */
export async function captureFarmCanvas(page, outPng) {
  await assertCanvasHasFarmContent(page);
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas');
    if (!canvas) throw new Error('Missing game canvas');
    return canvas.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  writeFileSync(outPng, Buffer.from(base64, 'base64'));
  const pngStats = await assertPngNotSolidLetterbox(outPng);
  return pngStats;
}

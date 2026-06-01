import { expect, test } from '@playwright/test';
import {
  TOOL_MODAL_ART_H,
  TOOL_MODAL_ART_W,
  TOOL_MODAL_PANEL_MAX_WIDTH_PX,
  toolModalPanelSize,
  toolModalScaledLayout,
  TOOL_MODAL_VISUAL_SCALE,
} from '../../src/ui/toolModalLayout';

const TOLERANCE_PX = 2;

interface CropSelectPopupLayoutMetrics {
  panelLeft: number;
  panelTop: number;
  panelW: number;
  panelH: number;
  bgW: number;
  bgH: number;
  slotGridLeft: number;
  slotGridTop: number;
  slotGridW: number;
  slotGridH: number;
  iconY: number;
  seedCount: number;
}

function assertLayoutAligned(
  layout: CropSelectPopupLayoutMetrics,
  viewportW: number,
  viewportH: number
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_PX;

  const gridRight = layout.slotGridLeft + layout.slotGridW;
  const gridBottom = layout.slotGridTop + layout.slotGridH;
  const panelRight = layout.panelLeft + layout.panelW;
  const panelBottom = layout.panelTop + layout.panelH;

  if (layout.slotGridLeft < layout.panelLeft - TOLERANCE_PX) {
    errors.push('slot grid overflows left of panel');
  }
  if (layout.slotGridTop < layout.panelTop - TOLERANCE_PX) {
    errors.push('slot grid overflows top of panel');
  }
  if (gridRight > panelRight + TOLERANCE_PX) {
    errors.push('slot grid overflows right of panel');
  }
  if (gridBottom > panelBottom + TOLERANCE_PX) {
    errors.push('slot grid overflows bottom of panel');
  }

  const iconRowCenter = layout.slotGridTop + layout.slotGridH / 2;
  if (!near(layout.iconY, iconRowCenter)) {
    errors.push(`iconY ${layout.iconY} != slot row center ${iconRowCenter}`);
  }

  const expected = toolModalPanelSize(viewportW, viewportH);
  if (!near(layout.panelW, expected.panelW)) {
    errors.push(`panel width ${layout.panelW} != expected ${expected.panelW}`);
  }
  if (!near(layout.panelH, expected.panelH)) {
    errors.push(`panel height ${layout.panelH} != expected ${expected.panelH}`);
  }

  if (!near(layout.bgW, layout.panelW)) {
    errors.push(`bg width ${layout.bgW} != panel width ${layout.panelW}`);
  }
  if (!near(layout.bgH, layout.panelH)) {
    errors.push(`bg height ${layout.bgH} != panel height ${layout.panelH}`);
  }

  const scaled = toolModalScaledLayout(expected.scale);
  const paddedW = scaled.slotBandOuterW - scaled.slotBandPaddingPx * 2;
  const paddedH = scaled.slotBandOuterH - scaled.slotBandPaddingPx * 2;
  if (!near(layout.slotGridW, paddedW)) {
    errors.push(`slot grid width ${layout.slotGridW} != expected ${paddedW}`);
  }
  if (!near(layout.slotGridH, paddedH)) {
    errors.push(`slot grid height ${layout.slotGridH} != expected ${paddedH}`);
  }

  if (layout.seedCount !== 5) {
    errors.push(`expected 5 seed slots, got ${layout.seedCount}`);
  }

  return { ok: errors.length === 0, errors };
}

async function waitForGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#game-container canvas', { timeout: 30_000 });
  await page.waitForFunction(
    () => typeof window.__FARMER_WORLD_TEST__ !== 'undefined',
    undefined,
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    () => window.__FARMER_WORLD_TEST__?.isFarmSceneReady() === true,
    undefined,
    { timeout: 30_000 }
  );
}

test.describe('Crop select popup layout', () => {
  test('tool modal art dimensions unchanged', () => {
    expect(TOOL_MODAL_ART_W).toBe(1370);
    expect(TOOL_MODAL_ART_H).toBe(686);
  });

  test('five seed slots align inside tool-modal panel', async ({ page }) => {
    await waitForGame(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openCropSelectPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isCropSelectPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getCropSelectPopupLayout()
    );
    expect(layout).not.toBeNull();

    const viewport = page.viewportSize()!;
    const check = assertLayoutAligned(layout!, viewport.width, viewport.height);
    expect(check.ok, check.errors.join('; ')).toBe(true);
  });

  test('backdrop dismiss closes popup', async ({ page }) => {
    await waitForGame(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openCropSelectPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isCropSelectPopupOpen()))
      .toBe(true);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeCropSelectPopup());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isCropSelectPopupOpen()))
      .toBe(false);
  });
});

test.describe('Crop select popup — phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('visual scale matches panel × TOOL_MODAL_VISUAL_SCALE', async ({ page }) => {
    await waitForGame(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openCropSelectPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isCropSelectPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getCropSelectPopupLayout()
    );
    const visual = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getCropSelectPopupVisual()
    );
    expect(layout).not.toBeNull();
    expect(visual).not.toBeNull();
    expect(layout!.panelW).toBe(156);
    expect(layout!.panelH).toBe(34);
    expect(visual!.textureW).toBe(0);
    expect(visual!.textureH).toBe(0);
    expect(visual!.cropW).toBe(0);
    expect(visual!.cropH).toBe(0);
    expect(visual!.containerScaleX).toBeCloseTo(TOOL_MODAL_VISUAL_SCALE, 3);
    expect(visual!.bgBoundsW).toBeCloseTo(layout!.panelW * TOOL_MODAL_VISUAL_SCALE, 1);
    expect(visual!.bgBoundsH).toBeCloseTo(layout!.panelH * TOOL_MODAL_VISUAL_SCALE, 1);
  });
});

test.describe('Crop select popup — laptop viewport', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('uses capped panel width on large screens', async ({ page }) => {
    await waitForGame(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openCropSelectPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isCropSelectPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getCropSelectPopupLayout()
    );
    const visual = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getCropSelectPopupVisual()
    );
    expect(layout).not.toBeNull();
    expect(visual).not.toBeNull();
    expect(layout!.panelW).toBe(TOOL_MODAL_PANEL_MAX_WIDTH_PX);
    expect(visual!.textureW).toBe(0);
    expect(visual!.cropW).toBe(0);
    expect(visual!.bgBoundsW).toBeCloseTo(layout!.panelW * TOOL_MODAL_VISUAL_SCALE, 1);
  });
});

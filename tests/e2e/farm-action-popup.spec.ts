import { expect, test } from '@playwright/test';
import {
  TOOL_MODAL_ART_H,
  TOOL_MODAL_ART_W,
  TOOL_MODAL_FRAME_HEIGHT_PX,
  TOOL_MODAL_FRAME_WIDTH_PX,
  TOOL_MODAL_FRAME_COMPACT_HEIGHT_PX,
  toolModalFrameFullCrop,
  toolModalTextureCrop,
  TOOL_MODAL_ICON_DISPLAY_SIZE_REF_PX,
  TOOL_MODAL_ICON_GAP_REF_PX,
  TOOL_MODAL_ICON_HIT_SIZE_REF_PX,
  TOOL_MODAL_ICON_LAYOUT_SCALE_BIAS,
  TOOL_MODAL_LAYOUT_REF_WIDTH_PX,
  TOOL_MODAL_PANEL_DISPLAY_ASPECT,
  TOOL_MODAL_PANEL_MAX_VIEWPORT_HEIGHT_FRAC,
  TOOL_MODAL_PANEL_MAX_WIDTH_PX,
  TOOL_MODAL_PANEL_MIN_WIDTH_PX,
  TOOL_MODAL_PANEL_SHIFT_Y_REF_PX,
  TOOL_MODAL_PANEL_WIDTH_FRAC,
  TOOL_MODAL_SLOT_BAND_EXTRA_HEIGHT_REF_PX,
  TOOL_MODAL_SLOT_BAND_EXTRA_WIDTH_REF_PX,
  TOOL_MODAL_SLOT_BAND_HEIGHT_SHRINK_REF_PX,
  TOOL_MODAL_SLOT_BAND_OUTER_H_REF_PX,
  TOOL_MODAL_SLOT_BAND_OUTER_W_REF_PX,
  TOOL_MODAL_SLOT_BAND_PADDING_REF_PX,
  TOOL_MODAL_SLOT_COLS_TIGHTEN_REF_PX,
  TOOL_MODAL_SLOT_PER_COL_WIDTH_SHRINK_REF_PX,
  toolModalPanelSize,
  toolModalScaledLayout,
  TOOL_MODAL_VISUAL_SCALE,
} from '../../src/ui/toolModalLayout';

const TOLERANCE_PX = 2;

interface FarmActionPopupLayoutMetrics {
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
}

function assertLayoutAligned(
  layout: FarmActionPopupLayoutMetrics,
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

test.describe('Farm action popup layout', () => {
  test('persistent top ToolBar is not shown during normal play', async ({ page }) => {
    await waitForGame(page);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isToolBarVisible()))
      .toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openFarmActionPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isFarmActionPopupOpen()))
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isToolBarVisible()))
      .toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeFarmActionPopup());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isFarmActionPopupOpen()))
      .toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isToolBarVisible()))
      .toBe(false);
  });

  test('icons align to slot grid inside logical panel', async ({ page }) => {
    await waitForGame(page);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openFarmActionPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isFarmActionPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmActionPopupLayout()
    );
    expect(layout).not.toBeNull();

    const viewport = page.viewportSize()!;
    const check = assertLayoutAligned(layout!, viewport.width, viewport.height);
    expect(check.ok, check.errors.join('; ')).toBe(true);
  });

  test('texture crop uses full PNG; inner frame crop stays in bounds', () => {
    expect(TOOL_MODAL_ART_W).toBe(1370);
    expect(TOOL_MODAL_ART_H).toBe(686);
    const textureCrop = toolModalTextureCrop();
    expect(textureCrop).toEqual({ x: 0, y: 0, width: 1370, height: 686 });
    const innerCrop = toolModalFrameFullCrop();
    expect(innerCrop.x + innerCrop.width).toBeLessThanOrEqual(TOOL_MODAL_ART_W);
    expect(innerCrop.y + innerCrop.height).toBeLessThanOrEqual(TOOL_MODAL_ART_H);
    expect(TOOL_MODAL_FRAME_WIDTH_PX).toBeGreaterThan(1100);
    expect(TOOL_MODAL_FRAME_HEIGHT_PX).toBeGreaterThan(400);
    expect(TOOL_MODAL_FRAME_COMPACT_HEIGHT_PX).toBeLessThan(TOOL_MODAL_FRAME_HEIGHT_PX);
  });

  test('panel layout uses viewport fractions', () => {
    expect(TOOL_MODAL_PANEL_WIDTH_FRAC).toBeGreaterThanOrEqual(0.398);
    expect(TOOL_MODAL_PANEL_WIDTH_FRAC).toBeLessThanOrEqual(0.402);
    expect(TOOL_MODAL_PANEL_MAX_VIEWPORT_HEIGHT_FRAC).toBe(0.14);
    expect(TOOL_MODAL_PANEL_DISPLAY_ASPECT).toBe(0.22);
    expect(TOOL_MODAL_PANEL_MAX_WIDTH_PX).toBe(320);
    expect(TOOL_MODAL_PANEL_MIN_WIDTH_PX).toBe(148);
    expect(TOOL_MODAL_LAYOUT_REF_WIDTH_PX).toBe(250);
    expect(TOOL_MODAL_PANEL_SHIFT_Y_REF_PX).toBe(-10);
    expect(TOOL_MODAL_ICON_LAYOUT_SCALE_BIAS).toBeCloseTo(0.92, 2);
    expect(TOOL_MODAL_ICON_GAP_REF_PX).toBe(4);
    expect(TOOL_MODAL_SLOT_COLS_TIGHTEN_REF_PX).toBe(4);
    expect(TOOL_MODAL_SLOT_PER_COL_WIDTH_SHRINK_REF_PX).toBe(20);
    expect(TOOL_MODAL_SLOT_BAND_HEIGHT_SHRINK_REF_PX).toBe(20);
    expect(TOOL_MODAL_SLOT_BAND_EXTRA_WIDTH_REF_PX).toBe(20);
    expect(TOOL_MODAL_SLOT_BAND_EXTRA_HEIGHT_REF_PX).toBe(5);
    expect(TOOL_MODAL_SLOT_BAND_PADDING_REF_PX).toBe(10);
    expect(TOOL_MODAL_SLOT_BAND_OUTER_W_REF_PX).toBe(160);
    expect(TOOL_MODAL_SLOT_BAND_OUTER_H_REF_PX).toBe(44);
    expect(TOOL_MODAL_ICON_HIT_SIZE_REF_PX).toBe(26);
    expect(TOOL_MODAL_ICON_DISPLAY_SIZE_REF_PX).toBe(20);
    expect(TOOL_MODAL_VISUAL_SCALE).toBeCloseTo(0.75, 2);
  });

  test('example panel sizes at phone and laptop viewports', () => {
    const phone = toolModalPanelSize(390, 844);
    expect(phone.panelW).toBe(156);
    expect(phone.panelH).toBe(34);
    expect(phone.panelW / 390).toBeCloseTo(TOOL_MODAL_PANEL_WIDTH_FRAC, 2);
    expect(phone.panelH / phone.panelW).toBeCloseTo(TOOL_MODAL_PANEL_DISPLAY_ASPECT, 2);

    const laptop720 = toolModalPanelSize(1280, 720);
    expect(laptop720.panelW).toBe(TOOL_MODAL_PANEL_MAX_WIDTH_PX);
    expect(laptop720.panelH).toBe(70);
    expect(laptop720.panelH / laptop720.panelW).toBeCloseTo(TOOL_MODAL_PANEL_DISPLAY_ASPECT, 2);

    const laptop1080 = toolModalPanelSize(1920, 1080);
    expect(laptop1080.panelW).toBe(TOOL_MODAL_PANEL_MAX_WIDTH_PX);
    expect(laptop1080.panelH).toBe(70);
    expect(laptop1080.panelH / laptop1080.panelW).toBeCloseTo(TOOL_MODAL_PANEL_DISPLAY_ASPECT, 2);
  });
});

test.describe('Farm action popup — phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('layout matches 390×844 panel size', async ({ page }) => {
    await waitForGame(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openFarmActionPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isFarmActionPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmActionPopupLayout()
    );
    expect(layout).not.toBeNull();
    expect(layout!.panelW).toBe(156);
    expect(layout!.panelH).toBe(34);
    expect(layout!.bgW).toBe(layout!.panelW);
    expect(layout!.bgH).toBe(layout!.panelH);

    const visual = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmActionPopupVisual()
    );
    expect(visual).not.toBeNull();
    expect(visual!.textureW).toBe(1370);
    expect(visual!.textureH).toBe(686);
    expect(visual!.cropX).toBe(0);
    expect(visual!.cropY).toBe(0);
    expect(visual!.cropW).toBe(1370);
    expect(visual!.cropH).toBe(686);
    expect(visual!.containerScaleX).toBeCloseTo(TOOL_MODAL_VISUAL_SCALE, 3);
    expect(visual!.bgBoundsW).toBeCloseTo(layout!.panelW * TOOL_MODAL_VISUAL_SCALE, 1);
    expect(visual!.bgBoundsH).toBeCloseTo(layout!.panelH * TOOL_MODAL_VISUAL_SCALE, 1);
    expect(visual!.bgBoundsW / visual!.viewportW).toBeCloseTo(
      (layout!.panelW * TOOL_MODAL_VISUAL_SCALE) / 390,
      2
    );
  });
});

test.describe('Farm action popup — laptop viewport', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('visual scale matches panel × TOOL_MODAL_VISUAL_SCALE', async ({ page }) => {
    await waitForGame(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.openFarmActionPopup(7, 9));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isFarmActionPopupOpen()))
      .toBe(true);

    const layout = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmActionPopupLayout()
    );
    const visual = await page.evaluate(() =>
      window.__FARMER_WORLD_TEST__?.getFarmActionPopupVisual()
    );
    expect(layout).not.toBeNull();
    expect(visual).not.toBeNull();
    expect(layout!.panelW).toBe(TOOL_MODAL_PANEL_MAX_WIDTH_PX);
    expect(layout!.panelH).toBe(70);
    expect(visual!.textureW).toBe(1370);
    expect(visual!.cropW).toBe(1370);
    expect(visual!.cropH).toBe(686);
    expect(visual!.bgBoundsW).toBeCloseTo(layout!.panelW * TOOL_MODAL_VISUAL_SCALE, 1);
    expect(visual!.bgBoundsW / visual!.viewportW).toBeCloseTo(
      (layout!.panelW * TOOL_MODAL_VISUAL_SCALE) / 1280,
      2
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeBottomMenuLayout,
  computeLeftMenuLayout,
  computeRightMenuLayout,
  HUD_BAG_BOTTOM_VH_FRAC,
  HUD_BAG_ICON_SIZE_MULTIPLIER,
  HUD_BAG_LEFT_VW_FRAC,
  HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER,
  HUD_RIGHT_MENU_RIGHT_VW_FRAC,
  hudRightLandBuildIconWidthPx,
  hudRightShopIconWidthPx,
  hudSpan,
} from '../../src/ui/hudLayout';

const BOTTOM_NAV_ICON_SIZE_ART = 48;
import { setHudSafeAreaInsets } from '../../src/safeArea';

describe('computeLeftMenuLayout', () => {
  it('places bag left edge at 3% viewport width with no safe area', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const layout = computeLeftMenuLayout(viewW, viewH);
    const baseSize = hudSpan(BOTTOM_NAV_ICON_SIZE_ART, viewW, viewH);
    const expectedSize = Math.round(baseSize * HUD_BAG_ICON_SIZE_MULTIPLIER);

    expect(layout.iconSize).toBe(expectedSize);
    expect(layout.iconCenterX - layout.iconSize / 2).toBeCloseTo(
      viewW * HUD_BAG_LEFT_VW_FRAC,
      0
    );
  });

  it('adds safe-area left inset to bag position', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 24 });
    const viewW = 800;
    const viewH = 600;
    const layout = computeLeftMenuLayout(viewW, viewH);

    expect(layout.iconCenterX - layout.iconSize / 2).toBeCloseTo(
      viewW * HUD_BAG_LEFT_VW_FRAC + 24,
      0
    );
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('scales bag icon by HUD_BAG_ICON_SIZE_MULTIPLIER vs baseline bottom-nav art size', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const baseSize = hudSpan(BOTTOM_NAV_ICON_SIZE_ART, viewW, viewH);
    const layout = computeLeftMenuLayout(viewW, viewH);

    expect(layout.iconSize).toBe(Math.round(baseSize * HUD_BAG_ICON_SIZE_MULTIPLIER));
  });

  it('places bag bottom edge at 3% viewport height with no safe area', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const layout = computeLeftMenuLayout(viewW, viewH);

    expect(layout.iconCenterY + layout.iconSize / 2).toBeCloseTo(
      viewH * (1 - HUD_BAG_BOTTOM_VH_FRAC),
      0
    );
  });

  it('adds safe-area bottom inset to bag position', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 20, left: 0 });
    const viewW = 800;
    const viewH = 600;
    const layout = computeLeftMenuLayout(viewW, viewH);

    expect(layout.iconCenterY + layout.iconSize / 2).toBeCloseTo(
      viewH - viewH * HUD_BAG_BOTTOM_VH_FRAC - 20,
      0
    );
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('computeRightMenuLayout', () => {
  it('places rightmost icon right edge at 3% viewport width with no safe area', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const layout = computeRightMenuLayout(viewW, viewH);
    const shopIndex = layout.iconSizes.length - 1;
    const shopSize = layout.iconSizes[shopIndex] ?? 0;
    const shopCenterX = layout.iconCenterXs[shopIndex] ?? 0;

    expect(shopCenterX + shopSize / 2).toBeCloseTo(
      viewW * (1 - HUD_RIGHT_MENU_RIGHT_VW_FRAC),
      0
    );
  });

  it('adds safe-area right inset to right menu position', () => {
    setHudSafeAreaInsets({ top: 0, right: 24, bottom: 0, left: 0 });
    const viewW = 800;
    const viewH = 600;
    const layout = computeRightMenuLayout(viewW, viewH);
    const shopIndex = layout.iconSizes.length - 1;
    const shopSize = layout.iconSizes[shopIndex] ?? 0;
    const shopCenterX = layout.iconCenterXs[shopIndex] ?? 0;

    expect(shopCenterX + shopSize / 2).toBeCloseTo(
      viewW * (1 - HUD_RIGHT_MENU_RIGHT_VW_FRAC) - 24,
      0
    );
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('aligns all icon right edges to the same inset column', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const layout = computeRightMenuLayout(viewW, viewH);
    const expectedRightEdge = viewW * (1 - HUD_RIGHT_MENU_RIGHT_VW_FRAC);

    layout.iconSizes.forEach((size, i) => {
      const centerX = layout.iconCenterXs[i] ?? 0;
      expect(centerX + size / 2).toBeCloseTo(expectedRightEdge, 0);
    });
  });

  it('places shop icon bottom edge at 3% viewport height with no safe area', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const layout = computeRightMenuLayout(viewW, viewH);
    const shopIndex = layout.iconSizes.length - 1;
    const shopSize = layout.iconSizes[shopIndex] ?? 0;
    const shopCenterY = layout.iconCenterY[shopIndex] ?? 0;

    expect(shopCenterY + shopSize / 2).toBeCloseTo(
      viewH * (1 - HUD_BAG_BOTTOM_VH_FRAC),
      0
    );
  });

  it('adds safe-area bottom inset to right menu position', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 20, left: 0 });
    const viewW = 800;
    const viewH = 600;
    const layout = computeRightMenuLayout(viewW, viewH);
    const shopIndex = layout.iconSizes.length - 1;
    const shopSize = layout.iconSizes[shopIndex] ?? 0;
    const shopCenterY = layout.iconCenterY[shopIndex] ?? 0;

    expect(shopCenterY + shopSize / 2).toBeCloseTo(
      viewH - viewH * HUD_BAG_BOTTOM_VH_FRAC - 20,
      0
    );
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('uses 15%-reduced right menu icon scale (1.105)', () => {
    expect(HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER).toBe(1.105);
  });

  it('scales right menu icons by HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const layout = computeRightMenuLayout(viewW, viewH);
    const expectedLandBuild = Math.round(
      hudRightLandBuildIconWidthPx(viewW) * HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER
    );
    const expectedShop = Math.round(
      hudRightShopIconWidthPx(viewW) * HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER
    );

    expect(layout.iconSizes[0]).toBe(expectedLandBuild);
    expect(layout.iconSizes[1]).toBe(expectedLandBuild);
    expect(layout.iconSizes[2]).toBe(expectedShop);
  });
});

describe('computeBottomMenuLayout', () => {
  it('extends band height to include left bag without placing bag in bottom row', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const left = computeLeftMenuLayout(viewW, viewH);
    const bottom = computeBottomMenuLayout(viewW, viewH);

    expect(bottom.bandHeight).toBeGreaterThanOrEqual(
      viewH - (left.iconCenterY - left.iconSize / 2)
    );
    expect(bottom.bandHeight).toBeGreaterThan(0);
  });

  it('scales bottom band height with viewport size', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const small = computeBottomMenuLayout(390, 844);
    const large = computeBottomMenuLayout(1920, 1080);

    expect(large.bandHeight).toBeGreaterThan(small.bandHeight);
  });
});

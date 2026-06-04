import { describe, expect, it } from 'vitest';
import {
  computeBottomMenuLayout,
  computeLeftMenuLayout,
  FARM_MAP_TOP_INSET_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET,
  FARM_MAP_LEFT_PAN_BOUNDS_COL_COUNT,
  FARM_MAP_LEFT_PAN_BOUNDS_COL_INDEX,
  FARM_MAP_LEFT_PAN_BOUNDS_COL_OFFSET,
  FARM_MAP_LEFT_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenY,
  getFarmMapTopTargetScreenYFromPanBounds,
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  FARM_VISUAL_CENTER_OFFSET_X_FRAC,
  FARM_VISUAL_CENTER_OFFSET_Y_FRAC,
  computePlayableFarmViewportLayout,
  getFarmCameraScreenCenter,
  getFarmPanBoundsScrollTargetScreen,
  getPlayableBandPanBoundsCenter,
  computeRightMenuLayout,
  computeTopHudSlots,
  leftHudBandWidth,
  rightHudBandWidth,
  topHudBandHeight,
  bottomHudBandHeight,
  TOP_SLOT_VALUE_FONT_WIDTH_FRAC,
  TOP_SLOT_VW_FRAC,
  topSlotValueFontSizePx,
  HUD_BAG_BOTTOM_VH_FRAC,
  HUD_BAG_LEFT_VW_FRAC,
  HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER,
  HUD_RIGHT_MENU_RIGHT_VW_FRAC,
  hudBagIconSizePx,
  hudRightLandBuildIconWidthPx,
  hudRightShopIconDisplaySizePx,
  hudRightShopIconWidthPx,
} from '../../src/ui/hudLayout';
import { setHudSafeAreaInsets } from '../../src/safeArea';

describe('computeTopHudSlots', () => {
  it('sets value font size to 5% of slot width', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(TOP_SLOT_VALUE_FONT_WIDTH_FRAC).toBe(0.05);

    const laptopW = 1920;
    const slotW = Math.max(1, Math.floor(laptopW * TOP_SLOT_VW_FRAC));
    expect(topSlotValueFontSizePx(laptopW)).toBe(
      Math.round(slotW * TOP_SLOT_VALUE_FONT_WIDTH_FRAC)
    );
    expect(computeTopHudSlots(laptopW, 1080).fontSizePx).toBe(
      `${topSlotValueFontSizePx(laptopW)}px`
    );

    const phoneW = 390;
    const phoneSlotW = Math.max(1, Math.floor(phoneW * TOP_SLOT_VW_FRAC));
    expect(topSlotValueFontSizePx(phoneW)).toBe(
      Math.round(phoneSlotW * TOP_SLOT_VALUE_FONT_WIDTH_FRAC)
    );
    expect(computeTopHudSlots(phoneW, 844).fontSizePx).toBe('5px');
  });
});

describe('computeLeftMenuLayout', () => {
  it('places bag left edge at 1.5% viewport width with no safe area', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const layout = computeLeftMenuLayout(viewW, viewH);
    const expectedSize = hudBagIconSizePx(viewW, viewH);

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

  it('matches right bar shop icon display size on phone', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const layout = computeLeftMenuLayout(viewW, viewH);
    const right = computeRightMenuLayout(viewW, viewH);
    const shopIndex = right.iconSizes.length - 1;
    const shopSize = right.iconSizes[shopIndex] ?? 0;

    expect(layout.iconSize).toBe(hudBagIconSizePx(viewW, viewH));
    expect(layout.iconSize).toBe(shopSize);
    expect(layout.iconSize).toBe(hudRightShopIconDisplaySizePx(viewW));
  });

  it('matches right bar shop icon display size on laptop reference viewport', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 1920;
    const viewH = 1080;
    const right = computeRightMenuLayout(viewW, viewH);
    const shopIndex = right.iconSizes.length - 1;
    const shopSize = right.iconSizes[shopIndex] ?? 0;

    expect(hudBagIconSizePx(viewW, viewH)).toBe(shopSize);
    expect(hudBagIconSizePx(viewW, viewH)).toBe(
      Math.round(hudRightShopIconWidthPx(viewW) * HUD_RIGHT_MENU_ICON_SIZE_MULTIPLIER)
    );
  });

  it('places bag bottom edge at 1.5% viewport height with no safe area', () => {
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
  it('places rightmost icon right edge at 1.5% viewport width with no safe area', () => {
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

  it('places shop icon bottom edge at 1.5% viewport height with no safe area', () => {
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
    const expectedShop = hudRightShopIconDisplaySizePx(viewW);

    expect(layout.iconSizes[0]).toBe(expectedLandBuild);
    expect(layout.iconSizes[1]).toBe(expectedLandBuild);
    expect(layout.iconSizes[2]).toBe(expectedShop);
  });
});

describe('map top inset', () => {
  it('targets map top 50% above playable band top when inset is -0.5', () => {
    expect(FARM_MAP_TOP_INSET_FRAC).toBe(-0.5);
    expect(getFarmMapTopTargetScreenY(68, 692)).toBeCloseTo(68 + 692 * -0.5, 5);
    expect(getFarmMapTopTargetScreenY(68, 692, 0)).toBe(68);
  });

  it('maps row 7 (1-based) to 6/20 pan-bounds height', () => {
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX).toBe(7);
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET).toBe(6);
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT).toBe(20);
    expect(FARM_MAP_TOP_PAN_BOUNDS_FRAC).toBe(0.3);
    const pan = { minY: 100, maxY: 500 };
    const scrollY = 40;
    const zoom = 1.7;
    const target = getFarmMapTopTargetScreenYFromPanBounds(pan, scrollY, zoom);
    const panTopScreen = (pan.minY - scrollY) * zoom;
    const panHeightScreen = (pan.maxY - pan.minY) * zoom;
    expect(target).toBeCloseTo(panTopScreen + panHeightScreen * (6 / 20), 5);
  });

  it('maps column 8 (1-based) to 7/20 pan-bounds width', () => {
    expect(FARM_MAP_LEFT_PAN_BOUNDS_COL_INDEX).toBe(8);
    expect(FARM_MAP_LEFT_PAN_BOUNDS_COL_OFFSET).toBe(7);
    expect(FARM_MAP_LEFT_PAN_BOUNDS_COL_COUNT).toBe(20);
    expect(FARM_MAP_LEFT_PAN_BOUNDS_FRAC).toBe(0.35);
  });
});

describe('pan bounds center offset', () => {
  it('maps 0.5 offset to viewport camera center (not playable geometric center)', () => {
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC).toBe(0.5);
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC).toBe(0.5);
    const viewW = 390;
    const viewH = 844;
    const playable = {
      playableLeft: 80,
      playableTop: 68,
      playableRight: 368,
      playableBottom: 760,
    };
    const geomX = (playable.playableLeft + playable.playableRight) / 2;
    const geomY = (playable.playableTop + playable.playableBottom) / 2;
    const band = getPlayableBandPanBoundsCenter(playable);
    const pan = getFarmPanBoundsScrollTargetScreen(viewW, viewH, playable);
    const camera = getFarmCameraScreenCenter(viewW, viewH);
    expect(band.x).toBeCloseTo(geomX, 5);
    expect(band.y).toBeCloseTo(geomY, 5);
    expect(pan.x).toBeCloseTo(camera.x, 5);
    expect(pan.y).toBeCloseTo(camera.y, 5);
    expect(pan.y).toBeGreaterThan(geomY);
  });
});

describe('computePlayableFarmViewportLayout', () => {
  it('applies visual center offset on top of geometric playable center', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    const viewW = 390;
    const viewH = 844;
    const layout = computePlayableFarmViewportLayout(viewW, viewH);
    const playableW = layout.playableRight - layout.playableLeft;
    const playableH = layout.playableBottom - layout.playableTop;
    const geomCenterX = (layout.playableLeft + layout.playableRight) / 2;
    const geomCenterY = (layout.playableTop + layout.playableBottom) / 2;

    expect(layout.centerX).toBeCloseTo(
      geomCenterX + playableW * FARM_VISUAL_CENTER_OFFSET_X_FRAC,
      5
    );
    expect(layout.centerY).toBeCloseTo(
      geomCenterY + playableH * FARM_VISUAL_CENTER_OFFSET_Y_FRAC,
      5
    );
    expect(layout.centerX).toBeGreaterThan(geomCenterX);
    expect(layout.centerY).toBeLessThan(viewH / 2);
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

import { describe, expect, it } from 'vitest';
import {
  clampScrollToFarmPlayable,
  clampScrollSoFootprintOverlapsViewport,
  computeCenteredFarmCameraScroll,
  mergeFarmCameraScrollWithOversizeCenter,
  computeFarmCameraScrollForMapTopAndPanCenter,
  computeFarmCameraScrollLimits,
  computeFarmPlayableScreenMargins,
  computeOversizeFarmPanBottomScrollY,
  farmFootprintCenter,
  type FarmFootprintBounds,
} from '../../src/farmCameraScroll';
import {
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX,
  FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET,
  getFarmMapTopTargetScreenY,
  getFarmMapTopTargetScreenYFromPanBounds,
  getFarmPanBoundsScrollTargetScreen,
  getPlayableBandPanBoundsCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';

const phoneViewW = 390;
const phoneViewH = 844;

const phonePlayable = {
  playableLeft: 10,
  playableTop: 68,
  playableRight: 300,
  playableBottom: 760,
};

/** Footprint-sized AABB similar to 390×844 layout (576×304 world px at zoom 1). */
const phoneFootprint: FarmFootprintBounds = {
  minX: 42,
  minY: 214,
  maxX: 618,
  maxY: 518,
};

describe('computeFarmCameraScrollLimits', () => {
  it('marks X oversize and Y in-band at zoom 1.7 on a phone-sized playable rect', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);
    expect(limits.x.minScroll).toBeLessThanOrEqual(limits.x.maxScroll);
    expect(limits.y.minScroll).toBeLessThanOrEqual(limits.y.maxScroll);
  });

  it('marks neither axis oversize when zoomed out enough to fit', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 0.4);
    expect(limits.x.oversize).toBe(false);
    expect(limits.y.oversize).toBe(false);
  });

  it('orders min/max scroll so clamp uses a non-inverted interval when X oversize', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeCloseTo(
      phoneFootprint.maxX -
        phonePlayable.playableRight / 1.7 -
        (phoneFootprint.minX - phonePlayable.playableLeft / 1.7),
      5
    );
    expect(limits.x.maxScroll).toBeGreaterThan(limits.x.minScroll);
  });
});

describe('clampScrollToFarmPlayable', () => {
  const zoomLevels = [1.2, 1.5, 1.7, 2.0];

  it.each(zoomLevels)('preserves in-range pan at zoom %s', (zoom) => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, zoom);
    const inRangeX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const inRangeY = (limits.y.minScroll + limits.y.maxScroll) / 2;
    const after = clampScrollToFarmPlayable(inRangeX, inRangeY, limits);
    expect(after.scrollX).toBeCloseTo(inRangeX, 5);
    expect(after.scrollY).toBeCloseTo(inRangeY, 5);
  });

  it.each(zoomLevels)('clamps out-of-range pan to nearest edge at zoom %s', (zoom) => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, zoom);
    const low = clampScrollToFarmPlayable(
      limits.x.minScroll - 500,
      limits.y.minScroll - 500,
      limits
    );
    const high = clampScrollToFarmPlayable(
      limits.x.maxScroll + 500,
      limits.y.maxScroll + 500,
      limits
    );
    expect(low.scrollX).toBeCloseTo(
      limits.x.oversize ? limits.x.minScroll : limits.x.minScroll - 500,
      5
    );
    expect(low.scrollY).toBeCloseTo(
      limits.y.oversize ? limits.y.minScroll : limits.y.minScroll - 500,
      5
    );
    expect(high.scrollX).toBeCloseTo(
      limits.x.oversize ? limits.x.maxScroll : limits.x.maxScroll + 500,
      5
    );
    expect(high.scrollY).toBeCloseTo(
      limits.y.oversize ? limits.y.maxScroll : limits.y.maxScroll + 500,
      5
    );
  });

  it('clamps X to the nearest edge when oversize and scroll is outside limits', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    const low = clampScrollToFarmPlayable(-500, 128, limits);
    const high = clampScrollToFarmPlayable(500, 128, limits);
    expect(low.scrollX).toBeCloseTo(limits.x.minScroll, 5);
    expect(high.scrollX).toBeCloseTo(limits.x.maxScroll, 5);
    expect(low.scrollY).toBe(128);
    expect(high.scrollY).toBe(128);
  });

  it('keeps centered scroll inside the X interval after a small pan', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    const centeredX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const centered = clampScrollToFarmPlayable(centeredX, 128, limits);
    const nudged = clampScrollToFarmPlayable(centeredX + 15, 145, limits);
    expect(centered.scrollX).toBeCloseTo(centeredX, 5);
    expect(centered.scrollY).toBeCloseTo(128, 5);
    expect(nudged.scrollX).toBeCloseTo(centeredX + 15, 5);
    expect(nudged.scrollY).toBeCloseTo(145, 5);
  });

  it('keeps both axes unchanged when farm fits playable area on both axes', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 0.4);
    const before = { x: -321, y: 654 };
    const after = clampScrollToFarmPlayable(before.x, before.y, limits);
    expect(limits.x.oversize).toBe(false);
    expect(limits.y.oversize).toBe(false);
    expect(after.scrollX).toBe(before.x);
    expect(after.scrollY).toBe(before.y);
  });

  it('clamps only the oversize axis and preserves the fit axis', () => {
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, 1.7);
    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);

    const low = clampScrollToFarmPlayable(limits.x.minScroll - 300, 900, limits);
    const high = clampScrollToFarmPlayable(limits.x.maxScroll + 300, -200, limits);

    expect(low.scrollX).toBeCloseTo(limits.x.minScroll, 5);
    expect(high.scrollX).toBeCloseTo(limits.x.maxScroll, 5);
    expect(low.scrollY).toBe(900);
    expect(high.scrollY).toBe(-200);
  });
});

describe('computeCenteredFarmCameraScroll', () => {
  it('centers footprint AABB on target when X is oversize (ignores anchor offset)', () => {
    const zoom = 1.7;
    const limits = computeFarmCameraScrollLimits(phoneFootprint, phonePlayable, zoom);
    const targetCenter = {
      x: (phonePlayable.playableLeft + phonePlayable.playableRight) / 2,
      y: (phonePlayable.playableTop + phonePlayable.playableBottom) / 2,
    };
    const anchor = { x: 330, y: 366 };
    const boundsCenter = farmFootprintCenter(phoneFootprint);
    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      targetCenter,
      phoneFootprint,
      phonePlayable,
      zoom
    );

    expect(limits.x.oversize).toBe(true);
    expect(limits.y.oversize).toBe(false);
    const screenX = (boundsCenter.x - scroll.scrollX) * zoom;
    const screenY = (boundsCenter.y - scroll.scrollY) * zoom;
    expect(screenX).toBeCloseTo(targetCenter.x, 1);
    expect(screenY).toBeCloseTo(targetCenter.y, 1);
    const margins = computeFarmPlayableScreenMargins(
      phoneFootprint,
      phonePlayable,
      scroll.scrollX,
      scroll.scrollY,
      zoom
    );
    expect(Math.abs(margins.left - margins.right)).toBeLessThan(1);
  });

  it('places oversize scroll at limit midpoint when pan-bounds offset shifts the clamp band', () => {
    const zoom = 1.7;
    const scrollBand = shiftPlayableBandForPanBoundsCenter(
      phonePlayable,
      phoneViewW,
      phoneViewH
    );
    const targetCenter = getFarmPanBoundsScrollTargetScreen(
      phoneViewW,
      phoneViewH,
      phonePlayable
    );
    const anchor = farmFootprintCenter(phoneFootprint);
    const limits = computeFarmCameraScrollLimits(phoneFootprint, scrollBand, zoom);
    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      targetCenter,
      phoneFootprint,
      scrollBand,
      zoom
    );
    expect(limits.x.oversize).toBe(true);
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC).toBe(0.5);
    const midX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    expect(scroll.scrollX).toBeCloseTo(midX, 5);
  });

  it('mergeFarmCameraScrollWithOversizeCenter recenters X only when Y fits in band', () => {
    const zoom = 1.7;
    const scrollBand = shiftPlayableBandForPanBoundsCenter(
      phonePlayable,
      phoneViewW,
      phoneViewH
    );
    const panTarget = getFarmPanBoundsScrollTargetScreen(
      phoneViewW,
      phoneViewH,
      phonePlayable
    );
    const limits = computeFarmCameraScrollLimits(phoneFootprint, scrollBand, zoom);
    const drifted = { scrollX: limits.x.minScroll + 12, scrollY: 400 };
    const merged = mergeFarmCameraScrollWithOversizeCenter(
      drifted,
      phoneFootprint,
      scrollBand,
      panTarget,
      zoom
    );
    const midX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    expect(merged.scrollX).toBeCloseTo(midX, 5);
    expect(merged.scrollY).toBe(400);
  });

  it('uses anchor scroll when farm fits on both axes', () => {
    const zoom = 0.4;
    const targetCenter = { x: 155, y: 414 };
    const anchor = { x: 330, y: 366 };
    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      targetCenter,
      phoneFootprint,
      phonePlayable,
      zoom
    );
    expect(scroll.scrollX).toBeCloseTo(anchor.x - targetCenter.x / zoom, 5);
    expect(scroll.scrollY).toBeCloseTo(anchor.y - targetCenter.y / zoom, 5);
  });
});

describe('computeFarmCameraScrollForMapTopAndPanCenter', () => {
  it('keeps map top on screen target when map minY shifts (origin align)', () => {
    const zoom = 1.7;
    const scrollBand = shiftPlayableBandForPanBoundsCenter(
      phonePlayable,
      phoneViewW,
      phoneViewH
    );
    const panTarget = getFarmPanBoundsScrollTargetScreen(
      phoneViewW,
      phoneViewH,
      phonePlayable
    );
    const mapTopTarget = getFarmMapTopTargetScreenYFromPanBounds(
      phoneFootprint,
      0,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    const anchor = farmFootprintCenter(phoneFootprint);
    const mapMinY = 80;
    const scroll0 = computeFarmCameraScrollForMapTopAndPanCenter(
      mapMinY,
      anchor,
      phoneFootprint,
      scrollBand,
      mapTopTarget,
      panTarget,
      zoom
    );
    const screenTop0 = (mapMinY - scroll0.scrollY) * zoom;
    expect(screenTop0).toBeCloseTo(mapTopTarget, 1);

    const mapMinYRaised = mapMinY - 120;
    const scroll1 = computeFarmCameraScrollForMapTopAndPanCenter(
      mapMinYRaised,
      anchor,
      phoneFootprint,
      scrollBand,
      mapTopTarget,
      panTarget,
      zoom
    );
    const screenTop1 = (mapMinYRaised - scroll1.scrollY) * zoom;
    expect(screenTop1).toBeCloseTo(mapTopTarget, 1);
    expect(scroll1.scrollY).toBeCloseTo(scroll0.scrollY - 120, 1);
  });

  it('centers pan on target when Y is oversize (map top via align, not bottom pin)', () => {
    const zoom = 1.7;
    const tallFootprint: FarmFootprintBounds = { ...phoneFootprint, minY: 100, maxY: 550 };
    const scrollBand = shiftPlayableBandForPanBoundsCenter(
      phonePlayable,
      phoneViewW,
      phoneViewH
    );
    const panTarget = getFarmPanBoundsScrollTargetScreen(
      phoneViewW,
      phoneViewH,
      phonePlayable
    );
    const limits = computeFarmCameraScrollLimits(tallFootprint, scrollBand, zoom);
    expect(limits.y.oversize).toBe(true);
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC).toBe(0.5);
    const mapTopTarget = getFarmMapTopTargetScreenYFromPanBounds(
      tallFootprint,
      0,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    const anchor = farmFootprintCenter(tallFootprint);
    const scroll = computeFarmCameraScrollForMapTopAndPanCenter(
      999,
      anchor,
      tallFootprint,
      scrollBand,
      mapTopTarget,
      panTarget,
      zoom
    );
    const idealScrollY = anchor.y - panTarget.y / zoom;
    const expectedScrollY = Math.min(
      Math.max(idealScrollY, limits.y.minScroll),
      limits.y.maxScroll
    );
    expect(scroll.scrollY).toBeCloseTo(expectedScrollY, 5);
    const centerScreenY = (anchor.y - scroll.scrollY) * zoom;
    expect(centerScreenY).toBeCloseTo(panTarget.y, 1);
  });

  it('computeOversizeFarmPanBottomScrollY centers footprint on pan target', () => {
    const zoom = 1.7;
    const scrollBand = shiftPlayableBandForPanBoundsCenter(
      phonePlayable,
      phoneViewW,
      phoneViewH
    );
    const panTarget = getFarmPanBoundsScrollTargetScreen(
      phoneViewW,
      phoneViewH,
      phonePlayable
    );
    const scrollY = computeOversizeFarmPanBottomScrollY(
      phoneFootprint,
      scrollBand,
      zoom,
      panTarget
    );
    const center = farmFootprintCenter(phoneFootprint);
    const centerScreenY = (center.y - scrollY) * zoom;
    expect(centerScreenY).toBeCloseTo(panTarget.y, 1);
  });

  it('default pan-bounds row mapping places map top at row 7 from top', () => {
    const zoom = 1.7;
    const panTop = (phoneFootprint.minY - 0) * zoom;
    const panH = (phoneFootprint.maxY - phoneFootprint.minY) * zoom;
    const target = getFarmMapTopTargetScreenYFromPanBounds(
      phoneFootprint,
      0,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC
    );
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_INDEX).toBe(7);
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_OFFSET).toBe(6);
    expect(FARM_MAP_TOP_PAN_BOUNDS_ROW_COUNT).toBe(20);
    expect(FARM_MAP_TOP_PAN_BOUNDS_FRAC).toBe(0.3);
    expect(target).toBeCloseTo(panTop + panH * (6 / 20), 1);
  });
});

describe('clampScrollSoFootprintOverlapsViewport', () => {
  const soil: FarmFootprintBounds = { minX: 100, minY: 200, maxX: 400, maxY: 350 };
  const playable = phonePlayable;
  const viewW = phoneViewW;
  const viewH = phoneViewH;

  it('nudges scroll when footprint is entirely off the right edge', () => {
    const zoom = 2;
    const limits = computeFarmCameraScrollLimits(phoneFootprint, playable, zoom);
    const offRight = { scrollX: 500, scrollY: 128 };
    const after = clampScrollSoFootprintOverlapsViewport(
      soil,
      limits,
      viewW,
      viewH,
      zoom,
      offRight
    );
    const screenMin = (soil.minX - after.scrollX) * zoom;
    const screenMax = (soil.maxX - after.scrollX) * zoom;
    expect(screenMax).toBeGreaterThan(0);
    expect(screenMin).toBeLessThan(viewW);
  });

  it('preserves in-range scroll after pan clamp', () => {
    const zoom = 1.7;
    const limits = computeFarmCameraScrollLimits(phoneFootprint, playable, zoom);
    const centeredX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const after = clampScrollSoFootprintOverlapsViewport(
      soil,
      limits,
      viewW,
      viewH,
      zoom,
      { scrollX: centeredX, scrollY: 128 }
    );
    expect(after.scrollX).toBeCloseTo(centeredX, 3);
    expect(after.scrollY).toBeCloseTo(128, 3);
  });

  it('preserves midpoint scroll at high zoom when using playable band overlap', () => {
    const zoom = 2.8;
    const limits = computeFarmCameraScrollLimits(phoneFootprint, playable, zoom);
    const centeredX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const after = clampScrollSoFootprintOverlapsViewport(
      soil,
      limits,
      viewW,
      viewH,
      zoom,
      { scrollX: centeredX, scrollY: 128 },
      playable
    );
    expect(after.scrollX).toBeCloseTo(centeredX, 2);
    expect(limits.x.maxScroll - limits.x.minScroll).toBeGreaterThan(10);
    expect(limits.x.oversize).toBe(true);
  });
});

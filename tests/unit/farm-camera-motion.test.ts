import { describe, expect, it } from 'vitest';
import {
  clampFarmCameraZoom,
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
} from '../../src/config/farmCameraConfig';
import {
  computeMapViewportScrollLimits,
  computeScrollForZoomAtScreenAnchor,
  decayPanVelocity,
  intersectFarmCameraScrollLimits,
  lerpToward,
  stepSmoothZoomAtAnchor,
  stepSmoothZoomAtMapCenter,
} from '../../src/farmCameraMotion';
import { getFarmMapCenterScreenTargetAtScrollZero } from '../../src/farmWorldScrollAnchor';
import { getFarmMapCenterWorldOffsets } from '../../src/config/farmCameraConfig';
import { computeFarmCameraScrollLimits } from '../../src/farmCameraScroll';

describe('farmCameraConfig', () => {
  it('clamps zoom to configured min/max', () => {
    expect(clampFarmCameraZoom(0.1)).toBe(FARM_CAMERA_MIN_ZOOM);
    expect(clampFarmCameraZoom(5)).toBe(FARM_CAMERA_MAX_ZOOM);
    expect(clampFarmCameraZoom(1.5)).toBe(1.5);
    expect(FARM_CAMERA_DEFAULT_ZOOM).toBe(1.9);
  });
});

describe('computeScrollForZoomAtScreenAnchor', () => {
  it('keeps the world point under the cursor fixed when zoom changes', () => {
    const scrollX = 100;
    const scrollY = 200;
    const prevZoom = 1;
    const nextZoom = 2;
    const anchorX = 390;
    const anchorY = 400;
    const worldX = scrollX + anchorX / prevZoom;
    const worldY = scrollY + anchorY / prevZoom;
    const next = computeScrollForZoomAtScreenAnchor(
      scrollX,
      scrollY,
      prevZoom,
      nextZoom,
      anchorX,
      anchorY
    );
    expect(next.scrollX + anchorX / nextZoom).toBeCloseTo(worldX, 5);
    expect(next.scrollY + anchorY / nextZoom).toBeCloseTo(worldY, 5);
  });
});

describe('stepSmoothZoomAtAnchor', () => {
  it('moves zoom toward target without overshooting clamp', () => {
    const result = stepSmoothZoomAtAnchor(0, 0, 1, 2.2, 200, 300, 0.15);
    expect(result.zoom).toBeGreaterThan(1);
    expect(result.zoom).toBeLessThanOrEqual(FARM_CAMERA_MAX_ZOOM);
    expect(result.settled).toBe(false);
  });
});

describe('stepSmoothZoomAtMapCenter', () => {
  const viewW = 390;
  const viewH = 844;
  const baseCenter = { x: viewW / (2 * 1.9), y: viewH / (2 * 1.9) };

  it('scroll places world-shifted map center on zoom-keyframe screen target', () => {
    const z = 2.5;
    const worldOff = getFarmMapCenterWorldOffsets(viewW, viewH, z);
    const mapCenter = { x: baseCenter.x + worldOff.x, y: baseCenter.y + worldOff.y };
    const result = stepSmoothZoomAtMapCenter(
      mapCenter,
      viewW,
      viewH,
      0,
      0,
      1.9,
      z,
      1
    );
    expect(result.zoom).toBe(z);
    const target = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    const screenX = (mapCenter.x - result.scrollX) * z;
    const screenY = (mapCenter.y - result.scrollY) * z;
    expect(screenX).toBeCloseTo(target.x, 2);
    expect(screenY).toBeCloseTo(target.y, 2);
    expect(mapCenter.x).toBeLessThan(baseCenter.x);
    expect(mapCenter.y).toBeLessThan(baseCenter.y);
  });
});

describe('lerpToward and inertia', () => {
  it('lerps toward target', () => {
    expect(lerpToward(0, 100, 0.12)).toBeCloseTo(12, 5);
  });

  it('decays pan velocity', () => {
    const v = decayPanVelocity(100, -50, 0.9);
    expect(v.velocityX).toBeCloseTo(90, 5);
    expect(v.velocityY).toBeCloseTo(-45, 5);
  });
});

describe('intersectFarmCameraScrollLimits', () => {
  const farm = { minX: 42, minY: 214, maxX: 618, maxY: 518 };
  const playable = {
    playableLeft: 10,
    playableTop: 68,
    playableRight: 300,
    playableBottom: 760,
  };
  const map = { minX: 0, minY: 100, maxX: 800, maxY: 900 };

  it('tightens playable limits with map viewport edges at low zoom', () => {
    const zoom = 1.0;
    const farmLimits = computeFarmCameraScrollLimits(farm, playable, zoom);
    const mapLimits = computeMapViewportScrollLimits(map, 390, 844, zoom);
    const merged = intersectFarmCameraScrollLimits(farmLimits, mapLimits);
    expect(merged.x.minScroll).toBeGreaterThanOrEqual(
      Math.max(farmLimits.x.minScroll, mapLimits.x.minScroll)
    );
    expect(merged.x.maxScroll).toBeLessThanOrEqual(
      Math.min(farmLimits.x.maxScroll, mapLimits.x.maxScroll)
    );
  });
});

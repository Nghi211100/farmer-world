import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
  FARM_CAMERA_SCROLL_VIEWPORT_KEYFRAMES,
  getFarmDefaultScrollAtZoom,
} from '../../src/config/farmCameraConfig';
import { getConfiguredFarmCameraScrollLimits } from '../../src/farmCameraScroll';

const REFERENCE_LIMITS = FARM_CAMERA_SCROLL_VIEWPORT_KEYFRAMES.flatMap((kf) => [
  {
    viewW: kf.viewW,
    viewH: kf.viewH,
    zoom: FARM_CAMERA_MIN_ZOOM,
    limits: kf.atMinZoom,
  },
  {
    viewW: kf.viewW,
    viewH: kf.viewH,
    zoom: FARM_CAMERA_DEFAULT_ZOOM,
    limits: kf.atDefaultZoom,
  },
  {
    viewW: kf.viewW,
    viewH: kf.viewH,
    zoom: FARM_CAMERA_MAX_ZOOM,
    limits: kf.atMaxZoom,
  },
]);

describe('configured farm camera scroll limits (viewport + zoom)', () => {
  it.each(REFERENCE_LIMITS)(
    '$viewW×$viewH z=$zoom: exact min/max scroll',
    ({ viewW, viewH, zoom, limits }) => {
      const configured = getConfiguredFarmCameraScrollLimits(viewW, viewH, zoom);
      expect(configured.x.minScroll).toBe(limits.minScrollX);
      expect(configured.x.maxScroll).toBe(limits.maxScrollX);
      expect(configured.y.minScroll).toBe(limits.minScrollY);
      expect(configured.y.maxScroll).toBe(limits.maxScrollY);
      expect(configured.x.oversize).toBe(true);
      expect(configured.y.oversize).toBe(true);
    }
  );

  it('1670×990 z=1.9: viewport-interpolated asymmetric limits', () => {
    const limits = getConfiguredFarmCameraScrollLimits(1670, 990, FARM_CAMERA_DEFAULT_ZOOM);
    expect(limits.x.minScroll).toBeCloseTo(-840.273885, 4);
    expect(limits.x.maxScroll).toBeCloseTo(343.617834, 3);
    expect(limits.y.minScroll).toBeCloseTo(-365.052356, 4);
    expect(limits.y.maxScroll).toBeCloseTo(178.913613, 4);
  });

  it('1670×990 z=1.9: default scroll lies inside limits', () => {
    const limits = getConfiguredFarmCameraScrollLimits(1670, 990, FARM_CAMERA_DEFAULT_ZOOM);
    const scroll = getFarmDefaultScrollAtZoom(1670, 990, FARM_CAMERA_DEFAULT_ZOOM);
    expect(scroll.scrollX).toBeCloseTo(-279.605096, 4);
    expect(scroll.scrollY).toBeCloseTo(-173.272251, 4);
    expect(scroll.scrollX).toBeGreaterThanOrEqual(limits.x.minScroll);
    expect(scroll.scrollX).toBeLessThanOrEqual(limits.x.maxScroll);
    expect(scroll.scrollY).toBeGreaterThanOrEqual(limits.y.minScroll);
    expect(scroll.scrollY).toBeLessThanOrEqual(limits.y.maxScroll);
  });

  it('1670×990 z=1.55: interpolated limits between 1.2 and 1.9', () => {
    const limits = getConfiguredFarmCameraScrollLimits(1670, 990, 1.55);
    const at12 = getConfiguredFarmCameraScrollLimits(1670, 990, FARM_CAMERA_MIN_ZOOM);
    const at19 = getConfiguredFarmCameraScrollLimits(1670, 990, FARM_CAMERA_DEFAULT_ZOOM);
    const t = (1.55 - FARM_CAMERA_MIN_ZOOM) / (FARM_CAMERA_DEFAULT_ZOOM - FARM_CAMERA_MIN_ZOOM);
    expect(limits.x.minScroll).toBeCloseTo(
      at12.x.minScroll + (at19.x.minScroll - at12.x.minScroll) * t,
      4
    );
    expect(limits.y.maxScroll).toBeCloseTo(
      at12.y.maxScroll + (at19.y.maxScroll - at12.y.maxScroll) * t,
      4
    );
  });
});

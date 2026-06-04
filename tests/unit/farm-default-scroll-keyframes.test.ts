import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
  FARM_DEFAULT_SCROLL_VIEWPORT_KEYFRAMES_AT_DEFAULT_ZOOM,
  getFarmDefaultScrollAtDefaultZoom,
  getFarmDefaultScrollAtZoom,
  piecewiseLerpFarmDefaultScrollOnAxis,
} from '../../src/config/farmCameraConfig';

describe('farm default scroll viewport keyframes at z=1.9', () => {
  it.each(FARM_DEFAULT_SCROLL_VIEWPORT_KEYFRAMES_AT_DEFAULT_ZOOM)(
    '$viewW×$viewH → scroll ($scrollX, $scrollY)',
    ({ viewW, viewH, scrollX, scrollY }) => {
      const scroll = getFarmDefaultScrollAtDefaultZoom(viewW, viewH);
      expect(scroll.scrollX).toBe(scrollX);
      expect(scroll.scrollY).toBe(scrollY);
      expect(getFarmDefaultScrollAtZoom(viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM)).toEqual(scroll);
    }
  );

  it('1670×990: piecewise-linear between reference viewports', () => {
    const scroll = getFarmDefaultScrollAtDefaultZoom(1670, 990);
    const tW = (1670 - 1480) / (2108 - 1480);
    const expectedX = -184 + tW * (-500 - -184);
    const tH = (990 - 903) / (1285 - 903);
    const expectedY = -130 + tH * (-320 - -130);
    expect(scroll.scrollX).toBeCloseTo(expectedX, 5);
    expect(scroll.scrollY).toBeCloseTo(expectedY, 5);
  });

  it('piecewiseLerpFarmDefaultScrollOnAxis hits interior breakpoints', () => {
    const keys = [
      { axis: 100, value: 10 },
      { axis: 200, value: 30 },
      { axis: 300, value: 50 },
    ] as const;
    expect(piecewiseLerpFarmDefaultScrollOnAxis(100, keys)).toBe(10);
    expect(piecewiseLerpFarmDefaultScrollOnAxis(200, keys)).toBe(30);
    expect(piecewiseLerpFarmDefaultScrollOnAxis(250, keys)).toBe(40);
  });

  it('at min/max zoom default scroll lerps toward 0,0', () => {
    const at19 = getFarmDefaultScrollAtDefaultZoom(1670, 990);
    expect(getFarmDefaultScrollAtZoom(1670, 990, FARM_CAMERA_MIN_ZOOM)).toEqual({
      scrollX: 0,
      scrollY: 0,
    });
    expect(getFarmDefaultScrollAtZoom(1670, 990, FARM_CAMERA_MAX_ZOOM)).toEqual({
      scrollX: 0,
      scrollY: 0,
    });
    expect(getFarmDefaultScrollAtZoom(1670, 990, FARM_CAMERA_DEFAULT_ZOOM)).toEqual(at19);
  });

  it('1670×990 z=1.55: zoom-interpolated default scroll between 1.2 and 1.9', () => {
    const at19 = getFarmDefaultScrollAtDefaultZoom(1670, 990);
    const scroll = getFarmDefaultScrollAtZoom(1670, 990, 1.55);
    const t = (1.55 - FARM_CAMERA_MIN_ZOOM) / (FARM_CAMERA_DEFAULT_ZOOM - FARM_CAMERA_MIN_ZOOM);
    expect(scroll.scrollX).toBeCloseTo(at19.scrollX * t, 4);
    expect(scroll.scrollY).toBeCloseTo(at19.scrollY * t, 4);
  });
});

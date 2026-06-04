import { describe, expect, it } from 'vitest';
import {
  computeCanvasCssSize,
  getScaleZoomForPixelRatio,
} from '../../src/displayPixelRatio';

describe('displayPixelRatio / canvas CSS', () => {
  it('zoom is inverse of capped DPR', () => {
    expect(getScaleZoomForPixelRatio(2)).toBe(0.5);
    expect(getScaleZoomForPixelRatio(3)).toBeCloseTo(1 / 3);
  });

  it('canvas CSS fills logical viewport on hi-DPI (not logical × zoom alone)', () => {
    const logicalW = 844;
    const logicalH = 390;
    const dpr = 2;
    const css = computeCanvasCssSize(logicalW, logicalH, dpr);
    expect(css.width).toBe(logicalW);
    expect(css.height).toBe(logicalH);
    expect(css.width).not.toBe(Math.floor(logicalW * getScaleZoomForPixelRatio(dpr)));
  });
});

import { describe, expect, it } from 'vitest';
import {
  intersectFarmFootprintBounds,
  normalizeFarmFootprintBounds,
} from '../../src/farmCameraScroll';

describe('farm footprint bounds helpers', () => {
  it('normalizeFarmFootprintBounds swaps inverted edges', () => {
    const n = normalizeFarmFootprintBounds({ minX: 10, minY: 20, maxX: 0, maxY: 5 });
    expect(n).toEqual({ minX: 0, minY: 5, maxX: 10, maxY: 20 });
  });

  it('intersectFarmFootprintBounds returns null when island inset misses footprint', () => {
    const island = { minX: 0, minY: -200, maxX: 100, maxY: -150 };
    const footprint = { minX: 10, minY: 50, maxX: 90, maxY: 120 };
    expect(intersectFarmFootprintBounds(island, footprint)).toBeNull();
  });

  it('intersectFarmFootprintBounds returns overlap when ranges cross', () => {
    const a = { minX: 0, minY: 10, maxX: 100, maxY: 80 };
    const b = { minX: 20, minY: 30, maxX: 60, maxY: 120 };
    expect(intersectFarmFootprintBounds(a, b)).toEqual({
      minX: 20,
      minY: 30,
      maxX: 60,
      maxY: 80,
    });
  });
});

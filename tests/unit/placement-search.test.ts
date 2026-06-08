import { describe, expect, it } from 'vitest';
import {
  findNearestValidGridPlacement,
  gridManhattanDistance,
} from '../../src/utils/placementSearch';

describe('placementSearch', () => {
  it('gridManhattanDistance sums axis deltas', () => {
    expect(gridManhattanDistance({ gx: 2, gy: 3 }, { gx: 5, gy: 1 })).toBe(5);
  });

  it('findNearestValidGridPlacement picks closest valid anchor', () => {
    const open = new Set(['5,5', '8,2', '1,9']);
    const spot = findNearestValidGridPlacement(10, { gx: 6, gy: 4 }, (gx, gy) =>
      open.has(`${gx},${gy}`)
    );
    expect(spot).toEqual({ gx: 5, gy: 5 });
  });

  it('findNearestValidGridPlacement tie-breaks by lower gy then gx', () => {
    const open = new Set(['4,4', '6,4', '4,6']);
    const spot = findNearestValidGridPlacement(10, { gx: 5, gy: 5 }, (gx, gy) =>
      open.has(`${gx},${gy}`)
    );
    expect(spot).toEqual({ gx: 4, gy: 4 });
  });
});

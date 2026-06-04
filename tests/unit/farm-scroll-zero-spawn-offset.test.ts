import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_SCROLL_X,
  FARM_CAMERA_DEFAULT_SCROLL_Y,
  FARM_CAMERA_DEFAULT_ZOOM,
} from '../../src/config/farmCameraConfig';
import {
  finalizeFarmLayoutAtScrollZero,
  getFarmMapCenterScreenTargetAtScrollZero,
  getFarmMapCenterWorldTargetAtScrollZero,
} from '../../src/farmWorldScrollAnchor';
import { GridSystem } from '../../src/systems/GridSystem';

const viewW = 390;
const viewH = 844;
const z = FARM_CAMERA_DEFAULT_ZOOM;

describe('spawn vs map center after scroll-zero bake', () => {
  it('bakes playable (spawn) center to keyframe world and screen target', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const baked = finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, z);
    const playable = grid.getFarmPlayableMapCenterScreen();
    const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
    const spawn = grid.getFarmPlayerSpawnScreen();
    expect(playable).toEqual(spawn);
    expect(playable.x).toBeCloseTo(target.x, 4);
    expect(playable.y).toBeCloseTo(target.y, 4);
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    expect(
      Math.abs((playable.x - baked.scrollX) * z - screenTarget.x)
    ).toBeLessThan(4);
    expect(
      Math.abs((playable.y - baked.scrollY) * z - screenTarget.y)
    ).toBeLessThan(4);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
} from '../../src/config/farmCameraConfig';
import { getFarmForceSpawnWorld } from '../../src/config/gameConfig';
import {
  enforceFarmMapCenterWorldAnchor,
  FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX,
  getFarmMapCenterWorldTargetAtDefaultScroll,
} from '../../src/farmWorldScrollAnchor';
import { GridSystem } from '../../src/systems/GridSystem';

const viewW = 390;
const viewH = 844;

function stubForceSpawnWorldQuery(search: string): void {
  vi.stubGlobal('window', { location: { search } });
}

describe('forceSpawnWorld query param', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses forceSpawnWorld=0,0', () => {
    stubForceSpawnWorldQuery('?forceSpawnWorld=0,0');
    expect(getFarmForceSpawnWorld()).toEqual({ x: 0, y: 0 });
  });

  it('getFarmMapCenterWorldTargetAtDefaultScroll returns forced world at all zooms', () => {
    stubForceSpawnWorldQuery('?forceSpawnWorld=0,0');
    for (const z of [FARM_CAMERA_MIN_ZOOM, FARM_CAMERA_DEFAULT_ZOOM, FARM_CAMERA_MAX_ZOOM]) {
      const target = getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, z);
      expect(target).toEqual({ x: 0, y: 0 });
    }
  });

  it.each([FARM_CAMERA_MIN_ZOOM, FARM_CAMERA_DEFAULT_ZOOM, FARM_CAMERA_MAX_ZOOM] as const)(
    'enforceFarmMapCenterWorldAnchor locks tile (10,10) at (0,0) at zoom %s',
    (z) => {
      stubForceSpawnWorldQuery('?forceSpawnWorld=0,0');
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      grid.centerInViewport(viewW, viewH, 10, 10);
      const enforced = enforceFarmMapCenterWorldAnchor(grid, viewW, viewH, z);
      expect(enforced.target).toEqual({ x: 0, y: 0 });
      expect(enforced.spawnWorld.x).toBeCloseTo(0, 9);
      expect(enforced.spawnWorld.y).toBeCloseTo(0, 9);
      expect(Math.abs(enforced.spawnWorldErrorX)).toBeLessThanOrEqual(
        FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX
      );
      expect(Math.abs(enforced.spawnWorldErrorY)).toBeLessThanOrEqual(
        FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX
      );
    }
  );
});

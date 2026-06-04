import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
  FARM_SPAWN_WORLD_AT_MIN_ZOOM_X,
  FARM_SPAWN_WORLD_AT_MIN_ZOOM_Y,
} from '../../src/config/farmCameraConfig';
import {
  enforceFarmMapCenterWorldAnchor,
  FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX,
  getFarmSpawnTileWorld,
} from '../../src/farmWorldScrollAnchor';
import { FARM_PLAYER_SPAWN_GX, FARM_PLAYER_SPAWN_GY } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';

const viewW = 390;
const viewH = 844;

describe('farm spawn tile analytical hard lock', () => {
  it('setMapTileCenterWorld places tile center exactly at target world', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const target = { x: FARM_SPAWN_WORLD_AT_MIN_ZOOM_X, y: FARM_SPAWN_WORLD_AT_MIN_ZOOM_Y };
    grid.setMapTileCenterWorld(FARM_PLAYER_SPAWN_GX, FARM_PLAYER_SPAWN_GY, target.x, target.y);
    const spawn = grid.gridToMapTileCenter(FARM_PLAYER_SPAWN_GX, FARM_PLAYER_SPAWN_GY);
    expect(spawn.x).toBeCloseTo(target.x, 9);
    expect(spawn.y).toBeCloseTo(target.y, 9);
    expect(grid.mapTopPanOffsetX).toBe(0);
    expect(grid.mapTopPanOffsetY).toBe(0);
  });

  it.each([FARM_CAMERA_MIN_ZOOM, FARM_CAMERA_DEFAULT_ZOOM, FARM_CAMERA_MAX_ZOOM] as const)(
    'enforceFarmMapCenterWorldAnchor hard lock at zoom %s within tolerance',
    (z) => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      grid.centerInViewport(viewW, viewH, 10, 10);
      grid.mapTopPanOffsetX = 120;
      grid.mapTopPanOffsetY = 80;
      const enforced = enforceFarmMapCenterWorldAnchor(grid, viewW, viewH, z);
      const spawn = getFarmSpawnTileWorld(grid);
      expect(Math.abs(enforced.spawnWorldErrorX)).toBeLessThanOrEqual(
        FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX
      );
      expect(Math.abs(enforced.spawnWorldErrorY)).toBeLessThanOrEqual(
        FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX
      );
      expect(spawn.x).toBeCloseTo(enforced.target.x, 9);
      expect(spawn.y).toBeCloseTo(enforced.target.y, 9);
      expect(grid.mapTopPanOffsetX).toBe(0);
      expect(grid.mapTopPanOffsetY).toBe(0);
    }
  );
});

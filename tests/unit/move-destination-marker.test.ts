import { describe, expect, it } from 'vitest';
import { UI_COMING_TEXTURE_KEY } from '../../src/config/assets';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  MOVE_DESTINATION_MARKER_MAX_PX,
  MOVE_DESTINATION_MARKER_TILE_LIFT,
  TILE_HEIGHT,
  TILE_WIDTH,
  moveDestinationMarkerPositionFromTop,
  tileCenterFromTop,
} from '../../src/utils/iso';
import { getAssetPathToUrlMap } from '../../src/utils/assetUrls';

describe('move destination marker (ui/coming.png)', () => {
  it('bundles ui/coming.png for runtime load', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/coming.png')).toBeTruthy();
    expect(UI_COMING_TEXTURE_KEY).toBe('ui_coming');
  });

  it('targets on-screen size far below source art dimensions', () => {
    expect(MOVE_DESTINATION_MARKER_MAX_PX).toBeLessThan(TILE_WIDTH);
    expect(MOVE_DESTINATION_MARKER_MAX_PX).toBe(TILE_WIDTH * 0.275);
    expect(MOVE_DESTINATION_MARKER_MAX_PX).toBeGreaterThan(15);
  });

  it('anchor at diamond geometric center (same as player tile)', () => {
    const top = { x: 100, y: 200 };
    const center = tileCenterFromTop(top);
    const pin = moveDestinationMarkerPositionFromTop(top);
    expect(pin.x).toBe(center.x);
    expect(pin.y).toBe(center.y);
    expect(MOVE_DESTINATION_MARKER_TILE_LIFT).toBe(1);
  });

  it('gridToMoveDestinationMarker matches gridToMapTileCenter', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const gx = FARM_SOIL_BOUNDS.minX + 2;
    const gy = FARM_SOIL_BOUNDS.minY + 2;
    const pin = grid.gridToMoveDestinationMarker(gx, gy);
    const center = grid.gridToMapTileCenter(gx, gy);
    expect(pin.x).toBe(center.x);
    expect(pin.y).toBe(center.y);
  });

  it('marker depth sorts above farm ground on unlocked soil', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const gx = FARM_SOIL_BOUNDS.minX + 2;
    const gy = FARM_SOIL_BOUNDS.minY + 2;
    expect(grid.isFarmUnlocked(gx, gy)).toBe(true);

    const groundDepth = grid.getDepth(gx, gy, 'ground');
    const markerDepth = grid.getDepth(gx, gy, 'crops') + 28;
    expect(markerDepth).toBeGreaterThan(groundDepth);
  });
});

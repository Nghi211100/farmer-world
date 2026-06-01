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
  tileBottomFromTop,
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
    expect(MOVE_DESTINATION_MARKER_MAX_PX).toBeGreaterThan(20);
  });

  it('anchor sits 30% from tile bottom toward diamond center', () => {
    const top = { x: 100, y: 200 };
    const bottom = tileBottomFromTop(top);
    const center = tileCenterFromTop(top);
    const pin = moveDestinationMarkerPositionFromTop(top);
    const t = MOVE_DESTINATION_MARKER_TILE_LIFT;
    expect(pin.x).toBeCloseTo(bottom.x + (center.x - bottom.x) * t);
    expect(pin.y).toBeCloseTo(bottom.y + (center.y - bottom.y) * t);
    expect(pin.y).toBe(bottom.y - TILE_HEIGHT * 0.5 * t);
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

import { describe, expect, it } from 'vitest';
import { finalizeFarmLayoutAtScrollZero } from '../../src/farmWorldScrollAnchor';
import { TILE_HEIGHT, TILE_WIDTH, tileBottomFromTop } from '../../src/utils/iso';
import { GridSystem } from '../../src/systems/GridSystem';

const viewW = 390;
const viewH = 844;

/** Independent AABB from 20×20 corner tiles (offsets cleared). */
function cornerTileAabbCenter(grid: GridSystem): { x: number; y: number } {
  const prevX = grid.mapTopPanOffsetX;
  const prevY = grid.mapTopPanOffsetY;
  grid.mapTopPanOffsetX = 0;
  grid.mapTopPanOffsetY = 0;
  const corners: [number, number][] = [
    [0, 0],
    [grid.size - 1, 0],
    [0, grid.size - 1],
    [grid.size - 1, grid.size - 1],
  ];
  const hw = grid.tileWidth / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [gx, gy] of corners) {
    const top = grid.gridToMapScreen(gx, gy);
    const bottom = tileBottomFromTop(top);
    minX = Math.min(minX, top.x - hw);
    maxX = Math.max(maxX, top.x + hw);
    minY = Math.min(minY, top.y);
    maxY = Math.max(maxY, bottom.y);
  }
  grid.mapTopPanOffsetX = prevX;
  grid.mapTopPanOffsetY = prevY;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

describe('20×20 map AABB center', () => {
  it('getFarmMapCenterScreen equals corner-tile AABB center (not grid 9.5)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);

    const manual = cornerTileAabbCenter(grid);
    const center = grid.getFarmMapCenterScreen();
    const bounds = grid.getMapScreenBounds();

    expect(grid.isFarmMapCenterTrueAabb()).toBe(true);
    expect(center.x).toBeCloseTo(manual.x, 4);
    expect(center.y).toBeCloseTo(manual.y, 4);
    expect(center.x).toBeCloseTo(bounds.centerX, 4);
    expect(center.y).toBeCloseTo(bounds.centerY, 4);
    expect(bounds.centerX).toBeCloseTo((bounds.minX + bounds.maxX) / 2, 4);
    expect(bounds.centerY).toBeCloseTo((bounds.minY + bounds.maxY) / 2, 4);

    // Symmetric 20×20 iso: fractional center (9.5, 9.5) can match corner AABB — anchor still uses corners.
    const tileCenter = grid.gridToMapTileCenter(9.5, 9.5);
    expect(center.x).toBeCloseTo(tileCenter.x, 4);
    expect(center.y).toBeCloseTo(tileCenter.y, 4);
  });

  it('after scroll-zero bake, playable (spawn) center hits keyframe world', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(viewW, viewH, 10, 10);
    const z = 1.9;
    finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, z);

    expect(grid.mapTopPanOffsetX).toBe(0);
    expect(grid.mapTopPanOffsetY).toBe(0);
    const playable = grid.getFarmPlayableMapCenterScreen();
    expect(playable.x).toBeCloseTo(554.7, 1);
    expect(playable.y).toBeCloseTo(338.2, 1);
    expect(grid.isFarmMapCenterTrueAabb()).toBe(true);
  });

  it('uses TILE_WIDTH/TILE_HEIGHT diamond extents on corners', () => {
    const grid = new GridSystem();
    expect(grid.size).toBe(20);
    expect(grid.tileWidth).toBe(TILE_WIDTH);
    expect(grid.tileHeight).toBe(TILE_HEIGHT);
  });
});

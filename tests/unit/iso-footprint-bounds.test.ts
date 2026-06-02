import { describe, expect, it } from 'vitest';
import {
  computeSpriteFitScale,
  ISO_PEN_FOOTPRINT_DEBUG_COLOR,
  isoRectFootprintScreenBounds,
  isoRectFootprintScreenRhombus,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../src/utils/iso';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { FARM_ISLAND_RING_MARGIN } from '../../src/farmIslandLayout';
import { GridSystem } from '../../src/systems/GridSystem';
import { PEN_HOUSE_FOOTPRINT_FIT_PADDING, penHouseDisplaySize } from '../../src/config/livestockAssets';

describe('isoRectFootprintScreenBounds', () => {
  it('3×3 anchor footprint spans three tile widths on screen', () => {
    const b = isoRectFootprintScreenBounds(0, 0, 3, 3);
    expect(b.width).toBe(3 * TILE_WIDTH);
    expect(b.height).toBe(3 * TILE_HEIGHT);
    expect(b.centerX).toBe(0);
    expect(b.bottomY).toBe(3 * TILE_HEIGHT);
  });

  it('4×4 footprint scales linearly', () => {
    const b = isoRectFootprintScreenBounds(5, 5, 4, 4);
    expect(b.width).toBe(4 * TILE_WIDTH);
    expect(b.height).toBe(4 * TILE_HEIGHT);
  });

  it('10×10 soil+path ring footprint is 640×320 logical AABB', () => {
    const m = FARM_ISLAND_RING_MARGIN;
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const tilesW = maxX - minX + 1 + 2 * m;
    const tilesH = maxY - minY + 1 + 2 * m;
    expect(tilesW).toBe(10);
    expect(tilesH).toBe(10);
    const b = isoRectFootprintScreenBounds(minX - m, minY - m, tilesW, tilesH);
    expect(b.width).toBe(640);
    expect(b.height).toBe(320);
  });

  it('footprint rhombus fits inside its AABB', () => {
    const r = isoRectFootprintScreenRhombus(3, 5, 10, 10, 400, 200);
    const b = isoRectFootprintScreenBounds(3, 5, 10, 10, 400, 200);
    const pts = [r.north, r.east, r.south, r.west];
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(b.minX - 0.01);
      expect(p.x).toBeLessThanOrEqual(b.maxX + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(b.minY - 0.01);
      expect(p.y).toBeLessThanOrEqual(b.maxY + 0.01);
    }
  });

  it('GridSystem farm footprint stays inside 20×20 map bounds', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(1280, 720);
    const map = grid.getMapScreenBounds();
    const fp = grid.getFarmFootprintScreenBounds();
    expect(fp.maxX - fp.minX).toBeCloseTo(640, 0);
    expect(fp.maxY - fp.minY).toBeCloseTo(320, 0);
    expect(fp.minX).toBeGreaterThanOrEqual(map.minX - 0.5);
    expect(fp.minY).toBeGreaterThanOrEqual(map.minY - 0.5);
    expect(fp.maxX).toBeLessThanOrEqual(map.maxX + 0.5);
    expect(fp.maxY).toBeLessThanOrEqual(map.maxY + 0.5);
  });

  it('pen footprint debug color is magenta (distinct from green/blue map debug)', () => {
    expect(ISO_PEN_FOOTPRINT_DEBUG_COLOR).toBe(0xff44cc);
  });

  it('pen house contain scale keeps art inside footprint AABB', () => {
    const box = penHouseDisplaySize(1);
    const fishFrame = { w: 112, h: 96 };
    expect(computeSpriteFitScale(fishFrame.w, fishFrame.h, box.width, box.height, 'contain')).toBe(
      1
    );
    expect(computeSpriteFitScale(fishFrame.w, fishFrame.h, box.width, box.height, 'cover')).toBe(
      box.width / fishFrame.w
    );
    expect(PEN_HOUSE_FOOTPRINT_FIT_PADDING).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  canBeginPlacementGhostDrag,
  isWorldPointInScreenBounds,
  isWorldPointOnMapFootprint,
  PLACEMENT_GHOST_HIT_SLOP_PX,
} from '../../src/utils/buildPlacementDrag';

describe('buildPlacementDrag', () => {
  it('uses touch slop for ghost hit targets', () => {
    expect(PLACEMENT_GHOST_HIT_SLOP_PX).toBeGreaterThan(0);
  });

  it('matches grid footprint cell picks', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const item = BUILD_ITEMS.find((i) => i.label === 'House')!;
    const ghostGx = 5;
    const ghostGy = 6;

    expect(
      canBeginPlacementGhostDrag({
        pointerWorldX: 0,
        pointerWorldY: 0,
        gridPickGx: ghostGx,
        gridPickGy: ghostGy,
        ghostGx,
        ghostGy,
        footprintW: item.footprint.w,
        footprintH: item.footprint.h,
        grid,
        isGridOnFootprint: (gx, gy) =>
          gx >= ghostGx &&
          gx < ghostGx + item.footprint.w &&
          gy >= ghostGy &&
          gy < ghostGy + item.footprint.h,
      })
    ).toBe(true);
  });

  it('accepts world point on map footprint when grid pick lands on neighbor cell', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const item = BUILD_ITEMS.find((i) => i.label === 'Field border')!;
    const ghostGx = 3;
    const ghostGy = 5;
    const center = grid.gridToMapTileCenter(ghostGx, ghostGy);

    expect(
      canBeginPlacementGhostDrag({
        pointerWorldX: center.x,
        pointerWorldY: center.y,
        gridPickGx: ghostGx + 1,
        gridPickGy: ghostGy,
        ghostGx,
        ghostGy,
        footprintW: item.footprint.w,
        footprintH: item.footprint.h,
        grid,
        isGridOnFootprint: () => false,
      })
    ).toBe(true);
  });

  it('accepts world point on ghost sprite bounds when grid and footprint miss', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const item = BUILD_ITEMS.find((i) => i.label === 'Tree 1')!;
    const ghostGx = 4;
    const ghostGy = 4;
    const sprite = {
      visible: true,
      getBounds: () => ({ left: 100, right: 160, top: 80, bottom: 140 }),
    };

    expect(
      canBeginPlacementGhostDrag({
        pointerWorldX: 130,
        pointerWorldY: 110,
        gridPickGx: ghostGx - 2,
        gridPickGy: ghostGy - 2,
        ghostGx,
        ghostGy,
        footprintW: item.footprint.w,
        footprintH: item.footprint.h,
        grid,
        isGridOnFootprint: () => false,
        ghostSprite: sprite,
      })
    ).toBe(true);
  });

  it('rejects pointer far from ghost', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const item = BUILD_ITEMS.find((i) => i.label === 'House')!;

    expect(
      canBeginPlacementGhostDrag({
        pointerWorldX: -9999,
        pointerWorldY: -9999,
        gridPickGx: 0,
        gridPickGy: 0,
        ghostGx: 8,
        ghostGy: 8,
        footprintW: item.footprint.w,
        footprintH: item.footprint.h,
        grid,
        isGridOnFootprint: () => false,
        ghostSprite: {
          visible: true,
          getBounds: () => ({ left: 100, right: 120, top: 100, bottom: 120 }),
        },
      })
    ).toBe(false);
  });

  it('isWorldPointInScreenBounds respects slop', () => {
    const bounds = { left: 10, right: 20, top: 10, bottom: 20 };
    expect(isWorldPointInScreenBounds(9, 15, bounds, 2)).toBe(true);
    expect(isWorldPointInScreenBounds(5, 15, bounds, 2)).toBe(false);
  });

  it('isWorldPointOnMapFootprint covers 1x1 anchor tile', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const center = grid.gridToMapTileCenter(6, 7);
    expect(isWorldPointOnMapFootprint(center.x, center.y, 6, 7, 1, 1, grid)).toBe(true);
  });
});

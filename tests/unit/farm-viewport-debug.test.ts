import { describe, expect, it } from 'vitest';
import type { FarmFootprintBounds } from '../../src/farmCameraScroll';
import {
  farmBackgroundOnlyHudLabel,
  farmCameraVisibleWorldRect,
  farmFootprintDebugLabel,
  farmFootprintWorldRect,
  farmMapDebugLabel,
  farmMapDebugTileCount,
  farmMapWorldEndsDebugLabel,
  farmPanBoundsDebugLabel,
  farmViewportDebugGridStepX,
  farmViewportDebugGridStepY,
  farmViewportExtendsBeyondBounds,
  playableBandScreenRect,
  screenBoundsToFootprint,
} from '../../src/utils/farmViewportDebugLayout';
import { computePlayableFarmViewportLayout } from '../../src/ui/hudLayout';
import { GRID_SIZE } from '../../src/config/gameConfig';
import { TILE_HEIGHT, TILE_WIDTH } from '../../src/utils/iso';
import { farmWorldToScreen } from '../../src/utils/farmViewportDebugLayout';

describe('farm viewport debug helpers', () => {
  it('maps playable layout to screen rect', () => {
    const viewW = 1492;
    const viewH = 1054;
    const layout = computePlayableFarmViewportLayout(viewW, viewH, 10, 10);
    const band = playableBandScreenRect(layout);
    expect(band.left).toBe(layout.playableLeft);
    expect(band.top).toBe(layout.playableTop);
    expect(band.width).toBe(layout.playableRight - layout.playableLeft);
    expect(band.height).toBe(layout.playableBottom - layout.playableTop);
    expect(band.width).toBeGreaterThan(0);
    expect(band.height).toBeGreaterThan(0);
  });

  it('maps farm scroll bounds to world rect', () => {
    const farm: FarmFootprintBounds = {
      minX: 120,
      minY: 80,
      maxX: 920,
      maxY: 640,
    };
    const rect = farmFootprintWorldRect(farm);
    expect(rect).toEqual({ left: 120, top: 80, width: 800, height: 560 });
  });

  it('uses iso tile steps for the farm world cell grid', () => {
    expect(farmViewportDebugGridStepX()).toBe(TILE_WIDTH);
    expect(farmViewportDebugGridStepY()).toBe(TILE_HEIGHT);
  });

  it('maps grid screen bounds to footprint for full-map debug', () => {
    const footprint = screenBoundsToFootprint({
      minX: 0,
      minY: 40,
      maxX: 1280,
      maxY: 720,
    });
    expect(footprint).toEqual({
      minX: 0,
      minY: 40,
      maxX: 1280,
      maxY: 720,
    });
    const rect = farmFootprintWorldRect(footprint);
    expect(rect.width).toBe(1280);
    expect(rect.height).toBe(680);
  });

  it('counts all logical map tiles for debug labels', () => {
    expect(farmMapDebugTileCount()).toBe(GRID_SIZE * GRID_SIZE);
    expect(farmMapDebugTileCount(20)).toBe(400);
  });

  it('formats distinct debug labels for map, pan bounds, and footprint', () => {
    const rect = { width: 800, height: 560 };
    expect(farmMapDebugLabel(rect, 400, 20, 64, 32)).toContain('map 20×20');
    expect(farmMapDebugLabel(rect, 400, 20, 64, 32)).toContain('400 tiles');
    expect(farmPanBoundsDebugLabel(rect)).toContain('pan bounds');
    expect(farmPanBoundsDebugLabel(rect)).toContain('camera scroll clamp');
    expect(farmFootprintDebugLabel(rect)).toContain('footprint');
    expect(farmFootprintDebugLabel(rect)).toContain('soil + path ring');
    expect(farmMapWorldEndsDebugLabel()).toContain('WORLD ENDS');
    expect(farmBackgroundOnlyHudLabel('map')).toContain('outside map');
  });

  it('farmWorldToScreen matches Phaser scroll/zoom transform', () => {
    const cam = { scrollX: 12, scrollY: 8, zoom: 1.9, x: 0, y: 0 };
    const world = { x: 554.7, y: 338.2 };
    const screen = farmWorldToScreen(cam, world.x, world.y);
    expect(screen.x).toBeCloseTo((world.x - cam.scrollX) * cam.zoom, 4);
    expect(screen.y).toBeCloseTo((world.y - cam.scrollY) * cam.zoom, 4);
  });

  it('detects viewport void beyond map and pan bounds', () => {
    const map: FarmFootprintBounds = { minX: 100, minY: 50, maxX: 1380, maxY: 690 };
    const pan: FarmFootprintBounds = { minX: 0, minY: 0, maxX: 2400, maxY: 2400 };
    const visible = farmCameraVisibleWorldRect(2000, 1800, 1.7, 390, 844);
    expect(farmViewportExtendsBeyondBounds(visible, map)).toBe(true);
    expect(farmViewportExtendsBeyondBounds(visible, pan)).toBe(false);
    const inside = farmCameraVisibleWorldRect(200, 100, 1.7, 390, 844);
    expect(farmViewportExtendsBeyondBounds(inside, map)).toBe(false);
  });
});

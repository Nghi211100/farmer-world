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
import {
  farmCenterDebugMapViewportMergedTitle,
  farmCenterDebugMarkerLabelBlock,
  farmDebugWorldPointsCoincide,
  farmViewportCenterWorldAtScroll,
  farmWorldToScreen,
  formatFarmDebugCoord,
} from '../../src/utils/farmViewportDebugLayout';

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

  it('formats center debug label blocks with title, world, and screen', () => {
    const block = farmCenterDebugMarkerLabelBlock({
      title: 'scroll origin',
      worldX: 0,
      worldY: 0,
      screenX: 0,
      screenY: 0,
      scrollX: 0,
      scrollY: 0,
    });
    expect(block).toContain('scroll origin');
    expect(block).toContain('scroll: (0.0, 0.0)');
    expect(block).toContain('world: (0.0, 0.0)');
    expect(block).not.toContain('stable');
    expect(block).toContain('screen: (0.0, 0.0)');
    const withTarget = farmCenterDebugMarkerLabelBlock({
      title: 'map center',
      worldX: 554.7,
      worldY: 338.2,
      screenX: 200,
      screenY: 300,
      scrollX: 12,
      scrollY: 8,
      targetScreenX: 195,
      targetScreenY: 280,
    });
    expect(withTarget).toContain('target: (195.0, 280.0)');
    expect(withTarget).toContain('scroll: (12.0, 8.0)');
    const withWorldDelta = farmCenterDebugMarkerLabelBlock({
      title: 'map center',
      worldX: 100,
      worldY: 200,
      screenX: 50,
      screenY: 60,
      worldOffsetX: -12,
      worldOffsetY: 8,
      zoom: 2.5,
    });
    expect(withWorldDelta).toContain('Δ(-12.0, 8.0)');
    expect(withWorldDelta).toContain('z=2.5');
    expect(farmCenterDebugMapViewportMergedTitle()).toBe('map + viewport center');
    expect(formatFarmDebugCoord(102.567)).toBe('102.6');
  });

  it('farmWorldToScreen matches Phaser scroll/zoom (hud and dot share transform)', () => {
    const cam = { scrollX: 12, scrollY: 8, zoom: 1.9, x: 0, y: 0 };
    const world = { x: 554.7, y: 338.2 };
    const hud = farmWorldToScreen(cam, world.x, world.y);
    const dot = farmWorldToScreen(cam, world.x, world.y);
    expect(Math.abs(hud.x - dot.x)).toBeLessThan(2);
    expect(Math.abs(hud.y - dot.y)).toBeLessThan(2);
    expect(hud.x).toBeCloseTo((world.x - cam.scrollX) * cam.zoom, 4);
    expect(hud.y).toBeCloseTo((world.y - cam.scrollY) * cam.zoom, 4);
  });

  it('merges map and viewport center markers when world points coincide', () => {
    expect(farmDebugWorldPointsCoincide({ x: 100, y: 200 }, { x: 100.3, y: 200.2 })).toBe(
      true
    );
    expect(farmDebugWorldPointsCoincide({ x: 100, y: 200 }, { x: 101, y: 200 })).toBe(false);
    const viewW = 390;
    const viewH = 844;
    const z = 1.9;
    const mapCenter = { x: viewW / (2 * z), y: viewH / (2 * z) };
    const viewport = farmViewportCenterWorldAtScroll(viewW, viewH, z, 0, 0);
    expect(farmDebugWorldPointsCoincide(mapCenter, viewport)).toBe(true);
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

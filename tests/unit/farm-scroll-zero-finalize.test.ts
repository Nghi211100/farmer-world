import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
  getFarmDefaultScrollAtZoom,
} from '../../src/config/farmCameraConfig';
import {
  computeScrollForMapCenterScreenTarget,
  finalizeFarmLayoutAtScrollZero,
  getFarmMapCenterScreenTargetAtScrollZero,
  getFarmMapCenterWorldTargetAtScrollZero,
} from '../../src/farmWorldScrollAnchor';
import { GridSystem } from '../../src/systems/GridSystem';
import { FARM_FIT_PAD_X, FARM_FIT_PAD_Y } from '../../src/ui/hudLayout';

function anchorDefaultScroll(grid: GridSystem, viewW: number, viewH: number) {
  const zoom = FARM_CAMERA_DEFAULT_ZOOM;
  grid.centerInViewport(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
  finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, zoom);
}

describe('default farm camera scroll at layout', () => {
  it.each([
    { viewW: 390, viewH: 844, label: 'phone' },
    { viewW: 2101, viewH: 1205, label: 'wide' },
    { viewW: 2108, viewH: 1285, label: 'wide-desktop' },
  ])('$label: 20×20 map intersects viewport at default scroll', ({ viewW, viewH }) => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    anchorDefaultScroll(grid, viewW, viewH);
    const map = grid.getMapScreenBounds();
    const z = FARM_CAMERA_DEFAULT_ZOOM;
    const { scrollX: sx, scrollY: sy } = getFarmDefaultScrollAtZoom(
      viewW,
      viewH,
      FARM_CAMERA_DEFAULT_ZOOM
    );
    const minX = (map.minX - sx) * z;
    const maxX = (map.maxX - sx) * z;
    const minY = (map.minY - sy) * z;
    const maxY = (map.maxY - sy) * z;
    expect(maxX).toBeGreaterThan(0);
    expect(minX).toBeLessThan(viewW);
    expect(maxY).toBeGreaterThan(0);
    expect(minY).toBeLessThan(viewH);
  });

  it.each([
    { viewW: 390, viewH: 844 },
    { viewW: 2108, viewH: 1285 },
  ])(
    '$viewW×$viewH: playable center on screen target after scroll-zero bake',
    ({ viewW, viewH }) => {
      const grid = new GridSystem();
      grid.generatePlaceholderMap();
      anchorDefaultScroll(grid, viewW, viewH);
      const mapCenter = grid.getFarmPlayableMapCenterScreen();
      const z = FARM_CAMERA_DEFAULT_ZOOM;
      const target = getFarmMapCenterWorldTargetAtScrollZero(viewW, viewH, z);
      expect(mapCenter.x).toBeCloseTo(target.x, 4);
      expect(mapCenter.y).toBeCloseTo(target.y, 4);
      const scroll = computeScrollForMapCenterScreenTarget(mapCenter, viewW, viewH, z);
      const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
      const screenX = (mapCenter.x - scroll.scrollX) * z;
      const screenY = (mapCenter.y - scroll.scrollY) * z;
      expect(screenX).toBeCloseTo(screenTarget.x, 2);
      expect(screenY).toBeCloseTo(screenTarget.y, 2);
    }
  );
});

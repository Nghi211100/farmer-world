import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  getFarmCameraScreenCenter,
  getFarmPanBoundsScrollTargetScreen,
  getPlayableBandGeometricCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import {
  computeCenteredFarmCameraScroll,
  computeFarmCameraScrollLimits,
  computeFarmPlayableScreenMargins,
  type FarmFootprintBounds,
} from '../../src/farmCameraScroll';
import { computeFarmIslandScreenBounds, FARM_ISLAND_SCALE_BOOST } from '../../src/farmIslandLayout';

const viewW = 390;
const viewH = 844;
const padX = 10;
const padY = 10;
const zoom = 1.7;

function layoutIsland() {
  const grid = new GridSystem();
  grid.generatePlaceholderMap();
  const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
  grid.centerInViewport(viewW, viewH, padX, padY);
  const island = computeFarmIslandScreenBounds(
    grid.getFarmSoilScreenRhombus(),
    2048,
    2048,
    { scaleBoost: FARM_ISLAND_SCALE_BOOST }
  );
  return { layout, island, grid };
}

describe('pan bounds screen placement at load zoom', () => {
  it('centers 20×20 map anchor X on pan target at load zoom', () => {
    const { layout, grid } = layoutIsland();
    const geomPlayable = {
      playableLeft: layout.playableLeft,
      playableTop: layout.playableTop,
      playableRight: layout.playableRight,
      playableBottom: layout.playableBottom,
    };
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(
      geomPlayable,
      viewW,
      viewH
    );
    const panCenter = getFarmPanBoundsScrollTargetScreen(viewW, viewH, geomPlayable);
    const geomCenter = getPlayableBandGeometricCenter(geomPlayable);
    const cameraCenter = getFarmCameraScreenCenter(viewW, viewH);
    const anchor = grid.getFarmMapCenterScreen();
    const fp = grid.getFarmFootprintScreenBounds();
    const clampFarm: FarmFootprintBounds = {
      minX: fp.minX,
      minY: fp.minY,
      maxX: fp.maxX,
      maxY: fp.maxY,
    };

    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      panCenter,
      clampFarm,
      scrollPlayable,
      zoom
    );
    const limits = computeFarmCameraScrollLimits(clampFarm, scrollPlayable, zoom);
    const idealScrollX = anchor.x - panCenter.x / zoom;

    expect(limits.x.oversize).toBe(true);
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC).toBe(0.5);
    expect(FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC).toBe(0.5);
    expect(panCenter.x).toBeCloseTo(cameraCenter.x, 1);
    expect(panCenter.y).toBeCloseTo(cameraCenter.y, 1);
    expect(panCenter.x).not.toBeCloseTo(geomCenter.x, 0);
    expect((anchor.x - idealScrollX) * zoom).toBeCloseTo(panCenter.x, 1);
  });
});

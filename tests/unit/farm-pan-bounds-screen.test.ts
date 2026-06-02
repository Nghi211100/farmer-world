import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computePlayableFarmViewportLayout,
  FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
  FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
  getPlayableBandGeometricCenter,
  getPlayableBandPanBoundsCenter,
  shiftPlayableBandForPanBoundsCenter,
} from '../../src/ui/hudLayout';
import {
  computeCenteredFarmCameraScroll,
  computeFarmCameraScrollLimits,
  computeFarmPlayableScreenMargins,
  farmFootprintCenter,
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
  return { layout, island };
}

describe('pan bounds screen placement at load zoom', () => {
  it('centers island AABB on pan-bounds target (45% right, 50% down)', () => {
    const { layout, island } = layoutIsland();
    const geomPlayable = {
      playableLeft: layout.playableLeft,
      playableTop: layout.playableTop,
      playableRight: layout.playableRight,
      playableBottom: layout.playableBottom,
    };
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(geomPlayable);
    const panCenter = getPlayableBandPanBoundsCenter(geomPlayable);
    const geomCenter = getPlayableBandGeometricCenter(geomPlayable);
    const anchor = farmFootprintCenter(island);

    const scroll = computeCenteredFarmCameraScroll(
      anchor,
      panCenter,
      island,
      scrollPlayable,
      zoom
    );
    const limits = computeFarmCameraScrollLimits(island, scrollPlayable, zoom);
    const midX = (limits.x.minScroll + limits.x.maxScroll) / 2;

    const margins = computeFarmPlayableScreenMargins(
      island,
      geomPlayable,
      scroll.scrollX,
      scroll.scrollY,
      zoom
    );
    const screenX = (anchor.x - scroll.scrollX) * zoom;
    const screenY = (anchor.y - scroll.scrollY) * zoom;
    const playableW = geomPlayable.playableRight - geomPlayable.playableLeft;
    const playableH = geomPlayable.playableBottom - geomPlayable.playableTop;
    const midY = (limits.y.minScroll + limits.y.maxScroll) / 2;

    expect(limits.x.oversize).toBe(true);
    expect(scroll.scrollX).toBeCloseTo(midX, 2);
    expect(scroll.scrollY).toBeCloseTo(midY, 2);
    expect(screenX).toBeCloseTo(panCenter.x, 1);
    expect(screenY).toBeCloseTo(panCenter.y, 1);
    expect(panCenter.x - geomCenter.x).toBeCloseTo(
      playableW * FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
      1
    );
    expect(panCenter.y - geomCenter.y).toBeCloseTo(
      playableH * FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
      1
    );
    expect(margins.left - margins.right).toBeCloseTo(
      2 * playableW * FARM_PAN_BOUNDS_CENTER_OFFSET_X_FRAC,
      1
    );
    expect(margins.top - margins.bottom).toBeCloseTo(
      2 * playableH * FARM_PAN_BOUNDS_CENTER_OFFSET_Y_FRAC,
      1
    );
  });
});

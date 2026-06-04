import { describe, expect, it } from 'vitest';
import {
  FARM_CAMERA_DEFAULT_ZOOM,
} from '../../src/config/farmCameraConfig';
import {
  finalizeFarmLayoutAtScrollZero,
  getFarmMapCenterWorldTargetAtScrollZero,
} from '../../src/farmWorldScrollAnchor';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  FARM_FIT_PAD_X,
  FARM_FIT_PAD_Y,
} from '../../src/ui/hudLayout';

const viewW = 390;
const viewH = 844;

function finalizeAfterLayout(grid: GridSystem) {
  grid.centerInViewport(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
  finalizeFarmLayoutAtScrollZero(grid, viewW, viewH, FARM_CAMERA_DEFAULT_ZOOM);
}

describe('scroll-zero rebake after centerInViewport', () => {
  it('re-centerInViewport then finalize keeps playable center at keyframe world', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    finalizeAfterLayout(grid);
    grid.centerInViewport(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
    finalizeAfterLayout(grid);
    const mapCenter = grid.getFarmPlayableMapCenterScreen();
    const target = getFarmMapCenterWorldTargetAtScrollZero(
      viewW,
      viewH,
      FARM_CAMERA_DEFAULT_ZOOM
    );
    expect(mapCenter.x).toBeCloseTo(target.x, 4);
    expect(mapCenter.y).toBeCloseTo(target.y, 4);
  });
});

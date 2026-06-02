import { describe, expect, it } from 'vitest';
import { setHudSafeAreaInsets } from '../../src/safeArea';
import {
  computePlayableFarmViewportLayout,
  FARM_VISUAL_CENTER_OFFSET_X_FRAC,
  FARM_VISUAL_CENTER_OFFSET_Y_FRAC,
} from '../../src/ui/hudLayout';

describe('farm visual center offset', () => {
  it('reports offset px at phone and desktop viewports', () => {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });

    for (const [label, viewW, viewH] of [
      ['390x844', 390, 844],
      ['1280x720', 1280, 720],
    ] as const) {
      const layout = computePlayableFarmViewportLayout(viewW, viewH);
      const playableW = layout.playableRight - layout.playableLeft;
      const playableH = layout.playableBottom - layout.playableTop;
      const geomCenterX = (layout.playableLeft + layout.playableRight) / 2;
      const offsetPxX = playableW * FARM_VISUAL_CENTER_OFFSET_X_FRAC;
      const offsetPxY = playableH * FARM_VISUAL_CENTER_OFFSET_Y_FRAC;

      expect(layout.centerX - geomCenterX).toBeCloseTo(offsetPxX, 5);
      expect(offsetPxX).toBeGreaterThan(0);

      // eslint-disable-next-line no-console -- fixture metrics for visual-center tuning
      console.log(
        `[${label}] playableW=${playableW.toFixed(1)} visualOffsetX=${offsetPxX.toFixed(1)}px ` +
          `(${FARM_VISUAL_CENTER_OFFSET_X_FRAC * 100}% right), Y=${offsetPxY.toFixed(1)}px`
      );
    }

    expect(FARM_VISUAL_CENTER_OFFSET_Y_FRAC).toBe(0);
  });
});

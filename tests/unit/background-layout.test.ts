import { describe, expect, it } from 'vitest';
import {
  computeCoverDisplaySize,
  VIEWPORT_COVER_BLEED_PX,
} from '../../src/backgroundLayout';

/** Reference ui/background.png art size. */
const BG_TEX_W = 1492;
const BG_TEX_H = 1054;

describe('computeCoverDisplaySize', () => {
  it('cover-fills ultrawide phone landscape (width-limited scale)', () => {
    const viewW = 844;
    const viewH = 390;
    const { displayW, displayH } = computeCoverDisplaySize(
      BG_TEX_W,
      BG_TEX_H,
      viewW,
      viewH
    );
    expect(displayW).toBeGreaterThanOrEqual(viewW + VIEWPORT_COVER_BLEED_PX * 2);
    expect(displayH).toBeGreaterThanOrEqual(viewH + VIEWPORT_COVER_BLEED_PX * 2);
  });

  it('cover-fills tall portrait viewport (height-limited scale)', () => {
    const viewW = 390;
    const viewH = 844;
    const { displayW, displayH } = computeCoverDisplaySize(
      BG_TEX_W,
      BG_TEX_H,
      viewW,
      viewH
    );
    expect(displayW).toBeGreaterThanOrEqual(viewW + VIEWPORT_COVER_BLEED_PX * 2);
    expect(displayH).toBeGreaterThanOrEqual(viewH + VIEWPORT_COVER_BLEED_PX * 2);
  });

  it('uses max of width/height scale, not min (cover not contain)', () => {
    const viewW = 844;
    const viewH = 390;
    const cover = computeCoverDisplaySize(BG_TEX_W, BG_TEX_H, viewW, viewH);
    const containScale = Math.min(viewW / BG_TEX_W, viewH / BG_TEX_H);
    const containH = BG_TEX_H * containScale;
    expect(cover.displayH).toBeGreaterThan(containH);
  });
});

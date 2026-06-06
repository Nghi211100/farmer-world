import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoBridgeTileSprite,
  BRIDGE_GROUND_BASE_DISPLAY_SCALE,
  BRIDGE_TILE_DISPLAY_OFFSET_Y,
  BRIDGE_TILE_DISPLAY_SCALE_X,
  BRIDGE_TILE_DISPLAY_SCALE_Y,
  getBridgeTileDisplayOffset,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../src/utils/iso';

describe('bridge tile display', () => {
  it('uses horizontal stretch multiplier on width only', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    const displayScale = BRIDGE_GROUND_BASE_DISPLAY_SCALE;
    applyIsoBridgeTileSprite(sprite as never, displayScale);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * displayScale * BRIDGE_TILE_DISPLAY_SCALE_X,
      TILE_HEIGHT * displayScale * BRIDGE_TILE_DISPLAY_SCALE_Y
    );
  });

  it('keeps bridge scaleY at 1.2 and scaleX at 1.05', () => {
    expect(BRIDGE_TILE_DISPLAY_SCALE_X).toBe(1.05);
    expect(BRIDGE_TILE_DISPLAY_SCALE_Y).toBe(1.2);
  });

  it('nudges bridge sprite up by 20% of rendered tile height', () => {
    const displayScale = BRIDGE_GROUND_BASE_DISPLAY_SCALE;
    expect(BRIDGE_TILE_DISPLAY_OFFSET_Y).toBe(-0.20);
    expect(getBridgeTileDisplayOffset(displayScale)).toEqual({
      dx: 0,
      dy: BRIDGE_TILE_DISPLAY_OFFSET_Y * TILE_HEIGHT * displayScale,
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoTileSprite,
  GROUND_TILE_SEAM_SCALE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../src/utils/iso';

describe('land ground tile display', () => {
  it('uses reduced seam scale for grass, path, and soil tiles', () => {
    expect(GROUND_TILE_SEAM_SCALE).toBe(1.01);
  });

  it('stretches land tiles to the scaled iso diamond footprint', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyIsoTileSprite(sprite as never, GROUND_TILE_SEAM_SCALE);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * GROUND_TILE_SEAM_SCALE,
      TILE_HEIGHT * GROUND_TILE_SEAM_SCALE
    );
  });
});

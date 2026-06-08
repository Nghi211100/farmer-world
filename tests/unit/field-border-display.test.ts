import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoFieldBorderSprite,
  applyIsoTileSprite,
  FIELD_BORDER_SCALE_Y_OFFSET,
  getFieldBorderDisplayScaleY,
  GROUND_TILE_SEAM_SCALE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../src/utils/iso';

describe('field border display', () => {
  it('adds +0.1 scaleY offset on top of ground seam scale', () => {
    expect(FIELD_BORDER_SCALE_Y_OFFSET).toBe(0.1);
    expect(getFieldBorderDisplayScaleY(GROUND_TILE_SEAM_SCALE)).toBe(
      GROUND_TILE_SEAM_SCALE + FIELD_BORDER_SCALE_Y_OFFSET
    );
  });

  it('applyIsoFieldBorderSprite uses taller scaleY than applyIsoTileSprite', () => {
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

    sprite.setDisplaySize.mockClear();
    applyIsoFieldBorderSprite(sprite as never, GROUND_TILE_SEAM_SCALE);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * GROUND_TILE_SEAM_SCALE,
      TILE_HEIGHT * (GROUND_TILE_SEAM_SCALE + FIELD_BORDER_SCALE_Y_OFFSET)
    );
  });
});

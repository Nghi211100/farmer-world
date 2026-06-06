import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoFaceToFaceWaterSprite,
  isWaterFaceToFaceTextureKey,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_FACE_TO_FACE_DISPLAY_SCALE_X,
  WATER_FACE_TO_FACE_LEFT_TEXTURE_KEY,
  WATER_FACE_TO_FACE_RIGHT_TEXTURE_KEY,
} from '../../src/utils/iso';

describe('water face-to-face tile display', () => {
  it('narrows horizontal footprint by 0.15 vs uniform iso scale', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    const displayScale = 1.27;
    applyIsoFaceToFaceWaterSprite(sprite as never, displayScale);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * displayScale * WATER_FACE_TO_FACE_DISPLAY_SCALE_X,
      TILE_HEIGHT * displayScale
    );
  });

  it('uses scaleX multiplier 0.85 (default 1.0 − 0.15)', () => {
    expect(WATER_FACE_TO_FACE_DISPLAY_SCALE_X).toBe(0.85);
  });

  it('matches only the two face-to-face water texture keys', () => {
    expect(isWaterFaceToFaceTextureKey(WATER_FACE_TO_FACE_LEFT_TEXTURE_KEY)).toBe(true);
    expect(isWaterFaceToFaceTextureKey(WATER_FACE_TO_FACE_RIGHT_TEXTURE_KEY)).toBe(true);
    expect(isWaterFaceToFaceTextureKey('water_2_borders_left')).toBe(false);
    expect(isWaterFaceToFaceTextureKey('water')).toBe(false);
  });
});

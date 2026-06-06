import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoWater2BordersLeftRightSprite,
  getWater2BordersDisplayOffset,
  getWater2BordersLeftRightScaleX,
  getWater2BordersLeftRightScaleY,
  isWater2BordersLeftRightTextureKey,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_2_BORDERS_LEFT_OFFSET_X,
  WATER_2_BORDERS_LEFT_OFFSET_Y,
  WATER_2_BORDERS_LEFT_RIGHT_SCALE_X,
  WATER_2_BORDERS_LEFT_SCALE_X,
  WATER_2_BORDERS_LEFT_SCALE_Y,
  WATER_2_BORDERS_LEFT_TEXTURE_KEY,
  WATER_2_BORDERS_RIGHT_OFFSET_X,
  WATER_2_BORDERS_RIGHT_OFFSET_Y,
  WATER_2_BORDERS_RIGHT_SCALE_Y,
  WATER_2_BORDERS_RIGHT_TEXTURE_KEY,
} from '../../src/utils/iso';

describe('water 2-borders left/right tile display', () => {
  it('narrows horizontal footprint by 0.15 and uses reduced vertical scale for left', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    const displayScale = 1.27;
    applyIsoWater2BordersLeftRightSprite(sprite as never, displayScale, WATER_2_BORDERS_LEFT_TEXTURE_KEY);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * displayScale * WATER_2_BORDERS_LEFT_SCALE_X,
      TILE_HEIGHT * displayScale * WATER_2_BORDERS_LEFT_SCALE_Y
    );
  });

  it('narrows horizontal footprint by 0.15 and uses reduced vertical scale for right', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    const displayScale = 1.27;
    applyIsoWater2BordersLeftRightSprite(sprite as never, displayScale, WATER_2_BORDERS_RIGHT_TEXTURE_KEY);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * displayScale * WATER_2_BORDERS_LEFT_RIGHT_SCALE_X,
      TILE_HEIGHT * displayScale * WATER_2_BORDERS_RIGHT_SCALE_Y
    );
  });

  it('uses left scaleX 0.85, right scaleX 0.85; left scaleY 0.97, right scaleY 0.97', () => {
    expect(WATER_2_BORDERS_LEFT_SCALE_X).toBe(0.85);
    expect(WATER_2_BORDERS_LEFT_RIGHT_SCALE_X).toBe(0.85);
    expect(WATER_2_BORDERS_LEFT_SCALE_Y).toBe(0.97);
    expect(WATER_2_BORDERS_RIGHT_SCALE_Y).toBe(0.97);
    expect(getWater2BordersLeftRightScaleX(WATER_2_BORDERS_LEFT_TEXTURE_KEY)).toBe(0.85);
    expect(getWater2BordersLeftRightScaleX(WATER_2_BORDERS_RIGHT_TEXTURE_KEY)).toBe(0.85);
    expect(getWater2BordersLeftRightScaleY(WATER_2_BORDERS_LEFT_TEXTURE_KEY)).toBe(0.97);
    expect(getWater2BordersLeftRightScaleY(WATER_2_BORDERS_RIGHT_TEXTURE_KEY)).toBe(0.97);
  });

  it('nudges water_2_borders_left up by 1% and left by 3% of rendered tile size', () => {
    const displayScale = 1.27;
    expect(WATER_2_BORDERS_LEFT_OFFSET_X).toBe(-0.03);
    expect(WATER_2_BORDERS_LEFT_OFFSET_Y).toBe(-0.01);
    expect(getWater2BordersDisplayOffset(WATER_2_BORDERS_LEFT_TEXTURE_KEY, displayScale)).toEqual({
      dx: WATER_2_BORDERS_LEFT_OFFSET_X * TILE_WIDTH * displayScale,
      dy: WATER_2_BORDERS_LEFT_OFFSET_Y * TILE_HEIGHT * displayScale,
    });
  });

  it('nudges water_2_borders_right up by 4% and right by 5% of rendered tile size', () => {
    const displayScale = 1.27;
    expect(WATER_2_BORDERS_RIGHT_OFFSET_X).toBe(0.05);
    expect(WATER_2_BORDERS_RIGHT_OFFSET_Y).toBe(-0.04);
    expect(getWater2BordersDisplayOffset(WATER_2_BORDERS_RIGHT_TEXTURE_KEY, displayScale)).toEqual({
      dx: WATER_2_BORDERS_RIGHT_OFFSET_X * TILE_WIDTH * displayScale,
      dy: WATER_2_BORDERS_RIGHT_OFFSET_Y * TILE_HEIGHT * displayScale,
    });
  });

  it('matches only the two left/right water border texture keys', () => {
    expect(isWater2BordersLeftRightTextureKey(WATER_2_BORDERS_LEFT_TEXTURE_KEY)).toBe(true);
    expect(isWater2BordersLeftRightTextureKey(WATER_2_BORDERS_RIGHT_TEXTURE_KEY)).toBe(true);
    expect(isWater2BordersLeftRightTextureKey('water_2_borders_face_to_face_left')).toBe(false);
    expect(isWater2BordersLeftRightTextureKey('water_2_borders_top')).toBe(false);
  });
});

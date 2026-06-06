import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoWater1BorderSprite,
  getWater1BorderDisplayScaleY,
  getWater1BorderDisplayOffset,
  isWater1BorderTextureKey,
  isWater1BorderTopTextureKey,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY,
  WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY,
  WATER_1_BORDER_DISPLAY_SCALE,
  WATER_1_BORDER_OFFSET_Y,
  WATER_1_BORDER_TOP_OFFSET_Y,
  WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY,
  WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY,
  WATER_1_BORDER_TOP_SCALE_Y,
  WATER_1_BORDER_TOP_SCALE_Y_OFFSET,
  WATER_FLAT_DISPLAY_SCALE,
} from '../../src/utils/iso';
import {
  applyWaterGroundTileSprite,
  getWater1BorderDisplayScale,
  getWaterTextureDisplayOffset,
  getWaterTextureUniformDisplayScale,
  resolveWaterGroundDisplayScale,
} from '../../src/utils/waterAutotile';

describe('water 1-border tile display', () => {
  it('uses flat water scale + 0.1 as uniform base for all water_1_border variants', () => {
    expect(WATER_1_BORDER_DISPLAY_SCALE).toBe(WATER_FLAT_DISPLAY_SCALE + 0.1);
    expect(WATER_1_BORDER_DISPLAY_SCALE).toBe(1.145);
    expect(getWater1BorderDisplayScale()).toBe(WATER_1_BORDER_DISPLAY_SCALE);
    expect(getWaterTextureUniformDisplayScale(WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(getWaterTextureUniformDisplayScale(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(getWaterTextureUniformDisplayScale(WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(getWaterTextureUniformDisplayScale(WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(resolveWaterGroundDisplayScale(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY, false)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
  });

  it('adds +0.15 scaleY only for water_1_border_top-* variants', () => {
    expect(WATER_1_BORDER_TOP_SCALE_Y_OFFSET).toBe(0.15);
    expect(WATER_1_BORDER_TOP_SCALE_Y).toBe(WATER_1_BORDER_DISPLAY_SCALE + 0.15);
    expect(WATER_1_BORDER_TOP_SCALE_Y).toBe(1.295);

    expect(isWater1BorderTopTextureKey(WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTopTextureKey(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTopTextureKey(WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY)).toBe(false);
    expect(isWater1BorderTopTextureKey(WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY)).toBe(false);

    expect(getWater1BorderDisplayScaleY(WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_TOP_SCALE_Y
    );
    expect(getWater1BorderDisplayScaleY(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_TOP_SCALE_Y
    );
    expect(getWater1BorderDisplayScaleY(WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(getWater1BorderDisplayScaleY(WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY)).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
  });

  it('applyIsoWater1BorderSprite uses taller scaleY for top variants only', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyIsoWater1BorderSprite(
      sprite as never,
      WATER_1_BORDER_DISPLAY_SCALE,
      WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY
    );
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_1_BORDER_DISPLAY_SCALE,
      TILE_HEIGHT * WATER_1_BORDER_TOP_SCALE_Y
    );

    sprite.setDisplaySize.mockClear();
    applyIsoWater1BorderSprite(
      sprite as never,
      WATER_1_BORDER_DISPLAY_SCALE,
      WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY
    );
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_1_BORDER_DISPLAY_SCALE,
      TILE_HEIGHT * WATER_1_BORDER_DISPLAY_SCALE
    );
  });

  it('applyWaterGroundTileSprite delegates water_1_border top scaleY to applyIsoWater1BorderSprite', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyWaterGroundTileSprite(
      sprite as never,
      WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY,
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_1_BORDER_DISPLAY_SCALE,
      TILE_HEIGHT * WATER_1_BORDER_TOP_SCALE_Y
    );
  });

  it('nudges water_1_border top variants 5% higher than bottom variants', () => {
    expect(WATER_1_BORDER_OFFSET_Y).toBe(0.12);
    expect(WATER_1_BORDER_TOP_OFFSET_Y).toBe(0.07);
    const bottomExpected = { dx: 0, dy: WATER_1_BORDER_OFFSET_Y * TILE_HEIGHT };
    const topExpected = { dx: 0, dy: WATER_1_BORDER_TOP_OFFSET_Y * TILE_HEIGHT };
    expect(getWater1BorderDisplayOffset(WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY)).toEqual(topExpected);
    expect(getWater1BorderDisplayOffset(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toEqual(topExpected);
    expect(getWater1BorderDisplayOffset(WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY)).toEqual(
      bottomExpected
    );
    expect(getWater1BorderDisplayOffset(WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY)).toEqual(
      bottomExpected
    );
  });

  it('matches only the four water_1_border texture keys', () => {
    expect(isWater1BorderTextureKey(WATER_1_BORDER_TOP_LEFT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTextureKey(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTextureKey(WATER_1_BORDER_BOTTOM_LEFT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTextureKey(WATER_1_BORDER_BOTTOM_RIGHT_TEXTURE_KEY)).toBe(true);
    expect(isWater1BorderTextureKey('water_2_borders_top')).toBe(false);
    expect(isWater1BorderTextureKey('water')).toBe(false);
  });

  it('returns zero offset for non water_1_border keys', () => {
    expect(getWater1BorderDisplayOffset('water')).toEqual({ dx: 0, dy: 0 });
  });

  it('delegates water_1_border offset via getWaterTextureDisplayOffset', () => {
    expect(getWaterTextureDisplayOffset(WATER_1_BORDER_TOP_RIGHT_TEXTURE_KEY)).toEqual({
      dx: 0,
      dy: WATER_1_BORDER_TOP_OFFSET_Y * TILE_HEIGHT,
    });
    expect(getWaterTextureDisplayOffset('water_2_borders_left')).toBeNull();
  });
});

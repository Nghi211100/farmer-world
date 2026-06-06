import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoTileSprite,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_1_BORDER_DISPLAY_SCALE,
  WATER_FLAT_DISPLAY_SCALE,
  WATER_FACE_TO_FACE_LEFT_TEXTURE_KEY,
  WATER_2_BORDERS_LEFT_TEXTURE_KEY,
} from '../../src/utils/iso';
import {
  applyWaterGroundTileSprite,
  getWater1BorderDisplayScale,
  getWaterFlatDisplayScale,
  getWaterGroundDisplayScale,
  getWaterTextureUniformDisplayScale,
  resolveWaterGroundDisplayScale,
} from '../../src/utils/waterAutotile';

describe('flat water tile display', () => {
  it('scales flat water 0.225 smaller than shore/border water ground scale', () => {
    expect(WATER_FLAT_DISPLAY_SCALE).toBeCloseTo(getWaterGroundDisplayScale() - 0.225);
  });

  it('applyIsoTileSprite uses flat water display scale', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
    };
    const displayScale = getWaterFlatDisplayScale();
    applyIsoTileSprite(sprite as never, displayScale);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * displayScale,
      TILE_HEIGHT * displayScale
    );
  });

  it('getWaterFlatDisplayScale returns WATER_FLAT_DISPLAY_SCALE', () => {
    expect(getWaterFlatDisplayScale()).toBe(WATER_FLAT_DISPLAY_SCALE);
    expect(WATER_FLAT_DISPLAY_SCALE).toBe(1.045);
  });

  it('getWaterTextureUniformDisplayScale matches placed-tile scale rules', () => {
    expect(getWaterTextureUniformDisplayScale('water')).toBe(WATER_FLAT_DISPLAY_SCALE);
    expect(getWaterTextureUniformDisplayScale('water_1_border_bottom-right')).toBe(
      WATER_1_BORDER_DISPLAY_SCALE
    );
    expect(getWaterTextureUniformDisplayScale('water_3_border_left_top')).toBe(
      WATER_FLAT_DISPLAY_SCALE
    );
    expect(getWaterTextureUniformDisplayScale(WATER_2_BORDERS_LEFT_TEXTURE_KEY)).toBe(
      getWaterGroundDisplayScale()
    );
    expect(getWaterTextureUniformDisplayScale(WATER_FACE_TO_FACE_LEFT_TEXTURE_KEY)).toBe(
      getWaterGroundDisplayScale()
    );
    expect(getWaterTextureUniformDisplayScale('water_2_borders_top')).toBe(
      WATER_FLAT_DISPLAY_SCALE
    );
  });

  it('resolveWaterGroundDisplayScale bumps scale on farm island', () => {
    expect(resolveWaterGroundDisplayScale('water', false)).toBe(WATER_FLAT_DISPLAY_SCALE);
    expect(resolveWaterGroundDisplayScale('water', true)).toBeGreaterThanOrEqual(1.01);
  });

  it('applyWaterGroundTileSprite uses flat scale for interior water', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyWaterGroundTileSprite(sprite as never, 'water', WATER_FLAT_DISPLAY_SCALE);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_FLAT_DISPLAY_SCALE,
      TILE_HEIGHT * WATER_FLAT_DISPLAY_SCALE
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoBottomBorderWaterSprite,
  applyIsoTopBorderWaterSprite,
  getWater2BordersTopBottomDisplayOffset,
  isWater2BordersTopBottomTextureKey,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_2_BORDERS_BOTTOM_OFFSET_X,
  WATER_2_BORDERS_BOTTOM_OFFSET_Y,
  WATER_2_BORDERS_BOTTOM_TEXTURE_KEY,
  WATER_2_BORDERS_TOP_OFFSET_X,
  WATER_2_BORDERS_TOP_OFFSET_Y,
  WATER_2_BORDERS_TOP_TEXTURE_KEY,
  WATER_BOTTOM_BORDER_MEO_SCALE,
  WATER_BOTTOM_BORDER_SIZE_SCALE,
  WATER_TOP_BORDER_MEO_SCALE,
  WATER_TOP_BORDER_SIZE_SCALE,
} from '../../src/utils/iso';

describe('water 2-borders top/bottom tile display', () => {
  it('uses size/méo scale for top border (1.09, 1.20)', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyIsoTopBorderWaterSprite(sprite as never);
    expect(WATER_TOP_BORDER_SIZE_SCALE).toBe(1.09);
    expect(WATER_TOP_BORDER_MEO_SCALE).toBe(1.20);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_TOP_BORDER_SIZE_SCALE,
      TILE_HEIGHT * WATER_TOP_BORDER_MEO_SCALE
    );
  });

  it('uses size/méo scale for bottom border (1.09, 1.25)', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyIsoBottomBorderWaterSprite(sprite as never);
    expect(WATER_BOTTOM_BORDER_SIZE_SCALE).toBe(1.09);
    expect(WATER_BOTTOM_BORDER_MEO_SCALE).toBe(1.25);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * WATER_BOTTOM_BORDER_SIZE_SCALE,
      TILE_HEIGHT * WATER_BOTTOM_BORDER_MEO_SCALE
    );
  });

  it('nudges water_2_borders_top left by 1% and up by 5% of tile size', () => {
    expect(WATER_2_BORDERS_TOP_OFFSET_X).toBe(-0.01);
    expect(WATER_2_BORDERS_TOP_OFFSET_Y).toBe(-0.05);
    expect(getWater2BordersTopBottomDisplayOffset(WATER_2_BORDERS_TOP_TEXTURE_KEY)).toEqual({
      dx: WATER_2_BORDERS_TOP_OFFSET_X * TILE_WIDTH,
      dy: WATER_2_BORDERS_TOP_OFFSET_Y * TILE_HEIGHT,
    });
  });

  it('nudges water_2_borders_bottom down by 12% of tile size with no horizontal offset', () => {
    expect(WATER_2_BORDERS_BOTTOM_OFFSET_X).toBe(0.00);
    expect(WATER_2_BORDERS_BOTTOM_OFFSET_Y).toBeCloseTo(0.075);
    expect(getWater2BordersTopBottomDisplayOffset(WATER_2_BORDERS_BOTTOM_TEXTURE_KEY)).toEqual({
      dx: WATER_2_BORDERS_BOTTOM_OFFSET_X * TILE_WIDTH,
      dy: WATER_2_BORDERS_BOTTOM_OFFSET_Y * TILE_HEIGHT,
    });
  });

  it('matches only the two top/bottom water border texture keys', () => {
    expect(isWater2BordersTopBottomTextureKey(WATER_2_BORDERS_TOP_TEXTURE_KEY)).toBe(true);
    expect(isWater2BordersTopBottomTextureKey(WATER_2_BORDERS_BOTTOM_TEXTURE_KEY)).toBe(true);
    expect(isWater2BordersTopBottomTextureKey('water_2_borders_left')).toBe(false);
    expect(isWater2BordersTopBottomTextureKey('water_2_borders_right')).toBe(false);
  });
});

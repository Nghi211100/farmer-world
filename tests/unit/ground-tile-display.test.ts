import { describe, expect, it, vi } from 'vitest';
import {
  applyIsoPathGroundSprite,
  applyIsoTileSprite,
  getRoadCornerVerticalDisplayOffset,
  GROUND_TILE_SEAM_SCALE,
  ROAD_CORNER_DOWN_SCALE_X_OFFSET,
  ROAD_CORNER_DOWN_TEXTURE_KEY,
  ROAD_CORNER_UP_TEXTURE_KEY,
  ROAD_CORNER_VERTICAL_OFFSET_Y,
  ROAD_CORNER_VERTICAL_SCALE_X_OFFSET,
  ROAD_CORNER_VERTICAL_SCALE_Y_OFFSET,
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

  it('applies custom scaleX/scaleY only for vertical road corner path tiles', () => {
    const sprite = {
      setOrigin: vi.fn(),
      setDisplaySize: vi.fn(),
      resetCrop: vi.fn(),
    };
    applyIsoPathGroundSprite(sprite as never, GROUND_TILE_SEAM_SCALE, 'path');
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * GROUND_TILE_SEAM_SCALE,
      TILE_HEIGHT * GROUND_TILE_SEAM_SCALE
    );

    sprite.setDisplaySize.mockClear();
    applyIsoPathGroundSprite(sprite as never, GROUND_TILE_SEAM_SCALE, ROAD_CORNER_UP_TEXTURE_KEY);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH * (GROUND_TILE_SEAM_SCALE + ROAD_CORNER_VERTICAL_SCALE_X_OFFSET),
      TILE_HEIGHT * (GROUND_TILE_SEAM_SCALE + ROAD_CORNER_VERTICAL_SCALE_Y_OFFSET)
    );

    sprite.setDisplaySize.mockClear();
    applyIsoPathGroundSprite(sprite as never, GROUND_TILE_SEAM_SCALE, ROAD_CORNER_DOWN_TEXTURE_KEY);
    expect(sprite.setDisplaySize).toHaveBeenCalledWith(
      TILE_WIDTH *
        (GROUND_TILE_SEAM_SCALE +
          ROAD_CORNER_VERTICAL_SCALE_X_OFFSET +
          ROAD_CORNER_DOWN_SCALE_X_OFFSET),
      TILE_HEIGHT * (GROUND_TILE_SEAM_SCALE + ROAD_CORNER_VERTICAL_SCALE_Y_OFFSET)
    );
    expect(ROAD_CORNER_VERTICAL_SCALE_X_OFFSET).toBe(-0.05);
    expect(ROAD_CORNER_DOWN_SCALE_X_OFFSET).toBe(0.05);
    expect(ROAD_CORNER_VERTICAL_SCALE_Y_OFFSET).toBe(0.07);
  });

  it('nudges vertical road corners up by 1% of rendered tile height', () => {
    expect(ROAD_CORNER_VERTICAL_OFFSET_Y).toBe(-0.01);
    expect(getRoadCornerVerticalDisplayOffset('path', GROUND_TILE_SEAM_SCALE)).toEqual({
      dx: 0,
      dy: 0,
    });
    for (const textureKey of [ROAD_CORNER_UP_TEXTURE_KEY, ROAD_CORNER_DOWN_TEXTURE_KEY]) {
      expect(getRoadCornerVerticalDisplayOffset(textureKey, GROUND_TILE_SEAM_SCALE)).toEqual({
        dx: 0,
        dy: ROAD_CORNER_VERTICAL_OFFSET_Y * TILE_HEIGHT * GROUND_TILE_SEAM_SCALE,
      });
    }
  });
});
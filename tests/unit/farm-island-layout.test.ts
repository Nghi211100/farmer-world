import { describe, expect, it, vi } from 'vitest';
import {
  FARM_ISLAND_OFFSET_X_FRAC,
  FARM_ISLAND_OFFSET_Y_FRAC,
  FARM_ISLAND_SCALE_BOOST,
  computeFarmIslandScreenBounds,
  layoutFarmIslandImage,
  type FarmSoilScreenRhombus,
} from '../../src/farmIslandLayout';
import { computeCoverDisplaySize } from '../../src/backgroundLayout';

const unitRhombus = (): FarmSoilScreenRhombus => ({
  north: { x: 100, y: 80 },
  east: { x: 140, y: 120 },
  south: { x: 100, y: 160 },
  west: { x: 60, y: 120 },
  center: { x: 100, y: 120 },
});

describe('farmIslandLayout', () => {
  it('default offsets are 6% right and 33% down of rhombus spans from center', () => {
    expect(FARM_ISLAND_OFFSET_X_FRAC).toBe(0.06);
    expect(FARM_ISLAND_OFFSET_Y_FRAC).toBe(0.33);
    expect(FARM_ISLAND_SCALE_BOOST).toBe(4.345);
  });

  it('cover display size uses boosted rhombus spans', () => {
    const rhombus = unitRhombus();
    const boost = FARM_ISLAND_SCALE_BOOST;
    const targetW = (rhombus.east.x - rhombus.west.x) * boost;
    const targetH = (rhombus.south.y - rhombus.north.y) * boost;
    const texW = 512;
    const texH = 512;
    const { displayW, displayH } = computeCoverDisplaySize(texW, texH, targetW, targetH);
    expect(displayW).toBeGreaterThanOrEqual(targetW);
    expect(displayH).toBeGreaterThanOrEqual(targetH);
    expect(displayW / displayH).toBeCloseTo(texW / texH, 5);
  });

  it('computeFarmIslandScreenBounds spans wider than soil rhombus', () => {
    const rhombus = unitRhombus();
    const bounds = computeFarmIslandScreenBounds(rhombus, 512, 512);
    const rhombusW = rhombus.east.x - rhombus.west.x;
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(rhombusW * 2);
  });

  it('layoutFarmIslandImage centers on rhombus and sets uniform display size', () => {
    const rhombus = unitRhombus();
    const texW = 400;
    const texH = 300;
    const boost = 1.5;
    const spanW = rhombus.east.x - rhombus.west.x;
    const spanH = rhombus.south.y - rhombus.north.y;
    const targetW = spanW * boost;
    const targetH = spanH * boost;
    const expected = computeCoverDisplaySize(texW, texH, targetW, targetH);

    const image = {
      setCrop: () => {},
      setOrigin: vi.fn(),
      setPosition: vi.fn(),
      setScrollFactor: vi.fn(),
      setDisplaySize: vi.fn(),
    } as unknown as Phaser.GameObjects.Image;

    layoutFarmIslandImage(image, rhombus, texW, texH, { scaleBoost: boost });

    expect(image.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(image.setPosition).toHaveBeenCalledWith(
      rhombus.center.x + spanW * FARM_ISLAND_OFFSET_X_FRAC,
      rhombus.center.y + spanH * FARM_ISLAND_OFFSET_Y_FRAC
    );
    expect(image.setScrollFactor).toHaveBeenCalledWith(1);
    expect(image.setDisplaySize).toHaveBeenCalledWith(expected.displayW, expected.displayH);
  });
});

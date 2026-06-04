import { describe, expect, it } from 'vitest';
import type { LivestockPenData } from '../../src/config/LivestockConfig';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { ObjectEditSystem } from '../../src/systems/ObjectEditSystem';
import {
  isCellInFarmSoilBounds,
  isGridOnMoveSessionOrigin,
  objectMovePickupScale,
  OBJECT_MOVE_LONG_PRESS_MS,
  OBJECT_MOVE_PICKUP_SCALE_X,
  OBJECT_MOVE_PICKUP_SCALE_Y,
} from '../../src/utils/objectMoveDrag';

describe('objectMoveDrag', () => {
  it('uses short long-press and subtle pickup squash scale', () => {
    expect(OBJECT_MOVE_LONG_PRESS_MS).toBe(75);
    expect(OBJECT_MOVE_PICKUP_SCALE_X).toBe(1.02);
    expect(OBJECT_MOVE_PICKUP_SCALE_Y).toBe(0.95);
    expect(objectMovePickupScale(1, 1)).toEqual({ scaleX: 1.02, scaleY: 0.95 });
  });

  it('detects farm soil bounds', () => {
    expect(isCellInFarmSoilBounds(FARM_SOIL_BOUNDS.minX, FARM_SOIL_BOUNDS.minY)).toBe(
      true
    );
    expect(isCellInFarmSoilBounds(FARM_SOIL_BOUNDS.minX - 1, FARM_SOIL_BOUNDS.minY)).toBe(
      false
    );
  });

  it('matches pen footprint for long-press origin', () => {
    const pen: LivestockPenData = {
      id: 'pen-sheep-1',
      animalType: 'sheep',
      gridX: 7,
      gridY: 9,
      state: 'idle',
      level: 1,
    };
    const session = {
      originGx: 7,
      originGy: 9,
      payload: { kind: 'pen' as const, pen },
    };
    expect(isGridOnMoveSessionOrigin(session, 7, 9)).toBe(true);
    expect(isGridOnMoveSessionOrigin(session, 8, 9)).toBe(true);
    expect(isGridOnMoveSessionOrigin(session, 7, 12)).toBe(false);
  });

  it('matches ghost preview footprint after drag without save', () => {
    const pen: LivestockPenData = {
      id: 'pen-sheep-1',
      animalType: 'sheep',
      gridX: 7,
      gridY: 9,
      state: 'idle',
      level: 1,
    };
    const session = {
      originGx: 7,
      originGy: 9,
      payload: { kind: 'pen' as const, pen },
    };
    expect(isGridOnMoveSessionOrigin(session, 8, 9, 8, 9)).toBe(true);
    expect(isGridOnMoveSessionOrigin(session, 7, 9, 8, 9)).toBe(true);
    expect(isGridOnMoveSessionOrigin(session, 11, 9, 8, 9)).toBe(false);
  });
});

describe('ObjectEditSystem move placement', () => {
  it('rejects moving naturals onto farm soil', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const edit = new ObjectEditSystem(grid, new BuildSystem(grid));
    const soilGx = FARM_SOIL_BOUNDS.minX;
    const soilGy = FARM_SOIL_BOUNDS.minY;
    expect(grid.getCell(soilGx, soilGy)?.type).toBe('soil');

    grid.setCell(2, 2, { type: 'grass', walkable: true });
    grid.setObject(2, 2, 'rock_01');
    const naturalGx = 2;
    const naturalGy = 2;
    expect(naturalGx).toBeGreaterThanOrEqual(0);
    edit.beginMove(naturalGx, naturalGy);
    expect(edit.canPlaceAt(soilGx, soilGy)).toBe(false);
  });
});

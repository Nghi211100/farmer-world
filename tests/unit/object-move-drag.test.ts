import { describe, expect, it } from 'vitest';
import type { LivestockPenData } from '../../src/config/LivestockConfig';
import { FARM_SOIL_BOUNDS } from '../../src/config/gameConfig';
import { BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
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

  it('duck pen long-press drag uses footprint only, not grass ring', () => {
    const pen: LivestockPenData = {
      id: 'pen-duck-1',
      animalType: 'duck',
      gridX: 8,
      gridY: 8,
      state: 'idle',
      level: 1,
    };
    const session = {
      originGx: 8,
      originGy: 8,
      payload: { kind: 'pen' as const, pen },
    };
    expect(isGridOnMoveSessionOrigin(session, 7, 8)).toBe(false);
    expect(isGridOnMoveSessionOrigin(session, 8, 8)).toBe(true);
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
  it('keeps preview locked until startMoveDrag (Move button must not auto-drag)', () => {
    const grid = new GridSystem();
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true });
        }
      }
    }
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }
    const livestock = new LivestockSystem(grid);
    const edit = new ObjectEditSystem(grid, new BuildSystem(grid), livestock);
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const placed = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(placed).not.toBeNull();
    const session = edit.beginMove(8, 8);
    expect(session?.payload.kind).toBe('pen');
    expect(edit.previewLocked).toBe(true);
    expect(edit.moveDragging).toBe(false);
    edit.startMoveDrag();
    expect(edit.previewLocked).toBe(false);
    expect(edit.moveDragging).toBe(true);
    edit.finishMoveDrag();
    expect(edit.previewLocked).toBe(true);
    expect(edit.moveDragging).toBe(false);
  });

  it('finds pen on footprint but not on grass ring outside', () => {
    const grid = new GridSystem();
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true });
        }
      }
    }
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }
    const livestock = new LivestockSystem(grid);
    const edit = new ObjectEditSystem(grid, new BuildSystem(grid), livestock);
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const placed = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(placed).not.toBeNull();
    expect(edit.findEditableAt(8, 8)?.kind).toBe('pen');
    expect(edit.findEditableAt(7, 8)).toBeNull();
    expect(livestock.getPenAtFootprint(7, 8)).toBeUndefined();
    expect(livestock.getPenAt(7, 8)).toBeUndefined();
  });
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

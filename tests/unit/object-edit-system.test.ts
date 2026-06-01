import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS, BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { ObjectEditSystem } from '../../src/systems/ObjectEditSystem';

describe('ObjectEditSystem', () => {
  it('finds naturals and buildings on editable tiles', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const edit = new ObjectEditSystem(grid, build);

    expect(edit.findEditableAt(1, 9)?.kind).toBe('natural');
    expect(edit.findEditableAt(99, 99)).toBeNull();

    build.enterBuildMode(BUILD_ITEMS[0]);
    const placed = build.place(8, 8);
    expect(placed).not.toBeNull();
    expect(edit.findEditableAt(8, 8)?.kind).toBe('building');
  });

  it('does not treat locked soil objects as editable', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const edit = new ObjectEditSystem(grid, new BuildSystem(grid));

    let lockedWithObject = false;
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.isLockedSoil(x, y) && grid.getCell(x, y)?.object) {
          lockedWithObject = true;
          expect(edit.findEditableAt(x, y)).toBeNull();
        }
      }
    }
    expect(lockedWithObject).toBe(false);
  });

  it('removes naturals and buildings', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const edit = new ObjectEditSystem(grid, build);

    expect(edit.removeAt(1, 9)).toBe(true);
    expect(grid.getCell(1, 9)?.object).toBeUndefined();

    build.enterBuildMode(BUILD_ITEMS[0]);
    build.place(6, 6);
    expect(edit.removeAt(6, 6)).toBe(true);
    expect(build.findBuildingAt(6, 6)).toBeNull();
  });

  it('moves building and natural to a new tile', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const edit = new ObjectEditSystem(grid, build);

    const session = edit.beginMove(5, 15);
    expect(session?.payload.kind).toBe('natural');
    let destGx = -1;
    let destGy = -1;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const gx = 5 + dx;
        const gy = 15 + dy;
        if (gx === 5 && gy === 15) continue;
        if (build.canPlaceObjectAt(gx, gy)) {
          destGx = gx;
          destGy = gy;
          break;
        }
      }
      if (destGx >= 0) break;
    }
    expect(destGx).toBeGreaterThanOrEqual(0);
    edit.lockPreviewAt(destGx, destGy);
    expect(edit.confirmMoveAt(destGx, destGy)).toBe(true);
    expect(grid.getCell(destGx, destGy)?.object).toBe('rock_01');
    expect(grid.getCell(5, 15)?.object).toBeUndefined();

    build.enterBuildMode(BUILD_ITEMS[0]);
    build.place(9, 9);
    edit.beginMove(9, 9);
    edit.lockPreviewAt(10, 9);
    expect(edit.confirmMoveAt(10, 9)).toBe(true);
    expect(build.findBuildingAt(10, 9)?.type).toBe('house');
    expect(build.findBuildingAt(9, 9)).toBeNull();
  });

  it('cancelMove clears session without changing grid', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const edit = new ObjectEditSystem(grid, new BuildSystem(grid));

    const before = grid.getCell(1, 9)?.object;
    edit.beginMove(1, 9);
    edit.cancelMove();
    expect(edit.getSession()).toBeNull();
    expect(grid.getCell(1, 9)?.object).toBe(before);
  });
});

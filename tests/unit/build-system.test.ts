import { describe, expect, it } from 'vitest';
import { BUILD_ITEMS, BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';

describe('BuildSystem placement preview', () => {
  it('locks ghost position and ignores pointer updates while preview is locked', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS[0];

    build.enterBuildMode(item);
    build.updateGhost(5, 5);
    build.lockPreviewAt(7, 8);

    expect(build.previewLocked).toBe(true);
    expect(build.ghostX).toBe(7);
    expect(build.ghostY).toBe(8);

    build.updateGhost(1, 1);
    expect(build.ghostX).toBe(7);
    expect(build.ghostY).toBe(8);
  });

  it('clears preview lock on exitBuildMode', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    build.enterBuildMode(BUILD_ITEMS[1]);
    build.lockPreviewAt(3, 4);
    build.exitBuildMode();

    expect(build.previewLocked).toBe(false);
    expect(build.active).toBe(false);
    expect(build.selectedItem).toBeNull();
  });

  it('unlockPreview allows ghost updates again', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    build.enterBuildMode(BUILD_ITEMS[0]);
    build.lockPreviewAt(5, 5);
    build.unlockPreview();
    build.updateGhost(9, 9);

    expect(build.previewLocked).toBe(false);
    expect(build.ghostX).toBe(9);
    expect(build.ghostY).toBe(9);
  });

  it('findNextPlacementTile picks right then clockwise neighbors', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    build.enterBuildMode(BUILD_ITEMS[0]);

    const origin = { gx: 8, gy: 8 };
    expect(build.canPlace(origin.gx, origin.gy)).toBe(true);

    const rightBlocked = build.findNextPlacementTile(origin.gx, origin.gy);
    expect(rightBlocked).toEqual({ gx: origin.gx + 1, gy: origin.gy });

    build.place(origin.gx, origin.gy);
    const afterPlace = build.findNextPlacementTile(origin.gx, origin.gy);
    expect(afterPlace).toEqual({ gx: origin.gx + 1, gy: origin.gy });
  });
});

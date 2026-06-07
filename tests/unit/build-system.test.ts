import { describe, expect, it } from 'vitest';
import {
  pathTileAngle,
  pathTileIsFlipped,
} from '../../src/config/gameConfig';
import { BUILD_ITEMS, BuildSystem, isRotatableBuildItem } from '../../src/systems/BuildSystem';
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

  it('lockPreviewAt keeps ghost while placeDragging updates position', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS[0];

    build.enterBuildMode(item);
    const spot = build.findFirstValidPlacement();
    expect(spot).not.toBeNull();
    build.lockPreviewAt(spot!.gx, spot!.gy);
    build.startPlaceDrag();
    build.updateGhost(spot!.gx + 2, spot!.gy + 1);
    expect(build.ghostX).toBe(spot!.gx + 2);
    expect(build.ghostY).toBe(spot!.gy + 1);
    build.finishPlaceDrag();
    expect(build.previewLocked).toBe(true);
  });

  it('findFirstValidPlacement returns null when no cell fits', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'House')!;

    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        grid.setCell(gx, gy, { type: 'water', walkable: false });
      }
    }
    build.enterBuildMode(item);
    expect(build.findFirstValidPlacement()).toBeNull();
  });

  it('isGridOnPlaceGhostFootprint matches locked ghost cell', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    build.enterBuildMode(BUILD_ITEMS[0]);
    build.lockPreviewAt(4, 5);
    expect(build.isGridOnPlaceGhostFootprint(4, 5)).toBe(true);
    expect(build.isGridOnPlaceGhostFootprint(3, 5)).toBe(false);
  });

  it('clears preview lock on exitBuildMode', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    build.enterBuildMode(BUILD_ITEMS[1]);
    build.lockPreviewAt(3, 4);
    build.startPlaceDrag();
    build.exitBuildMode();

    expect(build.previewLocked).toBe(false);
    expect(build.placeDragging).toBe(false);
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

    const origin = { gx: 2, gy: 2 };
    expect(build.canPlace(origin.gx, origin.gy)).toBe(true);

    const rightBlocked = build.findNextPlacementTile(origin.gx, origin.gy);
    expect(rightBlocked).toEqual({ gx: origin.gx + 1, gy: origin.gy });

    build.place(origin.gx, origin.gy);
    const afterPlace = build.findNextPlacementTile(origin.gx, origin.gy);
    expect(afterPlace).toEqual({ gx: origin.gx + 1, gy: origin.gy });
  });

  it('rotateGhostPath toggles flip for path and road_corner', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const pathItem = BUILD_ITEMS.find((i) => i.label === 'Path')!;
    const cornerItem = BUILD_ITEMS.find((i) => i.label === 'Road corner')!;
    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;

    expect(isRotatableBuildItem(pathItem)).toBe(true);
    expect(isRotatableBuildItem(cornerItem)).toBe(true);
    expect(isRotatableBuildItem(grassItem)).toBe(false);

    build.enterBuildMode(pathItem);
    expect(build.ghostPathRotation).toBe(0);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(180);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(0);

    build.enterBuildMode(cornerItem);
    expect(build.ghostPathRotation).toBe(0);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(180);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(0);

    build.enterBuildMode(grassItem);
    build.ghostPathRotation = 90;
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(90);
  });

  it('ghostPathRotation persists through drag and after place', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const pathItem = BUILD_ITEMS.find((i) => i.label === 'Path')!;
    build.enterBuildMode(pathItem);
    build.lockPreviewAt(4, 4);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(180);

    build.startPlaceDrag();
    build.updateGhost(5, 4);
    expect(build.ghostPathRotation).toBe(180);
    build.finishPlaceDrag();
    expect(build.ghostPathRotation).toBe(180);

    expect(build.place(5, 4)).toBe(true);
    expect(grid.getCell(5, 4)?.pathRotation).toBe(180);
    expect(build.ghostPathRotation).toBe(180);
  });

  it('places rotatable path tiles with preview rotation on the cell', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const pathItem = BUILD_ITEMS.find((i) => i.label === 'Path')!;
    build.enterBuildMode(pathItem);
    build.lockPreviewAt(4, 4);
    build.rotateGhostPath();
    expect(build.place(4, 4)).toBe(true);
    expect(grid.getCell(4, 4)).toMatchObject({
      type: 'path',
      pathVariant: 'path',
      pathRotation: 180,
    });

    const cornerItem = BUILD_ITEMS.find((i) => i.label === 'Road corner')!;
    build.enterBuildMode(cornerItem);
    build.lockPreviewAt(5, 4);
    build.rotateGhostPath();
    expect(build.place(5, 4)).toBe(true);
    expect(grid.getCell(5, 4)).toMatchObject({
      type: 'path',
      pathVariant: 'road_corner',
      pathRotation: 180,
    });
  });
});

describe('path tile orientation helpers', () => {
  it('path and road_corner use flip (180) not angle', () => {
    expect(pathTileAngle('path', 0)).toBe(0);
    expect(pathTileAngle('path', 180)).toBe(0);
    expect(pathTileIsFlipped('path', 0)).toBe(false);
    expect(pathTileIsFlipped('path', 180)).toBe(true);
    expect(pathTileIsFlipped('path', 90)).toBe(false);

    expect(pathTileAngle('road_corner', 0)).toBe(0);
    expect(pathTileAngle('road_corner', 180)).toBe(0);
    expect(pathTileIsFlipped('road_corner', 0)).toBe(false);
    expect(pathTileIsFlipped('road_corner', 180)).toBe(true);
    expect(pathTileIsFlipped('road_corner', 90)).toBe(false);
  });
});

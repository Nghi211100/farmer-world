import { describe, expect, it } from 'vitest';
import {
  pathTileAngle,
  pathTileFlip,
  pathTileIsFlipped,
  roadCornerFlip,
  roadCornerTextureKey,
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

  it('findFirstValidPlacement picks valid cell nearest to reference', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'Grass')!;

    build.enterBuildMode(item);
    const near = { gx: 12, gy: 11 };
    const spot = build.findFirstValidPlacement(near);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(build.canPlace(spot.gx, spot.gy)).toBe(true);

    let bestDist = Infinity;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (!build.canPlace(gx, gy)) continue;
        const dist = Math.abs(gx - near.gx) + Math.abs(gy - near.gy);
        bestDist = Math.min(bestDist, dist);
      }
    }
    const pickedDist = Math.abs(spot.gx - near.gx) + Math.abs(spot.gy - near.gy);
    expect(pickedDist).toBe(bestDist);
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

  it('rotateGhostPath toggles path 0↔180 and cycles road_corner 0→90→180→270', () => {
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
    expect(build.ghostPathRotation).toBe(90);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(180);
    build.rotateGhostPath();
    expect(build.ghostPathRotation).toBe(270);
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
  it('path uses flipX at 180 only', () => {
    expect(pathTileAngle('path', 0)).toBe(0);
    expect(pathTileAngle('path', 180)).toBe(0);
    expect(pathTileIsFlipped('path', 0)).toBe(false);
    expect(pathTileIsFlipped('path', 180)).toBe(true);
    expect(pathTileFlip('path', 180)).toEqual({ flipX: true, flipY: false });
  });

  it('road_corner maps rotation to texture and flips', () => {
    expect(roadCornerTextureKey(0)).toBe('road_corner');
    expect(roadCornerTextureKey(180)).toBe('road_corner');
    expect(roadCornerTextureKey(90)).toBe('road_corner_up');
    expect(roadCornerTextureKey(270)).toBe('road_corner_down');

    expect(roadCornerFlip(0)).toEqual({ flipX: false, flipY: false });
    expect(roadCornerFlip(180)).toEqual({ flipX: true, flipY: false });
    expect(roadCornerFlip(90)).toEqual({ flipX: false, flipY: false });
    expect(roadCornerFlip(270)).toEqual({ flipX: false, flipY: false });

    expect(pathTileAngle('road_corner', 90)).toBe(0);
    expect(pathTileFlip('road_corner', 270)).toEqual({ flipX: false, flipY: false });
  });

  it('getGroundTextureKey picks road_corner art from pathRotation', () => {
    const grid = new GridSystem(20);
    grid.generatePlaceholderMap();
    grid.setCell(3, 3, {
      type: 'path',
      pathVariant: 'road_corner',
      pathRotation: 90,
    });
    grid.setCell(4, 3, {
      type: 'path',
      pathVariant: 'road_corner',
      pathRotation: 0,
    });
    expect(grid.getGroundTextureKey(3, 3)).toBe('road_corner_up');
    expect(grid.getGroundTextureKey(4, 3)).toBe('road_corner');
  });
});

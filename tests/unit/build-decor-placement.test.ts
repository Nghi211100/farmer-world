import { describe, expect, it } from 'vitest';
import { BUILD_DECOR_COST } from '../../src/config/gameConfig';
import { BUILD_ITEMS, BuildSystem } from '../../src/systems/BuildSystem';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';

describe('Build decor placement (5 coins)', () => {
  it('lists all former map tiles in decor tab at BUILD_DECOR_COST', () => {
    const decor = BUILD_ITEMS.filter((i) => i.category === 'decor');
    expect(decor.every((i) => i.cost === BUILD_DECOR_COST)).toBe(true);
    expect(decor.map((i) => i.label)).toEqual([
      'Grass',
      'Light grass',
      'Flowers',
      'Stone path',
      'Field border',
      'Path',
      'Road corner',
      'Bridge',
      'Water',
      'Tree 1',
      'Tree 2',
      'Tree 3',
      'Rock',
      'Bush',
    ]);
  });

  it('places grass on void and rock as natural object', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);

    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(2, 2)).toBe(true);
    expect(build.place(2, 2)).toBe(true);
    expect(grid.getCell(2, 2)?.type).toBe('grass');

    const rockItem = BUILD_ITEMS.find((i) => i.label === 'Rock')!;
    build.enterBuildMode(grassItem);
    expect(build.place(3, 2)).toBe(true);
    build.enterBuildMode(rockItem);
    expect(build.canPlace(3, 2)).toBe(true);
    expect(build.place(3, 2)).toBe(true);
    expect(grid.getCell(3, 2)?.object).toBe('rock_01');
  });

  it('places field border only adjacent to farm soil', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'Field border')!;

    build.enterBuildMode(item);
    expect(build.canPlace(2, 2)).toBe(false);
    expect(build.canPlace(3, 5)).toBe(true);
    expect(build.place(3, 5)).toBe(true);
    expect(grid.getCell(3, 5)?.type).toBe('path');
    expect(grid.getCell(3, 5)?.pathVariant).toBe('field_border');
  });

  it('autotiles water with top-right border when land is to the north', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(6, 6, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(6, 5, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(6, 7, { type: 'water', walkable: false, object: undefined });
    grid.setCell(5, 6, { type: 'water', walkable: false, object: undefined });
    grid.setCell(7, 6, { type: 'water', walkable: false, object: undefined });

    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'Water')!;
    build.enterBuildMode(item);
    expect(
      grid.getGroundTextureKey(6, 6, { waterPlacementPreview: true })
    ).toBe('water_1_border_top-right');
    expect(build.place(6, 6)).toBe(true);
    expect(grid.getGroundTextureKey(6, 6)).toBe('water_1_border_top-right');
  });

  it('allows bridge on any river water (shore, chain, next to existing bridge)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(10, 9, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(10, 10, { type: 'water', walkable: false, object: undefined });
    grid.setCell(11, 10, {
      type: 'path',
      walkable: true,
      pathVariant: 'bridge_tile',
      object: undefined,
    });
    grid.setCell(12, 10, { type: 'water', walkable: false, object: undefined });
    grid.setCell(13, 10, { type: 'water', walkable: false, object: undefined });

    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(item);

    expect(grid.isRiverWaterCell(10, 10)).toBe(true);
    expect(build.canPlace(10, 10)).toBe(true);
    expect(build.canPlace(12, 10)).toBe(true);
    expect(build.canPlace(13, 10)).toBe(true);
    expect(build.canPlace(11, 10)).toBe(false);
    expect(build.canPlace(10, 9)).toBe(false);
    expect(build.place(12, 10)).toBe(true);
    expect(build.place(13, 10)).toBe(true);
  });

  it('blocks bridge on void, soil, path; grass beside duck pen stays buildable', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const livestock = new LivestockSystem(grid);
    build.setPlacementBlocked((gx, gy) =>
      livestock.blocksBuildPlacement(gx, gy, {
        bridge: build.selectedItem?.groundTile === 'bridge',
      })
    );
    const item = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(item);

    expect(build.canPlace(2, 2)).toBe(false);
    const soil = grid.getSoilTileCoords()[0]!;
    expect(build.canPlace(soil.x, soil.y)).toBe(false);
    const pathRing = { x: 3, y: 5 };
    expect(grid.getCell(pathRing.x, pathRing.y)?.type).toBe('path');
    expect(build.canPlace(pathRing.x, pathRing.y)).toBe(false);

    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true, object: undefined });
        }
      }
    }
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -1; dx <= 3; dx++) {
        grid.setCell(8 + dx, 8 + dy, { type: 'grass', walkable: true, object: undefined });
      }
    }
    const penItem = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(penItem);
    const pen = livestock.place(8, 8);
    livestock.exitPlaceMode();
    expect(pen).not.toBeNull();
    const beside = { gx: 7, gy: 8 };
    expect(grid.getCell(beside.gx, beside.gy)?.type).toBe('grass');
    build.exitBuildMode();
    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(beside.gx, beside.gy)).toBe(true);
    build.exitBuildMode();
  });

  it('places bridge on water as walkable path', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(0, 0, { type: 'water', walkable: false, object: undefined });
    const build = new BuildSystem(grid);
    const item = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;

    build.enterBuildMode(item);
    expect(build.canPlace(0, 0)).toBe(true);
    expect(build.place(0, 0)).toBe(true);
    const cell = grid.getCell(0, 0);
    expect(cell?.type).toBe('path');
    expect(cell?.pathVariant).toBe('bridge_tile');
    expect(cell?.walkable).toBe(true);
  });

  it('allows bridge on any river water (shore, interior, beside existing bridge)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const bridgeItem = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;

    // Shore tile: land to grid north → water_1_border_top-right
    grid.setCell(10, 10, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(10, 9, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(10, 11, { type: 'water', walkable: false, object: undefined });
    grid.setCell(9, 10, { type: 'water', walkable: false, object: undefined });
    grid.setCell(11, 10, { type: 'water', walkable: false, object: undefined });

    const build = new BuildSystem(grid);
    build.enterBuildMode(bridgeItem);
    expect(grid.isRiverWaterCell(10, 10)).toBe(false);
    grid.setCell(10, 10, { type: 'water', walkable: false, object: undefined });
    expect(grid.isRiverWaterCell(10, 10)).toBe(true);
    expect(build.canPlace(10, 10)).toBe(true);

    // Interior pond cell (all cardinal neighbors water)
    grid.setCell(12, 12, { type: 'water', walkable: false, object: undefined });
    grid.setCell(12, 11, { type: 'water', walkable: false, object: undefined });
    grid.setCell(12, 13, { type: 'water', walkable: false, object: undefined });
    grid.setCell(11, 12, { type: 'water', walkable: false, object: undefined });
    grid.setCell(13, 12, { type: 'water', walkable: false, object: undefined });
    expect(build.canPlace(12, 12)).toBe(true);

    // Adjacent to an existing bridge segment
    expect(build.place(10, 10)).toBe(true);
    expect(build.canPlace(11, 10)).toBe(true);
    expect(build.place(11, 10)).toBe(true);
    expect(grid.getCell(11, 10)?.pathVariant).toBe('bridge_tile');
  });

  it('rejects bridge on void, grass, soil, and path', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const build = new BuildSystem(grid);
    const bridgeItem = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(bridgeItem);

    expect(build.canPlace(2, 2)).toBe(false);
    grid.setCell(1, 1, { type: 'grass', walkable: true, object: undefined });
    expect(build.canPlace(1, 1)).toBe(false);
    expect(build.canPlace(5, 5)).toBe(false);
    grid.setCell(3, 5, { type: 'path', walkable: true, pathVariant: 'stone_path', object: undefined });
    expect(build.canPlace(3, 5)).toBe(false);
  });

  it('allows bridge on narrow river between two grass shores (water border tile)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true, object: undefined });
        }
      }
    }
    grid.setCell(7, 5, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 4, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 5, { type: 'water', walkable: false, object: undefined });
    grid.setCell(9, 5, { type: 'grass', walkable: true, object: undefined });

    const build = new BuildSystem(grid);
    const bridgeItem = BUILD_ITEMS.find((i) => i.label === 'Bridge')!;
    build.enterBuildMode(bridgeItem);

    expect(grid.canPlaceBridgeAt(8, 5)).toBe(true);
    expect(build.canPlace(8, 5)).toBe(true);
    expect(build.place(8, 5)).toBe(true);
    expect(grid.getCell(8, 5)?.pathVariant).toBe('bridge_tile');
  });

  it('allows bridge on grass/path when iso pick hits land in a 1-tile-wide river', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true, object: undefined });
        }
      }
    }
    grid.setCell(6, 5, { type: 'water', walkable: false, object: undefined });
    grid.setCell(8, 5, { type: 'water', walkable: false, object: undefined });
    grid.setCell(7, 5, { type: 'grass', walkable: true, object: undefined });

    const build = new BuildSystem(grid);
    build.enterBuildMode(BUILD_ITEMS.find((i) => i.label === 'Bridge')!);

    expect(grid.canPlaceBridgeAt(7, 5)).toBe(true);
    expect(build.canPlace(7, 5)).toBe(true);
    expect(build.place(7, 5)).toBe(true);

    grid.setCell(10, 8, { type: 'water', walkable: false, object: undefined });
    grid.setCell(10, 10, { type: 'water', walkable: false, object: undefined });
    grid.setCell(10, 9, {
      type: 'path',
      walkable: true,
      pathVariant: 'path',
      object: undefined,
    });
    expect(build.canPlace(10, 9)).toBe(true);
  });

  it('grass decor on water reclaims land as walkable grass', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(4, 4, { type: 'water', walkable: false, object: undefined });
    const build = new BuildSystem(grid);
    const grassItem = BUILD_ITEMS.find((i) => i.label === 'Grass')!;
    build.enterBuildMode(grassItem);
    expect(build.canPlace(4, 4)).toBe(true);
    expect(build.place(4, 4)).toBe(true);
    const cell = grid.getCell(4, 4);
    expect(cell?.type).toBe('grass');
    expect(cell?.walkable).toBe(true);
  });

  it('user-placed water decor keeps type water for bridge eligibility', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(14, 4, { type: 'grass', walkable: true, object: undefined });
    const build = new BuildSystem(grid);
    const waterItem = BUILD_ITEMS.find((i) => i.label === 'Water')!;
    build.enterBuildMode(waterItem);
    expect(build.place(14, 5)).toBe(true);
    expect(grid.getCell(14, 5)?.type).toBe('water');

    build.enterBuildMode(BUILD_ITEMS.find((i) => i.label === 'Bridge')!);
    expect(grid.isRiverWaterCell(14, 5)).toBe(true);
    expect(build.canPlace(14, 5)).toBe(true);
  });
});

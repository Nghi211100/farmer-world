import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  cellCountsAsWaterForAutotile,
  computeWaterEdgeMask,
  gridWaterNeighborProbe,
  remapWater1BorderTextureKey,
  remapWater3BorderTextureKey,
  runWaterAutotileSelfTest,
  WATER_EDGE_BOTTOM,
  WATER_EDGE_LEFT,
  WATER_EDGE_RIGHT,
  WATER_EDGE_TOP,
  waterTextureKeyFromMask,
} from '../../src/utils/waterAutotile';

describe('water autotile', () => {
  it('passes built-in self-test', () => {
    expect(() => runWaterAutotileSelfTest()).not.toThrow();
  });

  it('maps land to grid north to water_1_border_top-right (mask 2)', () => {
    const probe = (x: number, y: number) => {
      if (x === 3 && y === 3) return true;
      if (x === 3 && y === 2) return false;
      if (x === 3 && y === 4) return true;
      if (x === 2 && y === 3) return true;
      if (x === 4 && y === 3) return true;
      return false;
    };
    expect(computeWaterEdgeMask(3, 3, probe)).toBe(2);
    expect(waterTextureKeyFromMask(2)).toBe('water_1_border_top-right');
  });

  it('maps each one-border mask to the correct iso screen shore texture', () => {
    expect(waterTextureKeyFromMask(1)).toBe('water_1_border_bottom-right');
    expect(waterTextureKeyFromMask(2)).toBe('water_1_border_top-right');
    expect(waterTextureKeyFromMask(4)).toBe('water_1_border_top-left');
    expect(waterTextureKeyFromMask(8)).toBe('water_1_border_bottom-left');
  });

  it('remapWater1BorderTextureKey rotates corner keys clockwise', () => {
    expect(remapWater1BorderTextureKey('water_1_border_bottom-left')).toBe(
      'water_1_border_bottom-right'
    );
    expect(remapWater1BorderTextureKey('water_1_border_bottom-right')).toBe(
      'water_1_border_top-right'
    );
    expect(remapWater1BorderTextureKey('water_1_border_top-right')).toBe(
      'water_1_border_top-left'
    );
    expect(remapWater1BorderTextureKey('water_1_border_top-left')).toBe(
      'water_1_border_bottom-left'
    );
  });

  it('mask 4 (land west, screen top-left) maps to water_1_border_top-left', () => {
    const probe = oneBorderProbe(5, 5, { west: 'land' });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(WATER_EDGE_RIGHT);
    expect(waterTextureKeyFromMask(4)).toBe('water_1_border_top-left');
  });

  it('mask 8 (land south, screen bottom-left) maps to water_1_border_bottom-left', () => {
    const probe = oneBorderProbe(5, 5, { south: 'land' });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(WATER_EDGE_TOP);
    expect(waterTextureKeyFromMask(8)).toBe('water_1_border_bottom-left');
  });

  it('preview on grass picks top-right when land is north', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(8, 8, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 7, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 9, { type: 'water', walkable: false, object: undefined });
    grid.setCell(7, 8, { type: 'water', walkable: false, object: undefined });
    grid.setCell(9, 8, { type: 'water', walkable: false, object: undefined });

    expect(
      grid.getGroundTextureKey(8, 8, { waterPlacementPreview: true })
    ).toBe('water_1_border_top-right');
  });

  it('placed water cell uses top-right border with land north', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(4, 4, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(4, 3, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(4, 5, { type: 'water', walkable: false, object: undefined });
    grid.setCell(3, 4, { type: 'water', walkable: false, object: undefined });
    grid.setCell(5, 4, { type: 'water', walkable: false, object: undefined });
    grid.setCell(4, 4, { type: 'water', walkable: false, object: undefined });

    expect(grid.getGroundTextureKey(4, 4)).toBe('water_1_border_top-right');
  });

  it('counts water with hasBridge as water for autotile probe', () => {
    expect(
      cellCountsAsWaterForAutotile({
        type: 'water',
        hasBridge: true,
      })
    ).toBe(true);
  });

  it('counts bridge_tile path as water for autotile probe', () => {
    expect(
      cellCountsAsWaterForAutotile({
        type: 'path',
        pathVariant: 'bridge_tile',
      })
    ).toBe(true);
    expect(
      cellCountsAsWaterForAutotile({
        type: 'path',
        pathVariant: 'stone_path',
      })
    ).toBe(false);
  });

  it('water between path, grass, bridge, and water picks shore borders (not flat water)', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'path',
      walkable: true,
      pathVariant: 'bridge_tile',
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'path',
      walkable: true,
      pathVariant: 'stone_path',
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(cell.gx, cell.gy, probe)).toBe(6);
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe('water_2_borders_top');
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).not.toBe('water');
  });

  it('narrow channel: diagonal grass/path get shores when cardinals are water+bridge', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy - 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy - 1, {
      type: 'path',
      walkable: true,
      pathVariant: 'stone_path',
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy + 1, {
      type: 'path',
      walkable: true,
      pathVariant: 'bridge_tile',
      object: undefined,
    });

    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe('water_2_borders_left');
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).not.toBe('water');
  });

  it('water with west grass and south path picks water_2_borders_left', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'path',
      walkable: true,
      pathVariant: 'stone_path',
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(cell.gx, cell.gy, probe)).toBe(12);
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe(
      'water_2_borders_left'
    );
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).not.toBe('water_3_border_left_bottom');
  });

  it('outer corner pond: grass west and south picks water_2_borders_left', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(cell.gx, cell.gy, probe)).toBe(12);
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe(
      'water_2_borders_left'
    );
  });

  it('outer corner pond: grass north and west picks water_2_borders_top', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(cell.gx, cell.gy, probe)).toBe(6);
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe('water_2_borders_top');
  });

  it('isolated water pond with no cardinal water neighbors uses flat water texture', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 12, gy: 12 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(cell.gx, cell.gy, probe)).toBe(15);
    expect(waterTextureKeyFromMask(15)).toBe('water');
    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe('water');
  });

  it('remapWater3BorderTextureKey rotates corner keys clockwise', () => {
    expect(remapWater3BorderTextureKey('water_3_border_left_top')).toBe(
      'water_3_border_right_top'
    );
    expect(remapWater3BorderTextureKey('water_3_border_right_top')).toBe(
      'water_3_border_right_bottom'
    );
    expect(remapWater3BorderTextureKey('water_3_border_right_bottom')).toBe(
      'water_3_border_left_bottom'
    );
    expect(remapWater3BorderTextureKey('water_3_border_left_bottom')).toBe(
      'water_3_border_left_top'
    );
  });

  it('mask 7 (open TL, land west+north+east) maps to water_3_border_right_top', () => {
    const probe = threeBorderProbe(5, 5, {
      north: 'land',
      south: 'water',
      east: 'land',
      west: 'land',
    });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(
      WATER_EDGE_RIGHT | WATER_EDGE_BOTTOM | WATER_EDGE_LEFT
    );
    expect(waterTextureKeyFromMask(7)).toBe('water_3_border_right_top');
  });

  it('mask 11 (open TR, land south+north+east) maps to water_3_border_right_bottom', () => {
    const probe = threeBorderProbe(5, 5, {
      north: 'land',
      south: 'land',
      east: 'land',
      west: 'water',
    });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(
      WATER_EDGE_TOP | WATER_EDGE_BOTTOM | WATER_EDGE_LEFT
    );
    expect(waterTextureKeyFromMask(11)).toBe('water_3_border_right_bottom');
  });

  it('mask 13 (open BR, land south+west+east) maps to water_3_border_left_bottom', () => {
    const probe = threeBorderProbe(5, 5, {
      north: 'water',
      south: 'land',
      east: 'land',
      west: 'land',
    });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(
      WATER_EDGE_TOP | WATER_EDGE_RIGHT | WATER_EDGE_LEFT
    );
    expect(waterTextureKeyFromMask(13)).toBe('water_3_border_left_bottom');
  });

  it('mask 14 (open BL, land south+west+north) maps to water_3_border_left_top', () => {
    const probe = threeBorderProbe(5, 5, {
      north: 'land',
      south: 'land',
      east: 'water',
      west: 'land',
    });
    expect(computeWaterEdgeMask(5, 5, probe)).toBe(
      WATER_EDGE_TOP | WATER_EDGE_RIGHT | WATER_EDGE_BOTTOM
    );
    expect(waterTextureKeyFromMask(14)).toBe('water_3_border_left_top');
  });

  it('grid with south+west+east land picks water_3_border_left_bottom', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const cell = { gx: 10, gy: 10 };
    grid.setCell(cell.gx, cell.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy + 1, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx - 1, cell.gy, {
      type: 'path',
      walkable: true,
      pathVariant: 'stone_path',
      object: undefined,
    });
    grid.setCell(cell.gx + 1, cell.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    grid.setCell(cell.gx, cell.gy - 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });

    expect(grid.getGroundTextureKey(cell.gx, cell.gy)).toBe(
      'water_3_border_left_bottom'
    );
  });

  it('water north of bridge treats bridge side as water contact', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const waterNorth = { gx: 6, gy: 4 };
    const bridgeSouth = { gx: 6, gy: 5 };
    grid.setCell(waterNorth.gx, waterNorth.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(waterNorth.gx, waterNorth.gy - 1, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(waterNorth.gx - 1, waterNorth.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(waterNorth.gx + 1, waterNorth.gy, {
      type: 'water',
      walkable: false,
      object: undefined,
    });
    grid.setCell(bridgeSouth.gx, bridgeSouth.gy, {
      type: 'path',
      walkable: true,
      pathVariant: 'bridge_tile',
      object: undefined,
    });

    expect(grid.getGroundTextureKey(waterNorth.gx, waterNorth.gy)).toBe('water');

    const probe = gridWaterNeighborProbe(
      (x, y) => grid.inBounds(x, y),
      (x, y) => grid.getCell(x, y)
    );
    expect(computeWaterEdgeMask(waterNorth.gx, waterNorth.gy, probe)).toBe(0);

    grid.setCell(bridgeSouth.gx, bridgeSouth.gy, {
      type: 'grass',
      walkable: true,
      object: undefined,
    });
    expect(grid.getGroundTextureKey(waterNorth.gx, waterNorth.gy)).toBe(
      'water_1_border_bottom-left'
    );
  });

});

type CardinalKind = 'water' | 'land';

function oneBorderProbe(
  gx: number,
  gy: number,
  landSide: Partial<Record<'north' | 'south' | 'east' | 'west', 'land'>>
): (x: number, y: number) => boolean {
  return threeBorderProbe(gx, gy, {
    north: landSide.north ?? 'water',
    south: landSide.south ?? 'water',
    east: landSide.east ?? 'water',
    west: landSide.west ?? 'water',
  });
}

function threeBorderProbe(
  gx: number,
  gy: number,
  sides: Partial<Record<'north' | 'south' | 'east' | 'west', CardinalKind>>
): (x: number, y: number) => boolean {
  const sideAt = (x: number, y: number): CardinalKind | undefined => {
    if (x === gx && y === gy - 1) return sides.north;
    if (x === gx && y === gy + 1) return sides.south;
    if (x === gx + 1 && y === gy) return sides.east;
    if (x === gx - 1 && y === gy) return sides.west;
    return undefined;
  };

  return (x, y) => {
    const side = sideAt(x, y);
    if (side === 'water') return true;
    if (side === 'land') return false;
    return false;
  };
}

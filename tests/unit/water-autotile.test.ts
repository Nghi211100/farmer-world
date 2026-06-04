import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  computeWaterEdgeMask,
  runWaterAutotileSelfTest,
  waterTextureKeyFromMask,
} from '../../src/utils/waterAutotile';

describe('water autotile', () => {
  it('passes built-in self-test', () => {
    expect(() => runWaterAutotileSelfTest()).not.toThrow();
  });

  it('maps land to grid north to water_1_border_bottom-right (mask 2)', () => {
    const probe = (x: number, y: number) => {
      if (x === 3 && y === 3) return true;
      if (x === 3 && y === 2) return false;
      if (x === 3 && y === 4) return true;
      if (x === 2 && y === 3) return true;
      if (x === 4 && y === 3) return true;
      return false;
    };
    expect(computeWaterEdgeMask(3, 3, probe)).toBe(2);
    expect(waterTextureKeyFromMask(2)).toBe('water_1_border_bottom-right');
  });

  it('preview on grass picks bottom-right when land is north', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(8, 8, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 7, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(8, 9, { type: 'water', walkable: false, object: undefined });
    grid.setCell(7, 8, { type: 'water', walkable: false, object: undefined });
    grid.setCell(9, 8, { type: 'water', walkable: false, object: undefined });

    expect(
      grid.getGroundTextureKey(8, 8, { waterPlacementPreview: true })
    ).toBe('water_1_border_bottom-right');
  });

  it('placed water cell uses bottom-right border with land north', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.setCell(4, 4, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(4, 3, { type: 'grass', walkable: true, object: undefined });
    grid.setCell(4, 5, { type: 'water', walkable: false, object: undefined });
    grid.setCell(3, 4, { type: 'water', walkable: false, object: undefined });
    grid.setCell(5, 4, { type: 'water', walkable: false, object: undefined });
    grid.setCell(4, 4, { type: 'water', walkable: false, object: undefined });

    expect(grid.getGroundTextureKey(4, 4)).toBe('water_1_border_bottom-right');
  });

});

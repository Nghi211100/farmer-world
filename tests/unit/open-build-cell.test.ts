import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';

describe('GridSystem.isOpenBuildCell', () => {
  it('accepts grass and path, rejects soil water void and occupied cells', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();

    expect(grid.isOpenBuildCell(2, 2)).toBe(true);
    grid.setCell(1, 1, { type: 'path', walkable: true, pathVariant: 'stone_path' });
    expect(grid.isOpenBuildCell(1, 1)).toBe(true);

    expect(grid.isOpenBuildCell(10, 10)).toBe(false);
    grid.setCell(3, 3, { type: 'water', walkable: false });
    expect(grid.isOpenBuildCell(3, 3)).toBe(false);
    grid.setCell(4, 4, { type: 'void', walkable: false });
    expect(grid.isOpenBuildCell(4, 4)).toBe(false);

    grid.setObject(2, 3, 'tree_01');
    expect(grid.isOpenBuildCell(2, 3)).toBe(false);
  });
});

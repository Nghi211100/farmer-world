import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/gameConfig';
import type { BuildingData } from '../../src/config/gameConfig';
import { BuildSystem } from '../../src/systems/BuildSystem';
import {
  getBuildingObjectEditDisabledActions,
  getBuildingObjectEditHiddenActions,
  getBuildingObjectEditVisibleActions,
} from '../../src/systems/buildingObjectEditLogic';
import { EconomySystem } from '../../src/systems/EconomySystem';
import { GridSystem } from '../../src/systems/GridSystem';

function house(level = 1): BuildingData {
  return { type: 'house', textureKey: 'house_lv1', gridX: 3, gridY: 4, level };
}

function tree(): BuildingData {
  return { type: 'tree', textureKey: 'tree_01', gridX: 5, gridY: 5, level: 1 };
}

describe('building object edit popup actions', () => {
  it('hides upgrade for decor trees', () => {
    expect(getBuildingObjectEditHiddenActions(tree())).toEqual(['upgrade']);
    expect(getBuildingObjectEditVisibleActions(tree())).toEqual(['move', 'remove']);
  });

  it('shows upgrade for house and barn until max level', () => {
    expect(getBuildingObjectEditHiddenActions(house())).toEqual([]);
    expect(getBuildingObjectEditVisibleActions(house())).toEqual(['move', 'upgrade', 'remove']);
    expect(getBuildingObjectEditHiddenActions(house(ECONOMY.maxBuildingLevel))).toEqual([
      'upgrade',
    ]);
  });

  it('disables upgrade when player cannot afford house upgrade', () => {
    const grid = new GridSystem(12);
    const build = new BuildSystem(grid);
    const economy = new EconomySystem(0);
    const building = house();
    expect(
      getBuildingObjectEditDisabledActions(building, build, economy)
    ).toEqual(['upgrade']);
  });

  it('enables upgrade when affordable', () => {
    const grid = new GridSystem(12);
    const build = new BuildSystem(grid);
    const economy = new EconomySystem(500);
    const building = house();
    expect(getBuildingObjectEditDisabledActions(building, build, economy)).toEqual([]);
  });
});

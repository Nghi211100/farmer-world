import { describe, expect, it } from 'vitest';
import {
  getLivestockHouseTextureKey,
  getLivestockStagesForSpecies,
  getLivestockTexturesFor,
  LIVESTOCK_HOUSE_KEYS,
  penFootprintCells,
  penFootprintTiles,
  PEN_HOUSE_FOOTPRINT_FIT_PADDING,
  penHouseDisplaySize,
  penHouseFootprintFitBox,
  penOccupiesCell,
  pickLivestockVariantIndex,
  resolveLivestockAnimalTextureKey,
  speciesHasAnimalSprites,
} from '../../src/config/livestockAssets';
import { getLivestockPenTextureKeyForPen, penFootprintDebugLabel } from '../../src/config/LivestockConfig';
import { createNewPen, createRuminantPen, upgradePen } from '../../src/systems/livestockLogic';

describe('livestockAssets', () => {
  it('maps species × stage × variant from animals folder', () => {
    expect(getLivestockTexturesFor('chicken', 'child').map((e) => e.key)).toEqual([
      'chicken_child',
    ]);
    expect(getLivestockTexturesFor('pig', 'young').map((e) => e.key)).toEqual(['pig_young']);
    expect(getLivestockTexturesFor('pig', 'adult').map((e) => e.key)).toEqual(['pig_ault']);
    expect(getLivestockTexturesFor('fish', 'adult').map((e) => e.variant).sort()).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('pickLivestockVariantIndex chooses only defined variants for stage', () => {
    const variants = new Set<number>();
    for (let i = 0; i < 40; i++) {
      variants.add(pickLivestockVariantIndex('duck', 'adult', () => i / 40));
    }
    expect(variants).toEqual(new Set([1, 2, 3]));
  });

  it('resolveLivestockAnimalTextureKey falls back to first entry when variant missing', () => {
    expect(resolveLivestockAnimalTextureKey('cow', 'adult', 99)).toBe('cow_ault');
  });

  it('penHouseDisplaySize uses full N×N iso footprint (padding 1.0)', () => {
    expect(PEN_HOUSE_FOOTPRINT_FIT_PADDING).toBe(1);
    expect(penHouseDisplaySize(1)).toEqual({ width: 192, height: 96 });
    expect(penHouseDisplaySize(2)).toEqual({ width: 256, height: 128 });
  });

  it('penHouseFootprintFitBox matches penHouseDisplaySize for all species', () => {
    expect(penHouseFootprintFitBox(1, 'fish')).toEqual(penHouseDisplaySize(1));
    expect(penHouseFootprintFitBox(1, 'cow')).toEqual(penHouseDisplaySize(1));
  });

  it('pen footprint is 3×3 at level 1 and 4×4 at level 2', () => {
    expect(penFootprintTiles(1)).toEqual({ w: 3, h: 3 });
    expect(penFootprintTiles(2)).toEqual({ w: 4, h: 4 });
    expect(penFootprintCells(createNewPen('p', 'cow', 5, 6, 1))).toHaveLength(9);
    const upgraded = upgradePen(createNewPen('p', 'cow', 5, 6, 1))!;
    expect(penFootprintCells(upgraded)).toHaveLength(16);
  });

  it('penOccupiesCell covers full footprint', () => {
    const pen = createNewPen('p', 'chicken', 10, 10, 1);
    expect(penOccupiesCell(pen, 10, 10)).toBe(true);
    expect(penOccupiesCell(pen, 12, 12)).toBe(true);
    expect(penOccupiesCell(pen, 13, 10)).toBe(false);
    const big = upgradePen(pen)!;
    expect(penOccupiesCell(big, 13, 13)).toBe(true);
  });

  it('fish has child and adult stages', () => {
    expect(getLivestockStagesForSpecies('fish').sort()).toEqual(['adult', 'child']);
    expect(getLivestockTexturesFor('fish', 'child').map((e) => e.key)).toEqual(['fish_child']);
    expect(getLivestockStagesForSpecies('pig').sort()).toEqual(['adult', 'child', 'young']);
  });

  it('ruminant empty pen uses sheep_house for display', () => {
    const pen = createRuminantPen('r1', 0, 0);
    expect(getLivestockPenTextureKeyForPen(pen)).toBe('sheep_house');
  });

  it('maps each species to *_house texture key', () => {
    expect(LIVESTOCK_HOUSE_KEYS.chicken).toBe('chicken_house');
    expect(getLivestockHouseTextureKey('pig')).toBe('pig_house');
    expect(getLivestockHouseTextureKey('sheep')).toBe('sheep_house');
    expect(getLivestockHouseTextureKey('goat')).toBe('goat_house');
  });

  it('sheep and goat have animal sprites (ault = adult)', () => {
    expect(speciesHasAnimalSprites('sheep')).toBe(true);
    expect(speciesHasAnimalSprites('goat')).toBe(true);
    expect(getLivestockTexturesFor('goat', 'adult').map((e) => e.variant).sort()).toEqual([
      0, 1, 2,
    ]);
    expect(resolveLivestockAnimalTextureKey('sheep', 'adult', 1)).toBe('sheep_ault_1');
  });

  it('penFootprintDebugLabel shows species or ruminant kind', () => {
    expect(penFootprintDebugLabel(createNewPen('p', 'chicken', 0, 0, 1))).toBe('Gà');
    expect(penFootprintDebugLabel(createRuminantPen('r', 0, 0))).toBe('Dê/Cừu');
  });
});

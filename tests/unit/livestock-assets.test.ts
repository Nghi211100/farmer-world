import { describe, expect, it } from 'vitest';
import {
  getLivestockHouseTextureKey,
  getLivestockStagesForSpecies,
  getLivestockTexturesFor,
  LIVESTOCK_HOUSE_KEYS,
  penFootprintCells,
  penFootprintTiles,
  penHasWaterMoat,
  penMoatCells,
  PEN_HOUSE_FOOTPRINT_FIT_PADDING,
  PEN_HOUSE_VISUAL_HEIGHT_SCALE,
  PEN_HOUSE_VISUAL_SCALE,
  penHouseDisplaySize,
  penHouseFootprintLayout,
  penHouseFootprintFitBox,
  penFootprintOccupiesCell,
  penMoatTouchesExternalWater,
  penOccupiesCell,
  pickLivestockVariantIndex,
  resolveLivestockAnimalTextureKey,
  speciesHasAnimalSprites,
} from '../../src/config/livestockAssets';
import { getLivestockPenTextureKeyForPen, penFootprintDebugLabel } from '../../src/config/LivestockConfig';
import { GridSystem } from '../../src/systems/GridSystem';
import {
  ASSET_MANIFEST,
  LIVESTOCK_WARNING_TEXTURE_KEY,
  LIVESTOCK_WARNING_WIDTH_SCALE,
} from '../../src/config/assets';
import { createNewPen, createRuminantPen, upgradePen } from '../../src/systems/livestockLogic';

describe('livestockAssets', () => {
  it('maps species × stage × variant from animals folder', () => {
    expect(getLivestockTexturesFor('chicken', 'child').map((e) => e.key)).toEqual([
      'chicken_child',
    ]);
    expect(getLivestockTexturesFor('pig', 'young').map((e) => e.key)).toEqual([]);
    expect(getLivestockTexturesFor('pig', 'adult').map((e) => e.key).sort()).toEqual([
      'pig_adult',
      'pig_adult_1',
    ]);
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

  it('penHouseDisplaySize applies visual X/Y scaling on N×N iso footprint', () => {
    expect(PEN_HOUSE_FOOTPRINT_FIT_PADDING).toBe(1);
    expect(PEN_HOUSE_VISUAL_SCALE).toBe(1.1);
    expect(PEN_HOUSE_VISUAL_HEIGHT_SCALE).toBe(1);
    const lv1 = penHouseDisplaySize(1);
    expect(lv1.width).toBeCloseTo(211.2, 10);
    expect(lv1.height).toBeCloseTo(96, 10);
    const lv2 = penHouseDisplaySize(2);
    expect(lv2.width).toBeCloseTo(281.6, 10);
    expect(lv2.height).toBeCloseTo(128, 10);
  });

  it('penHouseFootprintLayout uses penHouseDisplaySize, not iso AABB span', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    grid.centerInViewport(1280, 720);
    const bounds = grid.getRectMapFootprintScreenBounds(5, 5, 3, 3);
    const layout = penHouseFootprintLayout(grid, 5, 5, 1, 'chicken');
    const display = penHouseDisplaySize(1, undefined, undefined, undefined, undefined, undefined, 'chicken');
    expect(layout.displayWidth).toBe(Math.max(1, Math.round(display.width)));
    expect(layout.displayHeight).toBe(Math.max(1, Math.round(display.height)));
    expect(layout.displayHeight).not.toBe(Math.round(bounds.height));
    expect(layout.x).toBe(bounds.centerX);
    expect(layout.y).toBeCloseTo(bounds.bottomY + display.height * -0.03, 5);
  });

  it('penHouseFootprintFitBox matches penHouseDisplaySize for all species', () => {
    expect(penHouseFootprintFitBox(1, 'fish')).toEqual(
      penHouseDisplaySize(1, undefined, undefined, undefined, undefined, undefined, 'fish')
    );
    expect(penHouseFootprintFitBox(1, 'cow')).toEqual(
      penHouseDisplaySize(1, undefined, undefined, undefined, undefined, undefined, 'cow')
    );
  });

  it('pen footprint is 3×3 at level 1 and 4×4 at level 2', () => {
    expect(penFootprintTiles(1)).toEqual({ w: 3, h: 3 });
    expect(penFootprintTiles(2)).toEqual({ w: 4, h: 4 });
    expect(penFootprintCells(createNewPen('p', 'cow', 5, 6, 1))).toHaveLength(9);
    const upgraded = upgradePen(createNewPen('p', 'cow', 5, 6, 1))!;
    expect(penFootprintCells(upgraded)).toHaveLength(16);
  });

  it('duck/fish moat ring is one cell outside footprint', () => {
    expect(penHasWaterMoat('duck')).toBe(true);
    const duck = createNewPen('d', 'duck', 4, 4, 1);
    expect(penMoatCells(duck)).toHaveLength(16);
    expect(penOccupiesCell(duck, 3, 4)).toBe(true);
    expect(penOccupiesCell(createNewPen('c', 'chicken', 4, 4, 1), 3, 4)).toBe(false);
  });

  it('penFootprintOccupiesCell excludes moat ring', () => {
    const duck = createNewPen('d', 'duck', 4, 4, 1);
    expect(penFootprintOccupiesCell(duck, 4, 4)).toBe(true);
    expect(penFootprintOccupiesCell(duck, 3, 4)).toBe(false);
    expect(penOccupiesCell(duck, 3, 4)).toBe(true);
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
    expect(getLivestockStagesForSpecies('pig').sort()).toEqual(['adult', 'child']);
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

  it('registers hungry warning texture asset key', () => {
    const warningEntry = ASSET_MANIFEST.find((entry) => entry.key === LIVESTOCK_WARNING_TEXTURE_KEY);
    expect(LIVESTOCK_WARNING_TEXTURE_KEY).toBe('livestock_warning');
    expect(LIVESTOCK_WARNING_WIDTH_SCALE).toBe(0.5);
    expect(warningEntry?.path).toBe('animals/warning.png');
  });
});

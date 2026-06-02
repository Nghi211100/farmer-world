import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVESTOCK_PEN_ANCHORS,
  defaultPenIdForSpecies,
} from '../../src/config/livestockPenLayout';
import {
  getShopLivestockAnimalType,
  getShopLivestockPrice,
  SHOP_LIVESTOCK_IDS,
} from '../../src/config/shopLivestock';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import {
  createDefaultFarmPens,
  findPenForStocking,
  getPenForSpecies,
  normalizeSavedLivestockPens,
} from '../../src/systems/livestockLogic';
import { penFootprintCells } from '../../src/config/livestockAssets';

describe('livestockPenLayout (reference only)', () => {
  it('documents non-overlapping default anchors for dev maps', () => {
    const occupied = new Set<string>();
    for (const pen of createDefaultFarmPens()) {
      for (const { gx, gy } of penFootprintCells(pen)) {
        const key = `${gx},${gy}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
    expect(DEFAULT_LIVESTOCK_PEN_ANCHORS).toHaveLength(6);
    expect(defaultPenIdForSpecies('chicken')).toBe('pen-chicken');
  });
});

describe('LivestockSystem — player-placed pens', () => {
  function emptyFarm() {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const livestock = new LivestockSystem(grid);
    livestock.loadPens([]);
    return { grid, livestock };
  }

  it('starts with no pens until Build placement', () => {
    const { livestock } = emptyFarm();
    expect(livestock.getPens()).toHaveLength(0);
  });

  it('place() adds pen on valid grass tile', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placedAt = -1;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (livestock.canPlace(gx, gy)) {
          placedAt = gx;
          const pen = livestock.place(gx, gy);
          expect(pen?.animalType).toBe('chicken');
          expect(pen?.state).toBe('unstocked');
          break outer;
        }
      }
    }
    expect(placedAt).toBeGreaterThanOrEqual(0);
    expect(livestock.getPens()).toHaveLength(1);
  });

  it('stockSpeciesPen uses first empty pen of species', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const stocked = livestock.stockSpeciesPen('duck');
    expect(stocked?.state).toBe('idle');
    expect(livestock.stockSpeciesPen('duck')).toBeNull();
  });

  it('normalizeSavedLivestockPens keeps saved pens without filling defaults', () => {
    const saved = [
      {
        id: 'pen-cow-1',
        animalType: 'cow' as const,
        gridX: 10,
        gridY: 10,
        state: 'unstocked' as const,
        level: 1 as const,
      },
    ];
    const loaded = normalizeSavedLivestockPens(saved);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.gridX).toBe(10);
  });

  it('shared ruminant pen stocks goat or sheep once', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
    expect(item.textureKey).toBe('sheep_house');
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const pens = livestock.getPens();
    expect(pens[0]?.penKind).toBe('ruminant');
    expect(findPenForStocking(pens, 'goat')).toBeDefined();
    expect(findPenForStocking(pens, 'sheep')).toBeDefined();
    const goat = livestock.stockSpeciesPen('goat');
    expect(goat?.animalType).toBe('goat');
    expect(livestock.stockSpeciesPen('sheep')).toBeNull();
    expect(getPenForSpecies(livestock.getPens(), 'goat')).toBe(goat);
    expect(getPenForSpecies(livestock.getPens(), 'sheep')).toBe(goat);
  });
});

describe('LIVESTOCK_PEN_PLACE_ITEMS', () => {
  it('has six build cards including one ruminant pen', () => {
    expect(LIVESTOCK_PEN_PLACE_ITEMS).toHaveLength(6);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'ruminant')).toBe(true);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'goat')).toBe(false);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'sheep')).toBe(false);
  });
});

describe('shop livestock catalog', () => {
  it('maps shop ids to species and prices', () => {
    expect(getShopLivestockAnimalType(SHOP_LIVESTOCK_IDS.CHICKEN)).toBe('chicken');
    expect(getShopLivestockPrice(SHOP_LIVESTOCK_IDS.COW)).toBe(80);
  });
});

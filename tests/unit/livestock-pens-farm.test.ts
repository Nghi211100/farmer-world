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
    expect(stocked?.animalTextureKey).toBeTruthy();
    expect(livestock.stockSpeciesPen('duck')?.stockCount).toBe(2);
  });

  it('keeps stocked animal state after export/load', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
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
    const stocked = livestock.stockSpeciesPen('chicken');
    expect(stocked?.state).toBe('idle');
    expect(stocked?.animalTextureKey).toBeTruthy();

    const reloaded = new LivestockSystem(grid);
    reloaded.loadPens(livestock.exportPens());
    const loadedPen = reloaded.getPens()[0];
    expect(loadedPen?.state).toBe('idle');
    expect(loadedPen?.animalTextureKey).toBe(stocked?.animalTextureKey);
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

  it('normalizeSavedLivestockPens migrates legacy ruminant single animal', () => {
    const loaded = normalizeSavedLivestockPens([
      {
        id: 'pen-ruminant-legacy',
        penKind: 'ruminant' as const,
        animalType: 'goat' as const,
        gridX: 6,
        gridY: 6,
        state: 'idle' as const,
        level: 1 as const,
        stage: 'adult' as const,
        variant: 0,
        animalTextureKey: 'goat_ault',
      },
    ]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.ruminantOccupants).toEqual([
      { animalType: 'goat', stage: 'adult', variant: 0, animalTextureKey: 'goat_ault' },
    ]);
  });

  it('shared ruminant pen stocks goat then sheep in two slots', () => {
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
    const sheep = livestock.stockSpeciesPen('sheep');
    expect(sheep?.id).toBe(goat?.id);
    expect(sheep?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
    expect(livestock.stockSpeciesPen('sheep')?.stockCount).toBe(3);
    expect(livestock.stockSpeciesPen('goat')?.stockCount).toBe(4);
    expect(livestock.stockSpeciesPen('goat')).toBeNull();
    expect(getPenForSpecies(livestock.getPens(), 'goat')?.id).toBe(goat?.id);
    expect(getPenForSpecies(livestock.getPens(), 'sheep')?.id).toBe(goat?.id);
  });

  it('shared ruminant pen stocks sheep then goat in two slots', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
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
    const sheep = livestock.stockSpeciesPen('sheep');
    expect(sheep?.animalType).toBe('sheep');
    const goat = livestock.stockSpeciesPen('goat');
    expect(goat?.id).toBe(sheep?.id);
    expect(goat?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
    expect(livestock.stockSpeciesPen('goat')?.stockCount).toBe(3);
    expect(livestock.stockSpeciesPen('sheep')?.stockCount).toBe(4);
    expect(livestock.stockSpeciesPen('sheep')).toBeNull();
  });

  it('shared ruminant pen save/load keeps both occupants', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
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
    expect(livestock.stockSpeciesPen('goat')?.id).toBeTruthy();
    expect(livestock.stockSpeciesPen('sheep')?.id).toBeTruthy();

    const reloaded = new LivestockSystem(grid);
    reloaded.loadPens(livestock.exportPens());
    const loaded = reloaded.getPens()[0];
    expect(loaded?.penKind).toBe('ruminant');
    expect(loaded?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
  });

  it('lv2 pens stock up to eight animals', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let penId = '';
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        const pen = livestock.canPlace(gx, gy) ? livestock.place(gx, gy) : null;
        if (pen) {
          penId = pen.id;
          break outer;
        }
      }
    }
    livestock.exitPlaceMode();
    const placed = livestock.getPens().find((p) => p.id === penId)!;
    expect(livestock.tryUpgrade(placed)?.level).toBe(2);
    for (let i = 0; i < 8; i++) {
      const stocked = livestock.stockSpeciesPen('chicken');
      expect(stocked).not.toBeNull();
    }
    expect(livestock.stockSpeciesPen('chicken')).toBeNull();
  });

  it('recovers legacy pens from grid livestock markers', () => {
    const { grid, livestock } = emptyFarm();
    for (let y = 5; y <= 7; y++) {
      for (let x = 5; x <= 7; x++) {
        grid.setObject(x, y, 'livestock_pen_chicken');
      }
    }
    for (let y = 10; y <= 13; y++) {
      for (let x = 10; x <= 13; x++) {
        grid.setObject(x, y, 'livestock_pen_ruminant');
      }
    }

    const recovered = livestock.recoverPensFromGridMarkers();
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toMatchObject({
      animalType: 'chicken',
      gridX: 5,
      gridY: 5,
      level: 1,
      state: 'unstocked',
    });
    expect(recovered[1]).toMatchObject({
      penKind: 'ruminant',
      animalType: 'sheep',
      gridX: 10,
      gridY: 10,
      level: 2,
      state: 'unstocked',
    });
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

import { describe, expect, it } from 'vitest';
import {
  getShopLivestockAnimalType,
  getShopLivestockLabel,
  getShopLivestockPrice,
  isShopLivestockId,
  isShopLivestockPurchasable,
  SHOP_LIVESTOCK_CATALOG,
  SHOP_LIVESTOCK_IDS,
} from '../../src/config/shopLivestock';
import { isShopBuyable } from '../../src/config/items';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem } from '../../src/systems/LivestockSystem';
import {
  createNewPen,
  maxLivestockPurchasable,
  stockPenWithAnimal,
} from '../../src/systems/livestockLogic';

describe('shop livestock config', () => {
  it('exposes buyable animals including sheep and goat', () => {
    const ids = SHOP_LIVESTOCK_CATALOG.map((e) => e.id);
    expect(ids).toContain(SHOP_LIVESTOCK_IDS.CHICKEN);
    expect(ids).toContain(SHOP_LIVESTOCK_IDS.FISH);
    expect(ids).toContain(SHOP_LIVESTOCK_IDS.SHEEP);
    expect(ids).toContain(SHOP_LIVESTOCK_IDS.GOAT);
    expect(isShopLivestockPurchasable(SHOP_LIVESTOCK_IDS.SHEEP)).toBe(true);
    expect(isShopLivestockPurchasable(SHOP_LIVESTOCK_IDS.PIG)).toBe(true);
  });

  it('registers as shop-buyable virtual ids', () => {
    expect(isShopLivestockId(SHOP_LIVESTOCK_IDS.DUCK)).toBe(true);
    expect(isShopBuyable(SHOP_LIVESTOCK_IDS.DUCK)).toBe(true);
    expect(isShopBuyable('wheat_seed')).toBe(true);
  });

  it('provides Vietnamese labels', () => {
    expect(getShopLivestockLabel(SHOP_LIVESTOCK_IDS.CHICKEN)).toBe('Gà');
    expect(getShopLivestockAnimalType(SHOP_LIVESTOCK_IDS.PIG)).toBe('pig');
  });
});

describe('maxLivestockPurchasable', () => {
  it('sums empty slots on compatible pens and caps by coins', () => {
    const pen = createNewPen('pen-chicken', 'chicken', 4, 4, 1);
    expect(maxLivestockPurchasable([pen], 'chicken', 10, 100)).toBe(4);
    expect(maxLivestockPurchasable([pen], 'chicken', 10, 25)).toBe(2);
    expect(maxLivestockPurchasable([pen], 'duck', 10, 100)).toBe(0);
  });

  it('subtracts stocked animals from capacity', () => {
    let pen = createNewPen('pen-chicken', 'chicken', 4, 4, 1);
    pen = stockPenWithAnimal(pen, 'chicken', () => 0)!;
    pen = stockPenWithAnimal(pen, 'chicken', () => 0)!;
    expect(maxLivestockPurchasable([pen], 'chicken', 5, 500)).toBe(2);
  });

  function farmWithChickenPen(stocked = 0) {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const livestock = new LivestockSystem(grid);
    let pen = createNewPen('pen-chicken', 'chicken', 10, 10, 1);
    for (let i = 0; i < stocked; i++) {
      pen = stockPenWithAnimal(pen, 'chicken', () => 0)!;
    }
    livestock.loadPens([pen]);
    return livestock.getPens();
  }

  it('returns empty slots in compatible pen capped by coins', () => {
    const pens = farmWithChickenPen(1);
    const unit = getShopLivestockPrice(SHOP_LIVESTOCK_IDS.CHICKEN);
    expect(maxLivestockPurchasable(pens, 'chicken', unit, 500)).toBe(3);
    expect(maxLivestockPurchasable(pens, 'chicken', unit, unit * 2)).toBe(2);
  });

  it('returns 0 when pen is full or species has no pen', () => {
    const pens = farmWithChickenPen(4);
    const unit = getShopLivestockPrice(SHOP_LIVESTOCK_IDS.CHICKEN);
    expect(maxLivestockPurchasable(pens, 'chicken', unit, 500)).toBe(0);
    expect(maxLivestockPurchasable(pens, 'cow', unit, 500)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  getShopLivestockAnimalType,
  getShopLivestockLabel,
  isShopLivestockId,
  isShopLivestockPurchasable,
  SHOP_LIVESTOCK_CATALOG,
  SHOP_LIVESTOCK_IDS,
} from '../../src/config/shopLivestock';
import { isShopBuyable } from '../../src/config/items';

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

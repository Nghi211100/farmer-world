import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/gameConfig';
import { ITEM_IDS } from '../../src/config/items';
import { EconomySystem } from '../../src/systems/EconomySystem';

describe('EconomySystem.getLandCost', () => {
  it('scales from base cost by prior land purchases', () => {
    const { baseCost, costMultiplier } = ECONOMY.land;
    const economy = new EconomySystem(10_000);

    expect(economy.getLandCost()).toBe(baseCost);
    economy.setLandPurchases(1);
    expect(economy.getLandCost()).toBe(Math.floor(baseCost * costMultiplier));
    economy.setLandPurchases(2);
    expect(economy.getLandCost()).toBe(Math.floor(baseCost * costMultiplier ** 2));
  });

  it('charges 2000 / 2440 / 2976 coins for the first three unlocks', () => {
    const economy = new EconomySystem(10_000);
    expect(economy.getLandCost()).toBe(2000);
    economy.purchaseLand();
    expect(economy.getLandCost()).toBe(2440);
    economy.purchaseLand();
    expect(economy.getLandCost()).toBe(2976);
  });
});

describe('EconomySystem crop sell prices', () => {
  it('returns rebalanced harvest sell prices from ECONOMY.sell', () => {
    const economy = new EconomySystem(0);
    expect(economy.getSellPrice(ITEM_IDS.WHEAT)).toBe(9);
    expect(economy.getSellPrice(ITEM_IDS.CORN)).toBe(14);
    expect(economy.getSellPrice(ITEM_IDS.CARROT)).toBe(17);
    expect(economy.getSellPrice(ITEM_IDS.TOMATO)).toBe(21);
    expect(economy.getSellPrice(ITEM_IDS.PUMPKIN)).toBe(35);
  });

  it('getResourceSellPrice matches harvest item ids', () => {
    const economy = new EconomySystem(0);
    expect(economy.getResourceSellPrice('wheat')).toBe(
      economy.getSellPrice(ITEM_IDS.WHEAT)
    );
    expect(economy.getResourceSellPrice('pumpkin')).toBe(
      economy.getSellPrice(ITEM_IDS.PUMPKIN)
    );
  });
});

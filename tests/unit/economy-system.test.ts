import { describe, expect, it } from 'vitest';
import { ECONOMY, landUnlockCostForPurchaseIndex } from '../../src/config/gameConfig';
import { ITEM_IDS } from '../../src/config/items';
import { EconomySystem } from '../../src/systems/EconomySystem';

describe('EconomySystem.getLandCost', () => {
  it('scales from base cost by prior land purchases (geometric ×1.5)', () => {
    const { baseCost, costMultiplier } = ECONOMY.land;
    const economy = new EconomySystem(10_000);

    expect(economy.getLandCost()).toBe(landUnlockCostForPurchaseIndex(0));
    expect(economy.getLandCost()).toBe(Math.round(baseCost * costMultiplier ** 0));

    economy.setLandPurchases(1);
    expect(economy.getLandCost()).toBe(Math.round(baseCost * costMultiplier ** 1));

    economy.setLandPurchases(2);
    expect(economy.getLandCost()).toBe(Math.round(baseCost * costMultiplier ** 2));
  });

  it('charges 2000 / 3000 / 4500 coins for the first three unlocks', () => {
    const economy = new EconomySystem(10_000);
    expect(economy.getLandCost()).toBe(2000);
    economy.purchaseLand();
    expect(economy.getLandCost()).toBe(3000);
    economy.purchaseLand();
    expect(economy.getLandCost()).toBe(4500);
  });
});

describe('EconomySystem crop sell prices', () => {
  it('returns rebalanced harvest sell prices from ECONOMY.sell', () => {
    const economy = new EconomySystem(0);
    expect(economy.getSellPrice(ITEM_IDS.WHEAT)).toBe(45);
    expect(economy.getSellPrice(ITEM_IDS.CORN)).toBe(70);
    expect(economy.getSellPrice(ITEM_IDS.CARROT)).toBe(85);
    expect(economy.getSellPrice(ITEM_IDS.TOMATO)).toBe(105);
    expect(economy.getSellPrice(ITEM_IDS.PUMPKIN)).toBe(175);
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

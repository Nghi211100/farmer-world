import { ECONOMY, type CropKind } from '../config/gameConfig';
import { getCropDef } from '../config/CropConfig';

export class EconomySystem {
  private coins: number;
  private landPurchases = 0;

  constructor(initialCoins: number, landPurchases = 0) {
    this.coins = initialCoins;
    this.landPurchases = landPurchases;
  }

  getCoins(): number {
    return this.coins;
  }

  setCoins(amount: number): void {
    this.coins = Math.max(0, amount);
  }

  getLandPurchases(): number {
    return this.landPurchases;
  }

  setLandPurchases(count: number): void {
    this.landPurchases = Math.max(0, count);
  }

  canAfford(cost: number): boolean {
    return this.coins >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.coins -= cost;
    return true;
  }

  earn(amount: number): void {
    this.coins += amount;
  }

  getSeedPrice(itemId: string): number {
    return ECONOMY.seeds[itemId] ?? 0;
  }

  getFoodPrice(itemId: string): number {
    return ECONOMY.food[itemId] ?? 0;
  }

  /** Seed or food shop buy price */
  getShopPrice(itemId: string): number {
    return this.getSeedPrice(itemId) || this.getFoodPrice(itemId);
  }

  getSellPrice(itemId: string): number {
    return ECONOMY.sell[itemId] ?? 0;
  }

  /** Sell price for harvested crop resource */
  getResourceSellPrice(kind: CropKind): number {
    const def = getCropDef(kind);
    return ECONOMY.sell[def.harvestItemId] ?? 0;
  }

  getLandCost(): number {
    const { baseCost, costMultiplier } = ECONOMY.land;
    return Math.floor(baseCost * Math.pow(costMultiplier, this.landPurchases));
  }

  purchaseLand(): number | null {
    const cost = this.getLandCost();
    if (!this.spend(cost)) return null;
    this.landPurchases += 1;
    return cost;
  }

  getBuildingUpgradeCost(type: string, currentLevel: number): number {
    const costs = ECONOMY.buildingUpgrade[type as keyof typeof ECONOMY.buildingUpgrade];
    if (!costs || currentLevel >= ECONOMY.maxBuildingLevel) return 0;
    return costs[currentLevel] ?? 0;
  }

  canUpgradeBuilding(type: string, currentLevel: number): boolean {
    if (currentLevel >= ECONOMY.maxBuildingLevel) return false;
    const cost = this.getBuildingUpgradeCost(type, currentLevel);
    return cost > 0 && this.canAfford(cost);
  }

  upgradeBuilding(type: string, currentLevel: number): boolean {
    const cost = this.getBuildingUpgradeCost(type, currentLevel);
    if (cost <= 0 || !this.canAfford(cost)) return false;
    this.spend(cost);
    return true;
  }
}

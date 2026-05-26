import {
  ITEM_CATEGORIES,
  ITEM_IDS,
  ITEM_ICON_KEYS,
  ITEM_LABELS,
  isSeedItem,
  type ItemCategory,
} from '../config/items';
import { WAREHOUSE, warehouseCapacityForLevel } from '../config/gameConfig';
import type { CropKind } from '../config/gameConfig';
import { CROP_TO_SEED, SEED_TO_CROP } from '../config/gameConfig';
import { CROP_IDS } from '../config/CropConfig';

export interface InventorySlot {
  id: string;
  label: string;
  count: number;
  iconKey: string;
  category: ItemCategory | null;
}

const ALL_SEED_IDS = CROP_IDS.map((c) => CROP_TO_SEED[c]);

/**
 * Warehouse capacity counts **total item quantity** across all stacks (not unique item types).
 */
export class WarehouseSystem {
  private warehouse: Record<string, number> = {};
  private seeds: Record<string, number> = {};
  private level = 1;

  constructor() {
    this.resetDefaults();
  }

  private resetDefaults(): void {
    this.warehouse = {
      [ITEM_IDS.WOOD]: 5,
      [ITEM_IDS.STONE]: 5,
    };
    this.seeds = {
      [ITEM_IDS.SEEDS_WHEAT]: 8,
      [ITEM_IDS.SEEDS_CORN]: 4,
      [ITEM_IDS.SEEDS_CARROT]: 2,
      [ITEM_IDS.SEEDS_PUMPKIN]: 1,
      [ITEM_IDS.SEEDS_TOMATO]: 2,
    };
    this.level = 1;
  }

  getLevel(): number {
    return this.level;
  }

  getCapacity(): number {
    return warehouseCapacityForLevel(this.level);
  }

  /** Total quantity of all items (warehouse + seeds). */
  getUsedCapacity(): number {
    let total = 0;
    for (const qty of Object.values(this.warehouse)) total += qty;
    for (const qty of Object.values(this.seeds)) total += qty;
    return total;
  }

  getCount(itemId: string): number {
    if (isSeedItem(itemId)) return this.seeds[itemId] ?? 0;
    return this.warehouse[itemId] ?? 0;
  }

  canAdd(amount: number): boolean {
    if (amount <= 0) return true;
    const current = this.getUsedCapacity();
    return current + amount <= this.getCapacity();
  }

  addItem(itemId: string, amount: number): boolean {
    if (amount <= 0) return true;
    if (!this.canAdd(amount)) return false;
    if (isSeedItem(itemId)) {
      this.seeds[itemId] = (this.seeds[itemId] ?? 0) + amount;
    } else {
      this.warehouse[itemId] = (this.warehouse[itemId] ?? 0) + amount;
    }
    return true;
  }

  removeItem(itemId: string, amount: number): boolean {
    const current = this.getCount(itemId);
    if (current < amount) return false;
    if (isSeedItem(itemId)) {
      this.seeds[itemId] = current - amount;
      if (this.seeds[itemId] === 0) delete this.seeds[itemId];
    } else {
      this.warehouse[itemId] = current - amount;
      if (this.warehouse[itemId] === 0) delete this.warehouse[itemId];
    }
    return true;
  }

  has(itemId: string, amount: number): boolean {
    return this.getCount(itemId) >= amount;
  }

  getWarehouseItems(): Record<string, number> {
    return { ...this.warehouse };
  }

  getSeedItems(): Record<string, number> {
    return { ...this.seeds };
  }

  /** Flat map for save migration / legacy */
  getAllItems(): Record<string, number> {
    return { ...this.warehouse, ...this.seeds };
  }

  load(data: { warehouse?: Record<string, number>; seeds?: Record<string, number>; level?: number }): void {
    this.warehouse = { ...(data.warehouse ?? {}) };
    this.seeds = { ...(data.seeds ?? {}) };
    this.level = Math.min(WAREHOUSE.maxLevel, Math.max(1, data.level ?? 1));
  }

  loadFlatInventory(items: Record<string, number>): void {
    this.warehouse = {};
    this.seeds = {};
    for (const [id, qty] of Object.entries(items)) {
      if (qty <= 0) continue;
      if (isSeedItem(id)) this.seeds[id] = qty;
      else this.warehouse[id] = qty;
    }
  }

  addDefaultIfMissing(): void {
    const seedDefaults: Record<string, number> = {
      [ITEM_IDS.SEEDS_WHEAT]: 8,
      [ITEM_IDS.SEEDS_CORN]: 4,
      [ITEM_IDS.SEEDS_CARROT]: 2,
      [ITEM_IDS.SEEDS_PUMPKIN]: 1,
      [ITEM_IDS.SEEDS_TOMATO]: 2,
    };
    for (const [id, qty] of Object.entries(seedDefaults)) {
      if (this.seeds[id] === undefined) this.seeds[id] = qty;
    }
    if (this.warehouse[ITEM_IDS.SHOVEL] === undefined) this.warehouse[ITEM_IDS.SHOVEL] = 1;
  }

  getUpgradeCost(): { coins: number; wood: number; stone: number } | null {
    const next = this.level + 1;
    if (next > WAREHOUSE.maxLevel) return null;
    return WAREHOUSE.upgradeCosts[next - 2];
  }

  canUpgrade(coins: number): boolean {
    const cost = this.getUpgradeCost();
    if (!cost) return false;
    return (
      coins >= cost.coins &&
      this.getCount(ITEM_IDS.WOOD) >= cost.wood &&
      this.getCount(ITEM_IDS.STONE) >= cost.stone
    );
  }

  upgradeWarehouse(coins: number, spendCoins: (amount: number) => boolean): boolean {
    const cost = this.getUpgradeCost();
    if (!cost || !this.canUpgrade(coins)) return false;
    if (!spendCoins(cost.coins)) return false;
    if (!this.removeItem(ITEM_IDS.WOOD, cost.wood)) return false;
    if (!this.removeItem(ITEM_IDS.STONE, cost.stone)) return false;
    this.level += 1;
    return true;
  }

  getAvailableSeeds(): InventorySlot[] {
    return ALL_SEED_IDS.filter((id) => this.getCount(id) > 0).map((id) => this.toSlot(id));
  }

  getDisplaySlots(category?: ItemCategory | 'all'): InventorySlot[] {
    const entries: [string, number][] = [];
    const push = (map: Record<string, number>) => {
      for (const [id, qty] of Object.entries(map)) {
        if (qty > 0) entries.push([id, qty]);
      }
    };

    if (!category || category === 'all') {
      push(this.warehouse);
      push(this.seeds);
    } else if (category === 'seeds') {
      push(this.seeds);
    } else {
      push(this.warehouse);
    }

    return entries
      .filter(([id]) => {
        if (!category || category === 'all') return true;
        const cat = this.slotCategory(id);
        return cat === category;
      })
      .map(([id, count]) => this.toSlot(id, count));
  }

  private slotCategory(id: string): ItemCategory | null {
    if (isSeedItem(id)) return 'seeds';
    for (const [cat, ids] of Object.entries(ITEM_CATEGORIES) as [ItemCategory, readonly string[]][]) {
      if (ids.includes(id)) return cat;
    }
    return null;
  }

  private toSlot(id: string, count?: number): InventorySlot {
    return {
      id,
      label: ITEM_LABELS[id] ?? id,
      count: count ?? this.getCount(id),
      iconKey: ITEM_ICON_KEYS[id] ?? 'seed',
      category: this.slotCategory(id),
    };
  }

  consumeSeedForCrop(kind: CropKind): boolean {
    return this.removeItem(CROP_TO_SEED[kind], 1);
  }

  hasSeedForCrop(kind: CropKind): boolean {
    return this.has(CROP_TO_SEED[kind], 1);
  }

  cropKindFromSeedId(seedId: string): CropKind | null {
    return SEED_TO_CROP[seedId] ?? null;
  }
}

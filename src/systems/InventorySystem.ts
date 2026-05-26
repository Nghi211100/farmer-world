import type { CropKind } from '../config/gameConfig';
import { WarehouseSystem, type InventorySlot } from './WarehouseSystem';

export type { InventorySlot };

/** Back-compat facade over WarehouseSystem */
export class InventorySystem {
  readonly warehouse: WarehouseSystem;

  constructor() {
    this.warehouse = new WarehouseSystem();
  }

  getItems(): Record<string, number> {
    return this.warehouse.getAllItems();
  }

  getCount(itemId: string): number {
    return this.warehouse.getCount(itemId);
  }

  add(itemId: string, amount: number): boolean {
    return this.warehouse.addItem(itemId, amount);
  }

  remove(itemId: string, amount: number): boolean {
    return this.warehouse.removeItem(itemId, amount);
  }

  has(itemId: string, amount: number): boolean {
    return this.warehouse.has(itemId, amount);
  }

  canAdd(_itemId: string, amount: number): boolean {
    return this.warehouse.canAdd(amount);
  }

  load(data: Record<string, number>): void {
    this.warehouse.loadFlatInventory(data);
  }

  loadWarehouse(data: {
    warehouse?: Record<string, number>;
    seeds?: Record<string, number>;
    level?: number;
  }): void {
    this.warehouse.load(data);
  }

  getWarehouseExport(): {
    warehouse: Record<string, number>;
    seeds: Record<string, number>;
    level: number;
  } {
    return {
      warehouse: this.warehouse.getWarehouseItems(),
      seeds: this.warehouse.getSeedItems(),
      level: this.warehouse.getLevel(),
    };
  }

  addDefaultIfMissing(): void {
    this.warehouse.addDefaultIfMissing();
  }

  getAvailableSeeds(): InventorySlot[] {
    return this.warehouse.getAvailableSeeds();
  }

  getDisplaySlots(category?: Parameters<WarehouseSystem['getDisplaySlots']>[0]): InventorySlot[] {
    return this.warehouse.getDisplaySlots(category);
  }

  consumeSeedForCrop(kind: CropKind): boolean {
    return this.warehouse.consumeSeedForCrop(kind);
  }

  hasSeedForCrop(kind: CropKind): boolean {
    return this.warehouse.hasSeedForCrop(kind);
  }

  cropKindFromSeedId(seedId: string): CropKind | null {
    return this.warehouse.cropKindFromSeedId(seedId);
  }
}

import {
  DEFAULT_COINS,
  DEFAULT_ENERGY,
  DEFAULT_GEMS,
  FarmTool,
  ITEM_IDS,
  isSeedItem,
  SAVE_KEY,
  SAVE_VERSION,
  type GameSaveData,
  type CropTileData,
} from '../config/gameConfig';
import type { BuildingData } from '../config/gameConfig';
import type { GridSystem } from './GridSystem';
import type { FarmingSystem } from './FarmingSystem';
import { SaveMigrationHelper } from './FarmingSystem';
import type { InventorySystem } from './InventorySystem';
import type { EconomySystem } from './EconomySystem';
import type { EnergySystem } from './EnergySystem';

export interface SaveableState {
  coins: number;
  gems: number;
  energy: number;
  energyUpdatedAt: number;
  landPurchases: number;
  selectedSeed?: string;
  selectedTool?: FarmTool;
}

export class SaveSystem {
  save(
    state: SaveableState,
    farming: FarmingSystem,
    buildings: BuildingData[],
    inventory: InventorySystem,
    grid: GridSystem
  ): void {
    farming.tickAll(Date.now());
    const wh = inventory.getWarehouseExport();
    const data: GameSaveData = {
      version: SAVE_VERSION,
      coins: state.coins,
      gems: state.gems,
      energy: state.energy,
      energyUpdatedAt: state.energyUpdatedAt,
      warehouseLevel: wh.level,
      warehouse: wh.warehouse,
      seeds: wh.seeds,
      crops: farming.exportCrops(),
      buildings,
      landPurchases: state.landPurchases,
      selectedSeed: state.selectedSeed,
      selectedTool: state.selectedTool,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      localStorage.setItem(`${SAVE_KEY}-grid`, JSON.stringify(grid.getAllCells()));
    } catch (e) {
      console.warn('[SaveSystem] Save failed', e);
    }
  }

  hasSave(): boolean {
    try {
      if (localStorage.getItem(SAVE_KEY)) return true;
      return (
        !!localStorage.getItem('your-farm-save-v3') ||
        !!localStorage.getItem('your-farm-save-v2') ||
        !!localStorage.getItem('your-farm-save-v1')
      );
    } catch {
      return false;
    }
  }

  load(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return this.migrateFromOlderSaves();
      }
      const data = JSON.parse(raw) as GameSaveData;
      return this.normalizeSave(data);
    } catch (e) {
      console.warn('[SaveSystem] Failed to load save', e);
      return null;
    }
  }

  private migrateFromOlderSaves(): GameSaveData | null {
    const v3 = localStorage.getItem('your-farm-save-v3');
    if (v3) {
      try {
        const data = JSON.parse(v3) as GameSaveData;
        const migrated = this.normalizeSave(this.migrateV3ToV4(data));
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        /* fall through */
      }
    }
    const v2 = localStorage.getItem('your-farm-save-v2');
    if (v2) {
      try {
        const data = JSON.parse(v2) as GameSaveData;
        const migrated = this.normalizeSave(this.migrateV3ToV4(this.migrateV2ToV3(data)));
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        /* fall through */
      }
    }
    return this.migrateFromV1();
  }

  private migrateV2ToV3(data: GameSaveData): GameSaveData {
    const crops: Record<string, CropTileData> = {};
    for (const [k, v] of Object.entries(data.crops ?? {})) {
      crops[k] = SaveMigrationHelper.migrateCropTile(v);
    }
    return {
      ...data,
      version: 3,
      crops,
      inventory: SaveMigrationHelper.migrateInventory(data.inventory ?? {}),
      selectedTool: data.selectedTool ?? FarmTool.HOE,
    };
  }

  private migrateV3ToV4(data: GameSaveData): GameSaveData {
    const flat = SaveMigrationHelper.migrateInventory(data.inventory ?? {});
    const warehouse: Record<string, number> = {};
    const seeds: Record<string, number> = {};
    for (const [id, qty] of Object.entries(flat)) {
      if (qty <= 0) continue;
      if (isSeedItem(id)) seeds[id] = qty;
      else warehouse[id] = qty;
    }
    return {
      version: SAVE_VERSION,
      coins: data.coins ?? DEFAULT_COINS,
      gems: data.gems ?? DEFAULT_GEMS,
      energy: data.energy ?? DEFAULT_ENERGY,
      energyUpdatedAt: data.energyUpdatedAt ?? Date.now(),
      warehouseLevel: data.warehouseLevel ?? 1,
      warehouse,
      seeds,
      crops: data.crops ?? {},
      buildings: data.buildings ?? [],
      landPurchases: data.landPurchases ?? 0,
      selectedSeed: data.selectedSeed,
      selectedTool: data.selectedTool ?? FarmTool.HOE,
    };
  }

  private migrateFromV1(): GameSaveData | null {
    try {
      const raw = localStorage.getItem('your-farm-save-v1');
      if (!raw) return null;
      const old = JSON.parse(raw) as GameSaveData & { landPurchases?: number };
      const data = this.normalizeSave(
        this.migrateV3ToV4(
          this.migrateV2ToV3({
            ...old,
            landPurchases: old.landPurchases ?? 0,
            buildings: (old.buildings ?? []).map((b) => ({
              ...b,
              level: (b as BuildingData).level ?? 1,
            })),
          })
        )
      );
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  }

  private normalizeSave(data: GameSaveData): GameSaveData {
    if ((data.version ?? 0) < 4) {
      return this.migrateV3ToV4(data);
    }
    const crops: Record<string, CropTileData> = {};
    for (const [k, v] of Object.entries(data.crops ?? {})) {
      crops[k] = SaveMigrationHelper.migrateCropTile(v);
    }
    return {
      ...data,
      version: SAVE_VERSION,
      landPurchases: data.landPurchases ?? 0,
      buildings: (data.buildings ?? []).map((b) => ({
        ...b,
        level: b.level ?? 1,
      })),
      warehouse: data.warehouse ?? {},
      seeds: data.seeds ?? {},
      warehouseLevel: data.warehouseLevel ?? 1,
      energyUpdatedAt: data.energyUpdatedAt ?? Date.now(),
      crops,
      selectedTool: data.selectedTool ?? FarmTool.HOE,
    };
  }

  loadGrid(): ReturnType<GridSystem['getAllCells']> | null {
    try {
      let raw = localStorage.getItem(`${SAVE_KEY}-grid`);
      if (!raw) raw = localStorage.getItem('your-farm-save-v3-grid');
      if (!raw) raw = localStorage.getItem('your-farm-save-v2-grid');
      if (!raw) raw = localStorage.getItem('your-farm-save-v1-grid');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  applySave(
    data: GameSaveData,
    farming: FarmingSystem,
    inventory: InventorySystem,
    economy: EconomySystem,
    energy: EnergySystem
  ): SaveableState {
    farming.importCrops(data.crops);
    if (data.warehouse !== undefined || data.seeds !== undefined) {
      inventory.loadWarehouse({
        warehouse: data.warehouse,
        seeds: data.seeds,
        level: data.warehouseLevel,
      });
    } else if (data.inventory) {
      inventory.load(SaveMigrationHelper.migrateInventory(data.inventory));
    }
    inventory.addDefaultIfMissing();
    economy.setCoins(data.coins);
    economy.setLandPurchases(data.landPurchases ?? 0);
    energy.setEnergy(data.energy ?? DEFAULT_ENERGY, data.energyUpdatedAt ?? Date.now());
    this.applyOfflineEnergy(energy);
    return {
      coins: data.coins,
      gems: data.gems,
      energy: energy.getEnergy(),
      energyUpdatedAt: energy.getUpdatedAt(),
      landPurchases: data.landPurchases ?? 0,
      selectedSeed: data.selectedSeed,
      selectedTool: data.selectedTool ?? FarmTool.HOE,
    };
  }

  /** Regenerate energy from time away (+recoveryAmount per recoveryIntervalMs). */
  applyOfflineEnergy(energy: EnergySystem): void {
    energy.applyRecovery(Date.now());
  }

  static createDefault(): GameSaveData {
    return {
      version: SAVE_VERSION,
      coins: DEFAULT_COINS,
      gems: DEFAULT_GEMS,
      energy: DEFAULT_ENERGY,
      energyUpdatedAt: Date.now(),
      warehouseLevel: 1,
      warehouse: { [ITEM_IDS.WOOD]: 5, [ITEM_IDS.STONE]: 5 },
      seeds: {
        [ITEM_IDS.SEEDS_WHEAT]: 8,
        [ITEM_IDS.SEEDS_CORN]: 4,
        [ITEM_IDS.SEEDS_CARROT]: 2,
        [ITEM_IDS.SEEDS_PUMPKIN]: 1,
        [ITEM_IDS.SEEDS_TOMATO]: 2,
      },
      crops: {},
      buildings: [],
      landPurchases: 0,
      selectedTool: FarmTool.HOE,
    };
  }
}

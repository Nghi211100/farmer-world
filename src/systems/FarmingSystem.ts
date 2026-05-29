import {
  CROP_IDS,
  getCropDef,
  textureKeyForStage,
  type CropId,
  type CropDefinition,
} from '../config/CropConfig';
import {
  CropLifecycleState,
  FARMING,
  isDebugMode,
  type CropKind,
  type CropTileData,
} from '../config/gameConfig';
import {
  applyFarmActivityStamp,
  applySoilIdleDryState,
  isPlotSubjectToSoilIdle,
  isSoilIdleDryAt,
  shouldBecomeSoilIdleDry,
  type FarmActivityKind,
  type SoilIdlePlotContext,
} from './soilIdleLogic';
import type { GridSystem } from './GridSystem';
import {
  advanceCropGrowth,
  inferWateredMilestoneCount,
  isCropDry,
  remainingGrowSec,
  growthRateForCrop,
  type CropGrowthState,
} from './farmingGrowthLogic';

export interface CropGrowthInfo {
  visualStage: number;
  progress: number;
  /** Wall-clock seconds until mature at current growth rate. */
  remainingSec: number;
  waterLevel: number;
  needsWater: boolean;
  /** True when dry: growth continues at {@link FARMING.growthRateWithoutWater}. */
  slowGrowth: boolean;
  /** Current growth speed multiplier (1 or growthRateWithoutWater). */
  growthRate: number;
}

function cropKindOf(data: CropTileData): CropKind | null {
  return data.cropType ?? data.kind ?? null;
}

function growthStateOf(crop: CropTileData): CropGrowthState {
  return {
    growthElapsedSec: crop.growthElapsedSec ?? 0,
    wateredMilestoneCount: crop.wateredMilestoneCount ?? 0,
  };
}

function syncWaterLevelFromMilestones(crop: CropTileData, def: CropDefinition): void {
  crop.waterLevel = isCropDry(growthStateOf(crop), def.waterMilestonesSec) ? 0 : FARMING.maxWater;
}

function normalizeCrop(data: CropTileData): CropTileData {
  const kind = cropKindOf(data);
  const now = Date.now();
  const crop: CropTileData = {
    cropType: kind ?? undefined,
    kind: kind ?? undefined,
    stage: data.stage ?? CropLifecycleState.EMPTY,
    waterLevel: data.waterLevel ?? FARMING.maxWater,
    wateredMilestoneCount: data.wateredMilestoneCount ?? 0,
    plantedAt: data.plantedAt ?? 0,
    lastWaterTime: data.lastWaterTime ?? now,
    growthElapsedSec: data.growthElapsedSec ?? 0,
    lastTickAt: data.lastTickAt ?? now,
    dug: data.dug ?? false,
    lastFarmActivityAt: data.lastFarmActivityAt,
    soilIdleDry: data.soilIdleDry ?? false,
    soilIdleDrySince: data.soilIdleDrySince,
  };
  if (kind) {
    const def = getCropDef(kind);
    if (crop.wateredMilestoneCount === 0 && data.wateredMilestoneCount === undefined) {
      crop.wateredMilestoneCount = inferWateredMilestoneCount(
        crop.growthElapsedSec,
        crop.waterLevel,
        def.waterMilestonesSec
      );
    }
    syncWaterLevelFromMilestones(crop, def);
  }
  return crop;
}

export class FarmingSystem {
  private crops = new Map<string, CropTileData>();
  private onChange?: () => void;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(private grid: GridSystem) {}

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  startTick(intervalMs = 1000): void {
    this.stopTick();
    this.tickTimer = setInterval(() => this.tickAll(Date.now()), intervalMs);
  }

  stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  private key(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  getCrop(gx: number, gy: number): CropTileData | null {
    const c = this.crops.get(this.key(gx, gy));
    return c ? { ...c } : null;
  }

  private setCrop(gx: number, gy: number, data: CropTileData): void {
    this.crops.set(this.key(gx, gy), data);
    this.onChange?.();
  }

  private soilIdleContext(gx: number, gy: number, crop: CropTileData | null): SoilIdlePlotContext {
    const cell = this.grid.getCell(gx, gy);
    return {
      unlocked: this.grid.isFarmUnlocked(gx, gy),
      cellType: cell?.type ?? 'grass',
      crop,
    };
  }

  isPlotSubjectToSoilIdle(gx: number, gy: number): boolean {
    return isPlotSubjectToSoilIdle(this.soilIdleContext(gx, gy, this.getCrop(gx, gy)));
  }

  isSoilIdleDry(gx: number, gy: number, now = Date.now()): boolean {
    const crop = this.crops.get(this.key(gx, gy));
    if (!crop) return false;
    if (crop.soilIdleDry) return true;
    return isSoilIdleDryAt(
      crop.lastFarmActivityAt,
      now,
      isPlotSubjectToSoilIdle(this.soilIdleContext(gx, gy, crop))
    );
  }

  /** Record canh tác and clear neglect-dry. */
  touchFarmActivity(gx: number, gy: number, _kind: FarmActivityKind, now = Date.now()): void {
    const crop = this.crops.get(this.key(gx, gy));
    if (!crop) return;
    applyFarmActivityStamp(crop, now);
    this.onChange?.();
  }

  private markFarmActivity(gx: number, gy: number, kind: FarmActivityKind, now = Date.now()): void {
    this.touchFarmActivity(gx, gy, kind, now);
  }

  private applyNeglectDryIfNeeded(gx: number, gy: number, now: number): boolean {
    const crop = this.crops.get(this.key(gx, gy));
    if (!crop) return false;
    const subject = isPlotSubjectToSoilIdle(this.soilIdleContext(gx, gy, crop));
    if (!shouldBecomeSoilIdleDry(crop, now, subject)) return false;
    applySoilIdleDryState(crop, now);
    this.grid.setSoilWaterLevel(gx, gy, 0);
    return true;
  }

  private tickSoilIdle(now: number): boolean {
    let changed = false;
    for (const [k] of this.crops.entries()) {
      const [gx, gy] = k.split(',').map(Number);
      if (this.applyNeglectDryIfNeeded(gx, gy, now)) changed = true;
    }
    return changed;
  }

  /** After load/offline: apply elapsed neglect without waiting for next tick. */
  applySoilIdleAfterLoad(now = Date.now()): void {
    this.tickSoilIdle(now);
    this.onChange?.();
  }

  /** Dev/test: force neglect-dry visuals on a tilled plot without waiting 2 minutes. */
  forceSoilIdleDryForTest(gx: number, gy: number, now = Date.now()): boolean {
    const crop = this.crops.get(this.key(gx, gy));
    if (!crop || !isPlotSubjectToSoilIdle(this.soilIdleContext(gx, gy, crop))) return false;
    crop.lastFarmActivityAt = now - FARMING.soilIdleDryMs - 1;
    applySoilIdleDryState(crop, now);
    this.grid.setSoilWaterLevel(gx, gy, 0);
    this.onChange?.();
    return true;
  }

  hasCropRecord(gx: number, gy: number): boolean {
    return this.crops.has(this.key(gx, gy));
  }

  canDig(gx: number, gy: number): boolean {
    const cell = this.grid.getCell(gx, gy);
    if (!cell || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path') return false;
    if (cell.type === 'soil' && !this.grid.isFarmUnlocked(gx, gy)) return false;
    const crop = this.getCrop(gx, gy);
    if (!crop) return cell.type === 'soil' || cell.type === 'grass';
    return (
      crop.stage === CropLifecycleState.EMPTY ||
      crop.stage === CropLifecycleState.HARVESTED
    );
  }

  dig(gx: number, gy: number): boolean {
    if (!this.canDig(gx, gy)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return false;

    if (cell.type === 'grass') {
      cell.type = 'soil';
      cell.walkable = true;
    }

    const now = Date.now();
    const hadRecord = this.hasCropRecord(gx, gy);
    this.setCrop(gx, gy, {
      stage: CropLifecycleState.DIGGING,
      waterLevel: 0,
      plantedAt: 0,
      lastWaterTime: now,
      growthElapsedSec: 0,
      lastTickAt: now,
      dug: false,
      soilIdleDry: false,
      soilIdleDrySince: undefined,
    });
    this.markFarmActivity(gx, gy, 'dig', now);

    this.grid.setSoilWaterLevel(gx, gy, 0);

    setTimeout(() => {
      const cur = this.crops.get(this.key(gx, gy));
      if (cur?.stage === CropLifecycleState.DIGGING) {
        const doneAt = Date.now();
        applyFarmActivityStamp(cur, doneAt);
        this.setCrop(gx, gy, {
          ...cur,
          stage: CropLifecycleState.EMPTY,
          dug: true,
          lastTickAt: doneAt,
        });
        if (hadRecord) {
          this.grid.setSoilWaterLevel(gx, gy, FARMING.waterRestoreAmount);
        }
      }
    }, FARMING.digDurationMs);

    return true;
  }

  canPlant(gx: number, gy: number): boolean {
    if (this.isSoilIdleDry(gx, gy)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell || cell.type !== 'soil' || cell.object || !this.grid.isFarmUnlocked(gx, gy)) return false;
    const crop = this.getCrop(gx, gy);
    if (!crop) return false;
    return crop.stage === CropLifecycleState.EMPTY && crop.dug === true;
  }

  plant(gx: number, gy: number, kind: CropKind): boolean {
    if (!this.canPlant(gx, gy)) return false;
    const now = Date.now();
    this.setCrop(gx, gy, {
      cropType: kind,
      kind,
      stage: CropLifecycleState.PLANTED,
      waterLevel: FARMING.maxWater,
      wateredMilestoneCount: 0,
      plantedAt: now,
      lastWaterTime: now,
      growthElapsedSec: 0,
      lastTickAt: now,
      dug: true,
      soilIdleDry: false,
      soilIdleDrySince: undefined,
    });
    this.markFarmActivity(gx, gy, 'plant', now);
    return true;
  }

  /** Dug, unplanted soil — drives soil / mud / wet_soil ground textures */
  isDugEmptySoil(gx: number, gy: number): boolean {
    const crop = this.getCrop(gx, gy);
    if (!crop || cropKindOf(crop)) return false;
    return crop.dug === true;
  }

  /** Tilled plots (empty dug or crop) use soil / mud / wet_soil instead of empty_plot. */
  showsSoilMoistureGround(gx: number, gy: number): boolean {
    const crop = this.getCrop(gx, gy);
    if (!crop || crop.stage === CropLifecycleState.DIGGING) return false;
    if (cropKindOf(crop)) return true;
    return crop.dug === true;
  }

  /** Moisture for ground texture; neglect-dry and idle-dry plots read as 0 (light soil). */
  getGroundSoilWaterLevel(gx: number, gy: number): number {
    if (this.isSoilIdleDry(gx, gy)) return 0;
    return this.grid.getSoilWaterLevel(gx, gy);
  }

  /** Dug empty soil (no crop sprite) — moisture lives on the grid cell */
  canWaterEmptySoil(gx: number, gy: number): boolean {
    const cell = this.grid.getCell(gx, gy);
    if (!cell || cell.type !== 'soil' || !this.grid.isFarmUnlocked(gx, gy)) return false;
    const crop = this.getCrop(gx, gy);
    if (!crop) return false;
    if (cropKindOf(crop)) return false;
    return crop.stage === CropLifecycleState.EMPTY && crop.dug === true;
  }

  canWater(gx: number, gy: number): boolean {
    if (this.isSoilIdleDry(gx, gy) && this.isPlotSubjectToSoilIdle(gx, gy)) return true;
    if (this.canWaterEmptySoil(gx, gy)) return true;
    const crop = this.getCrop(gx, gy);
    if (!crop) return false;
    const kind = cropKindOf(crop);
    if (!kind) return false;
    const waterable = [
      CropLifecycleState.PLANTED,
      CropLifecycleState.STAGE1,
      CropLifecycleState.STAGE2,
      CropLifecycleState.STAGE3,
      CropLifecycleState.READY,
    ];
    return waterable.includes(crop.stage);
  }

  water(gx: number, gy: number): boolean {
    const now = Date.now();
    if (this.isSoilIdleDry(gx, gy) && this.isPlotSubjectToSoilIdle(gx, gy)) {
      const crop = this.crops.get(this.key(gx, gy));
      if (crop) applyFarmActivityStamp(crop, now);
      if (this.canWaterEmptySoil(gx, gy)) {
        this.grid.addSoilWater(gx, gy, FARMING.waterRestoreAmount);
        this.onChange?.();
        return true;
      }
    }
    if (this.canWaterEmptySoil(gx, gy)) {
      this.grid.addSoilWater(gx, gy, FARMING.waterRestoreAmount);
      this.markFarmActivity(gx, gy, 'water', now);
      this.onChange?.();
      return true;
    }
    if (!this.canWater(gx, gy)) return false;
    const crop = this.crops.get(this.key(gx, gy))!;
    this.simulateTile(crop, now);
    const kind = cropKindOf(crop);
    if (kind) {
      const def = getCropDef(kind);
      const state = growthStateOf(crop);
      if (isCropDry(state, def.waterMilestonesSec)) {
        crop.wateredMilestoneCount = Math.min(
          state.wateredMilestoneCount + 1,
          def.waterMilestonesSec.length
        );
      }
      syncWaterLevelFromMilestones(crop, def);
    } else {
      crop.waterLevel = FARMING.maxWater;
    }
    crop.lastWaterTime = now;
    crop.lastTickAt = now;
    this.grid.setSoilWaterLevel(gx, gy, FARMING.waterRestoreAmount);
    this.markFarmActivity(gx, gy, 'water', now);
    this.onChange?.();
    return true;
  }

  /** Keep moisture soil visible under crop sprites (crop uses same diamond anchor as ground). */
  hidesGroundUnderCrop(_gx: number, _gy: number): boolean {
    return false;
  }

  /** Dig animation on ground layer only (farm_plot, no crop sprite). */
  showsFarmPlotGround(gx: number, gy: number): boolean {
    return this.getCrop(gx, gy)?.stage === CropLifecycleState.DIGGING;
  }

  isReady(gx: number, gy: number): boolean {
    if (this.isSoilIdleDry(gx, gy)) return false;
    return this.getCrop(gx, gy)?.stage === CropLifecycleState.READY;
  }

  /** Crop reached READY stage but plot is neglect-dry (harvest blocked). */
  isReadyButSoilIdleDry(gx: number, gy: number): boolean {
    if (!this.isSoilIdleDry(gx, gy)) return false;
    return this.getCrop(gx, gy)?.stage === CropLifecycleState.READY;
  }

  harvest(gx: number, gy: number): { kind: CropKind; yield: number } | null {
    if (this.isSoilIdleDry(gx, gy)) return null;
    const crop = this.getCrop(gx, gy);
    if (!crop || crop.stage !== CropLifecycleState.READY) return null;
    const kind = cropKindOf(crop);
    if (!kind) return null;
    const yieldAmt = getCropDef(kind).yield;
    const now = Date.now();
    this.grid.setSoilWaterLevel(gx, gy, 0);
    this.setCrop(gx, gy, {
      stage: CropLifecycleState.HARVESTED,
      waterLevel: 0,
      plantedAt: 0,
      lastWaterTime: now,
      growthElapsedSec: 0,
      lastTickAt: now,
      dug: true,
      soilIdleDry: false,
      soilIdleDrySince: undefined,
    });
    this.markFarmActivity(gx, gy, 'harvest', now);
    setTimeout(() => {
      const cur = this.crops.get(this.key(gx, gy));
      if (cur?.stage === CropLifecycleState.HARVESTED) {
        this.setCrop(gx, gy, {
          ...cur,
          stage: CropLifecycleState.EMPTY,
          dug: true,
        });
      }
    }, 400);
    return { kind, yield: yieldAmt };
  }

  getGrowthInfo(crop: CropTileData): CropGrowthInfo | null {
    const kind = cropKindOf(crop);
    if (!kind) return null;
    const def = getCropDef(kind);
    const state = growthStateOf(crop);
    const progress = Math.min(1, state.growthElapsedSec / def.growTimeSec);
    const visualStage = this.visualStageFromProgress(progress, crop.stage);
    const needsWater = isCropDry(state, def.waterMilestonesSec);
    const growing = [
      CropLifecycleState.PLANTED,
      CropLifecycleState.STAGE1,
      CropLifecycleState.STAGE2,
      CropLifecycleState.STAGE3,
    ].includes(crop.stage);
    const slowGrowth = needsWater && growing;
    const growthRate = growthRateForCrop(state, def.waterMilestonesSec);
    const remainingSec = remainingGrowSec(state, def);

    return {
      visualStage,
      progress,
      remainingSec,
      waterLevel: needsWater ? 0 : FARMING.maxWater,
      needsWater,
      slowGrowth,
      growthRate,
    };
  }

  private visualStageFromProgress(progress: number, stage: CropLifecycleState): number {
    if (stage === CropLifecycleState.READY) return 4;
    if (stage === CropLifecycleState.HARVESTED || stage === CropLifecycleState.EMPTY) return 0;
    if (progress >= 1) return 4;
    if (progress >= 0.75) return 4;
    if (progress >= 0.5) return 3;
    if (progress >= 0.25) return 2;
    return 1;
  }

  private stageFromProgress(progress: number): CropLifecycleState {
    if (progress >= 1) return CropLifecycleState.READY;
    if (progress >= 0.75) return CropLifecycleState.STAGE3;
    if (progress >= 0.5) return CropLifecycleState.STAGE2;
    if (progress >= 0.25) return CropLifecycleState.STAGE1;
    return CropLifecycleState.PLANTED;
  }

  simulateTile(crop: CropTileData, now: number): void {
    const kind = cropKindOf(crop);
    if (!kind) return;

    const growing = [
      CropLifecycleState.PLANTED,
      CropLifecycleState.STAGE1,
      CropLifecycleState.STAGE2,
      CropLifecycleState.STAGE3,
      CropLifecycleState.READY,
    ];
    if (!growing.includes(crop.stage)) return;

    const def = getCropDef(kind);
    let elapsedSec = Math.max(0, (now - crop.lastTickAt) / 1000);
    if (isDebugMode()) elapsedSec *= 60;
    if (elapsedSec <= 0) return;

    if (crop.stage !== CropLifecycleState.READY) {
      const advanced = advanceCropGrowth(growthStateOf(crop), elapsedSec, def);
      crop.growthElapsedSec = advanced.growthElapsedSec;
      crop.wateredMilestoneCount = advanced.wateredMilestoneCount;
      syncWaterLevelFromMilestones(crop, def);
      const progress = crop.growthElapsedSec / def.growTimeSec;
      crop.stage = this.stageFromProgress(progress);
    }

    crop.lastTickAt = now;
  }

  tickAll(now = Date.now()): void {
    let changed = false;
    for (const crop of this.crops.values()) {
      const before = crop.stage;
      this.simulateTile(crop, now);
      if (crop.stage !== before) changed = true;
    }
    if (this.tickSoilIdle(now)) changed = true;
    if (changed || this.crops.size > 0) this.onChange?.();
  }

  applyOfflineProgress(now = Date.now()): void {
    for (const crop of this.crops.values()) {
      this.simulateTile(crop, now);
    }
    this.tickSoilIdle(now);
    this.onChange?.();
  }

  getTextureKey(crop: CropTileData): string | null {
    const kind = cropKindOf(crop);
    if (!kind) {
      // DIGGING: visual on ground layer only (see showsFarmPlotGround)
      return null;
    }
    const info = this.getGrowthInfo(crop);
    const stage = info?.visualStage ?? 1;
    if (crop.stage === CropLifecycleState.READY) {
      return textureKeyForStage(getCropDef(kind).spritePrefix, 4);
    }
    if (
      crop.stage === CropLifecycleState.EMPTY ||
      crop.stage === CropLifecycleState.HARVESTED ||
      crop.stage === CropLifecycleState.DIGGING
    ) {
      return null;
    }
    return textureKeyForStage(getCropDef(kind).spritePrefix, stage);
  }

  exportCrops(): Record<string, CropTileData> {
    const out: Record<string, CropTileData> = {};
    this.crops.forEach((v, k) => {
      out[k] = { ...v };
    });
    return out;
  }

  importCrops(data: Record<string, CropTileData>, notify = false): void {
    this.crops.clear();
    const now = Date.now();
    for (const [k, raw] of Object.entries(data)) {
      const v = normalizeCrop(SaveMigrationHelper.migrateCropTile(raw));
      v.lastTickAt = now;
      this.crops.set(k, v);
    }
    const migratedNow = Date.now();
    for (const crop of this.crops.values()) {
      if (crop.lastFarmActivityAt == null) {
        applyFarmActivityStamp(crop, migratedNow);
      }
      this.simulateTile(crop, migratedNow);
    }
    this.tickSoilIdle(migratedNow);
    if (notify) this.onChange?.();
  }

  needsWater(gx: number, gy: number): boolean {
    const crop = this.getCrop(gx, gy);
    if (!crop) return false;
    const info = this.getGrowthInfo(crop);
    return info?.needsWater ?? false;
  }

  isGrowing(gx: number, gy: number): boolean {
    const crop = this.getCrop(gx, gy);
    if (!crop) return false;
    return [
      CropLifecycleState.PLANTED,
      CropLifecycleState.STAGE1,
      CropLifecycleState.STAGE2,
      CropLifecycleState.STAGE3,
    ].includes(crop.stage);
  }
}

/** Save migration from v1/v2 crop format */
export class SaveMigrationHelper {
  static migrateCropTile(raw: CropTileData & { state?: string }): CropTileData {
    const now = Date.now();
    const legacyState = (raw as { state?: string }).state;

    if (raw.stage && Object.values(CropLifecycleState).includes(raw.stage as CropLifecycleState)) {
      const kind = raw.cropType ?? raw.kind;
      const migrated: CropTileData = {
        ...raw,
        cropType: kind,
        kind,
        waterLevel: raw.waterLevel ?? FARMING.maxWater,
        wateredMilestoneCount: raw.wateredMilestoneCount,
        lastWaterTime: raw.lastWaterTime ?? now,
        growthElapsedSec: raw.growthElapsedSec ?? 0,
        lastTickAt: raw.lastTickAt ?? now,
      };
      if (kind) {
        const def = getCropDef(kind as CropId);
        if (migrated.wateredMilestoneCount === undefined) {
          migrated.wateredMilestoneCount = inferWateredMilestoneCount(
            migrated.growthElapsedSec,
            migrated.waterLevel,
            def.waterMilestonesSec
          );
        }
        syncWaterLevelFromMilestones(migrated, def);
      }
      return migrated;
    }

    const kind = raw.cropType ?? raw.kind ?? 'wheat';
    let stage = CropLifecycleState.EMPTY;
    let growthElapsedSec = raw.growthElapsedSec ?? 0;

    if (legacyState === 'READY') {
      stage = CropLifecycleState.READY;
      growthElapsedSec = getCropDef(kind as CropId).growTimeSec;
    } else if (legacyState === 'GROWING') {
      const def = getCropDef(kind as CropId);
      const elapsed = raw.plantedAt ? (now - raw.plantedAt) / 1000 : 0;
      growthElapsedSec = Math.min(def.growTimeSec * 0.6, elapsed);
      stage =
        growthElapsedSec >= def.growTimeSec
          ? CropLifecycleState.READY
          : growthElapsedSec >= def.growTimeSec * 0.5
            ? CropLifecycleState.STAGE2
            : CropLifecycleState.STAGE1;
    } else if (legacyState === 'PLANTED') {
      stage = CropLifecycleState.PLANTED;
      growthElapsedSec = raw.plantedAt ? Math.min(30, (now - raw.plantedAt) / 1000) : 0;
    }

    return {
      cropType: kind,
      kind,
      stage,
      waterLevel: raw.waterLevel ?? FARMING.maxWater,
      plantedAt: raw.plantedAt ?? now,
      lastWaterTime: raw.lastWaterTime ?? now,
      growthElapsedSec,
      lastTickAt: raw.lastTickAt ?? now,
      dug: raw.dug ?? true,
    };
  }

  static migrateInventory(inv: Record<string, number>): Record<string, number> {
    const out = { ...inv };
    const map: Record<string, string> = {
      seeds_wheat: 'wheat_seed',
      seeds_corn: 'corn_seed',
    };
    for (const [oldId, newId] of Object.entries(map)) {
      if (out[oldId] !== undefined) {
        out[newId] = (out[newId] ?? 0) + out[oldId];
        delete out[oldId];
      }
    }
    return out;
  }
}

export { CROP_IDS };

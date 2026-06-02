import {
  getLivestockDef,
  getLivestockPenTextureKey,
  LIVESTOCK_ANIMAL_LIST,
  LIVESTOCK_PEN_UPGRADE_COST,
  RUMINANT_PEN_COST,
  RUMINANT_PEN_LABEL_VI,
  type AnimalType,
  type LivestockAnimalDef,
  type LivestockPenData,
} from '../config/LivestockConfig';
import { penFootprintTiles, penOccupiesCell } from '../config/livestockAssets';
import type { GridSystem } from './GridSystem';
import {
  canCollectFromPen,
  canFeedPen,
  canStockAnimal,
  canUpgradePen,
  collectFromPen,
  createNewPen,
  createRuminantPen,
  feedPen,
  findPenForStocking,
  getPenForSpecies,
  isRuminantPen,
  livestockPenKey,
  normalizeSavedLivestockPens,
  penFootprintCells,
  penUpgradeExpansionCells,
  stockPenWithAnimal,
  tickAllLivestockPens,
  tickLivestockPen,
  upgradePen,
} from './livestockLogic';

export type LivestockPenPlaceTarget = AnimalType | 'ruminant';

export interface LivestockPenPlaceItemDef {
  placeTarget: LivestockPenPlaceTarget;
  textureKey: string;
  label: string;
  cost: number;
}

function penPlaceLabel(animalType: AnimalType): string {
  const def = getLivestockDef(animalType);
  if (animalType === 'fish') return 'Hồ cá';
  return `Chuồng ${def.labelVi}`;
}

const PEN_PLACE_EXCLUDED: AnimalType[] = ['goat', 'sheep'];

/** Build → Chăn nuôi: buy & place pen/pond (3×3). */
export const LIVESTOCK_PEN_PLACE_ITEMS: LivestockPenPlaceItemDef[] = [
  ...LIVESTOCK_ANIMAL_LIST.filter((a) => !PEN_PLACE_EXCLUDED.includes(a.type)).map((a) => ({
    placeTarget: a.type as LivestockPenPlaceTarget,
    textureKey: getLivestockPenTextureKey(a.type, 1),
    label: penPlaceLabel(a.type),
    cost: a.penCost,
  })),
  {
    placeTarget: 'ruminant',
    textureKey: 'sheep_house',
    label: RUMINANT_PEN_LABEL_VI,
    cost: RUMINANT_PEN_COST,
  },
];

export const LIVESTOCK_UPGRADE_ITEM = {
  kind: 'upgrade' as const,
  textureKey: getLivestockPenTextureKey('cow', 2),
  label: 'Nâng cấp chuồng (4×4)',
  cost: LIVESTOCK_PEN_UPGRADE_COST,
};

export class LivestockSystem {
  active = false;
  upgradeMode = false;
  selectedItem: LivestockPenPlaceItemDef | null = null;
  ghostX = 0;
  ghostY = 0;
  previewLocked = false;

  private pens: LivestockPenData[] = [];
  private onChange?: () => void;
  private placementBlocked?: (gx: number, gy: number) => boolean;
  private penIdCounter = 0;

  constructor(private grid: GridSystem) {}

  setPlacementBlocked(fn: (gx: number, gy: number) => boolean): void {
    this.placementBlocked = fn;
  }

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  enterPlaceMode(item: LivestockPenPlaceItemDef): void {
    this.exitUpgradeMode();
    this.active = true;
    this.selectedItem = item;
    this.previewLocked = false;
  }

  exitPlaceMode(): void {
    this.active = false;
    this.selectedItem = null;
    this.previewLocked = false;
  }

  enterUpgradeMode(): void {
    this.exitPlaceMode();
    this.upgradeMode = true;
  }

  exitUpgradeMode(): void {
    this.upgradeMode = false;
  }

  lockPreviewAt(gx: number, gy: number): void {
    this.ghostX = gx;
    this.ghostY = gy;
    this.previewLocked = true;
  }

  unlockPreview(): void {
    this.previewLocked = false;
  }

  updateGhost(gx: number, gy: number): void {
    if (!this.active || this.previewLocked) return;
    this.ghostX = gx;
    this.ghostY = gy;
  }

  getGhostFootprint(): { w: number; h: number } {
    return penFootprintTiles(1);
  }

  getPenAt(gx: number, gy: number): LivestockPenData | undefined {
    return this.pens.find((p) => penOccupiesCell(p, gx, gy));
  }

  getPenByType(animalType: AnimalType): LivestockPenData | undefined {
    return getPenForSpecies(this.pens, animalType);
  }

  findPenForStocking(animalType: AnimalType): LivestockPenData | undefined {
    return findPenForStocking(this.pens, animalType);
  }

  private penBlocksCell(gx: number, gy: number, ignorePenId?: string): boolean {
    return this.pens.some(
      (p) => p.id !== ignorePenId && penOccupiesCell(p, gx, gy)
    );
  }

  private canPlaceCell(gx: number, gy: number, ignorePenId?: string): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    if (this.penBlocksCell(gx, gy, ignorePenId)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell || !cell.walkable || cell.object) return false;
    if (cell.type === 'water' || cell.type === 'soil') return false;
    if (this.placementBlocked?.(gx, gy)) return false;
    return true;
  }

  canPlaceFootprint(
    anchorGx: number,
    anchorGy: number,
    footprint: { w: number; h: number },
    ignorePenId?: string
  ): boolean {
    for (let dy = 0; dy < footprint.h; dy++) {
      for (let dx = 0; dx < footprint.w; dx++) {
        if (!this.canPlaceCell(anchorGx + dx, anchorGy + dy, ignorePenId)) return false;
      }
    }
    return true;
  }

  canPlace(gx: number, gy: number): boolean {
    const fp = this.getGhostFootprint();
    return this.canPlaceFootprint(gx, gy, fp);
  }

  canMovePenTo(pen: LivestockPenData, anchorGx: number, anchorGy: number): boolean {
    const footprint = penFootprintTiles(pen.level ?? 1);
    return this.canPlaceFootprint(anchorGx, anchorGy, footprint, pen.id);
  }

  canUpgradeAt(pen: LivestockPenData): boolean {
    if (!canUpgradePen(pen)) return false;
    for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
      if (!this.canPlaceCell(gx, gy, pen.id)) return false;
    }
    return true;
  }

  private nextPenId(target: LivestockPenPlaceTarget): string {
    this.penIdCounter += 1;
    const slug = target === 'ruminant' ? 'ruminant' : target;
    return `pen-${slug}-${this.penIdCounter}`;
  }

  place(gx: number, gy: number): LivestockPenData | null {
    if (!this.selectedItem || !this.canPlace(gx, gy)) return null;
    const target = this.selectedItem.placeTarget;
    const pen =
      target === 'ruminant'
        ? createRuminantPen(this.nextPenId('ruminant'), gx, gy, 1)
        : createNewPen(this.nextPenId(target), target, gx, gy, 1);
    this.pens.push(pen);
    this.markPenFootprint(pen, true);
    this.onChange?.();
    return pen;
  }

  loadPens(data: LivestockPenData[]): void {
    this.clearAllPenFootprints();
    this.pens = normalizeSavedLivestockPens(data);
    this.penIdCounter = this.pens.length;
    for (const p of this.pens) {
      this.markPenFootprint(p, true);
    }
    this.onChange?.();
  }

  private clearAllPenFootprints(): void {
    for (const p of this.pens) {
      this.markPenFootprint(p, false);
    }
  }

  private markPenFootprint(pen: LivestockPenData, occupied: boolean): void {
    for (const { gx, gy } of penFootprintCells(pen)) {
      if (occupied) {
        this.grid.setObject(
          gx,
          gy,
          `livestock_pen_${isRuminantPen(pen) ? 'ruminant' : pen.animalType}`
        );
      } else {
        this.grid.clearObject(gx, gy);
      }
    }
  }

  movePenTo(pen: LivestockPenData, anchorGx: number, anchorGy: number): boolean {
    if (!this.canMovePenTo(pen, anchorGx, anchorGy)) return false;
    this.markPenFootprint(pen, false);
    const next = { ...pen, gridX: anchorGx, gridY: anchorGy };
    this.replacePen(next);
    this.markPenFootprint(next, true);
    return true;
  }

  tick(nowMs: number): void {
    const next = tickAllLivestockPens(this.pens, nowMs);
    const changed = next.some((p, i) => p.state !== this.pens[i]?.state);
    this.pens = next;
    if (changed) this.onChange?.();
  }

  getPens(): LivestockPenData[] {
    return [...this.pens];
  }

  getAnimalDef(type: AnimalType): LivestockAnimalDef {
    return getLivestockDef(type);
  }

  getPenAction(pen: LivestockPenData, nowMs: number) {
    return {
      canStock: canStockAnimal(pen),
      canFeed: canFeedPen(pen),
      canCollect: canCollectFromPen(pen, nowMs),
      canUpgrade: canUpgradePen(pen) && this.canUpgradeAt(pen),
      ticked: tickLivestockPen(pen, nowMs),
    };
  }

  /** Shop Animals → first empty pen/pond of that species. */
  stockSpeciesPen(animalType: AnimalType, rng?: () => number): LivestockPenData | null {
    const pen = findPenForStocking(this.pens, animalType);
    if (!pen) return null;
    const next = stockPenWithAnimal(pen, animalType, rng);
    if (!next) return null;
    this.replacePen(next);
    return next;
  }

  tryFeed(pen: LivestockPenData, nowMs: number): LivestockPenData | null {
    const next = feedPen(pen, nowMs);
    if (!next) return null;
    this.replacePen(next);
    return next;
  }

  tryUpgrade(pen: LivestockPenData): LivestockPenData | null {
    if (!this.canUpgradeAt(pen)) return null;
    const next = upgradePen(pen);
    if (!next) return null;
    this.markPenFootprint(pen, false);
    this.markPenFootprint(next, true);
    this.replacePen(next);
    return next;
  }

  tryCollect(
    pen: LivestockPenData,
    nowMs: number
  ): { pen: LivestockPenData; productItemId: string; qty: number } | null {
    const result = collectFromPen(pen, nowMs);
    if (!result) return null;
    this.replacePen(result.pen);
    return result;
  }

  private replacePen(next: LivestockPenData): void {
    const idx = this.pens.findIndex((p) => p.id === next.id);
    if (idx >= 0) {
      this.pens[idx] = next;
      this.onChange?.();
    }
  }

  exportPens(): LivestockPenData[] {
    return this.pens.map((p) => ({ ...p }));
  }

  occupiedCells(): ReadonlyArray<{ gx: number; gy: number }> {
    const out: Array<{ gx: number; gy: number }> = [];
    for (const p of this.pens) {
      out.push(...penFootprintCells(p));
    }
    return out;
  }
}

export { livestockPenKey };

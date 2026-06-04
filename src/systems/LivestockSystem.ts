import {
  getLivestockDef,
  getLivestockPenTextureKey,
  LIVESTOCK_ANIMAL_LIST,
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
  livestockSellPrice,
  penCapacity,
  penStockCount,
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

export class LivestockSystem {
  active = false;
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
    this.active = true;
    this.selectedItem = item;
    this.previewLocked = false;
  }

  exitPlaceMode(): void {
    this.active = false;
    this.selectedItem = null;
    this.previewLocked = false;
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

  getPenCapacityForSpecies(animalType: AnimalType): number | null {
    const pen = getPenForSpecies(this.pens, animalType);
    return pen ? penCapacity(pen) : null;
  }

  getPenStockCountForSpecies(animalType: AnimalType): number | null {
    const pen = getPenForSpecies(this.pens, animalType);
    return pen ? penStockCount(pen) : null;
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

  /**
   * Recover pens from legacy grid occupancy markers when save.livestock is absent.
   * Markers are rectangular 3x3/4x4 blocks tagged as `livestock_pen_<species|ruminant>`.
   */
  recoverPensFromGridMarkers(): LivestockPenData[] {
    type PenMarkerType = AnimalType | 'ruminant';
    const markerPrefix = 'livestock_pen_';
    const validMarkerType = (raw: string): PenMarkerType | null => {
      if (raw === 'ruminant') return 'ruminant';
      if (LIVESTOCK_ANIMAL_LIST.some((a) => a.type === raw)) return raw as AnimalType;
      return null;
    };

    const markerAt = (gx: number, gy: number): PenMarkerType | null => {
      const objectId = this.grid.getCell(gx, gy)?.object;
      if (!objectId?.startsWith(markerPrefix)) return null;
      return validMarkerType(objectId.slice(markerPrefix.length));
    };

    const visited = new Set<string>();
    const out: LivestockPenData[] = [];
    let recoveredIndex = 0;
    const keyOf = (gx: number, gy: number) => `${gx},${gy}`;

    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const marker = markerAt(gx, gy);
        if (!marker) continue;
        const startKey = keyOf(gx, gy);
        if (visited.has(startKey)) continue;

        const stack: Array<{ gx: number; gy: number }> = [{ gx, gy }];
        const cells: Array<{ gx: number; gy: number }> = [];

        while (stack.length > 0) {
          const cur = stack.pop()!;
          const curKey = keyOf(cur.gx, cur.gy);
          if (visited.has(curKey)) continue;
          if (markerAt(cur.gx, cur.gy) !== marker) continue;
          visited.add(curKey);
          cells.push(cur);
          stack.push(
            { gx: cur.gx + 1, gy: cur.gy },
            { gx: cur.gx - 1, gy: cur.gy },
            { gx: cur.gx, gy: cur.gy + 1 },
            { gx: cur.gx, gy: cur.gy - 1 }
          );
        }

        if (cells.length === 0) continue;
        const minX = Math.min(...cells.map((c) => c.gx));
        const minY = Math.min(...cells.map((c) => c.gy));
        const maxX = Math.max(...cells.map((c) => c.gx));
        const maxY = Math.max(...cells.map((c) => c.gy));
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const level = width === 4 && height === 4 ? 2 : 1;
        const isRect =
          cells.length === width * height &&
          cells.every((c) => c.gx >= minX && c.gx <= maxX && c.gy >= minY && c.gy <= maxY);
        if (!isRect || width !== height || (width !== 3 && width !== 4)) continue;

        recoveredIndex += 1;
        const recoveredId = `pen-${marker}-${recoveredIndex}`;
        const pen =
          marker === 'ruminant'
            ? createRuminantPen(recoveredId, minX, minY, level)
            : createNewPen(recoveredId, marker, minX, minY, level);
        out.push(pen);
      }
    }
    return out.sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX);
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

  getSellPrice(pen: LivestockPenData, nowMs: number): number {
    return livestockSellPrice(pen, nowMs);
  }

  trySellAnimal(pen: LivestockPenData, nowMs: number): { pen: LivestockPenData; sellPrice: number } | null {
    const current = tickLivestockPen(pen, nowMs);
    const sellPrice = livestockSellPrice(current, nowMs);
    if (sellPrice <= 0) return null;
    const nextCount = Math.max(0, penStockCount(current) - 1);
    const next: LivestockPenData = {
      ...current,
      stockCount: nextCount,
      state: nextCount === 0 ? 'unstocked' : current.state,
      lifecycleState: nextCount === 0 ? undefined : current.lifecycleState,
      readyAt: undefined,
    };
    if (isRuminantPen(current)) {
      next.ruminantOccupants = (current.ruminantOccupants ?? []).slice(0, nextCount);
      if (nextCount === 0) {
        next.animalType = 'sheep';
      } else {
        next.animalType = next.ruminantOccupants[0]?.animalType ?? current.animalType;
      }
    }
    this.replacePen(next);
    return { pen: next, sellPrice };
  }

  setPenHungryStateForTest(penId: string, hungry: boolean): boolean {
    const pen = this.pens.find((p) => p.id === penId);
    if (!pen || pen.state === 'unstocked') return false;
    const now = Date.now();
    const next: LivestockPenData = hungry
      ? {
          ...pen,
          state: 'producing',
          lifecycleState: 'hungry',
          hungrySince: now,
          lastUpdatedAt: now,
        }
      : {
          ...pen,
          state: 'producing',
          lifecycleState: 'producing',
          hungrySince: undefined,
          lastUpdatedAt: now,
        };
    this.replacePen(next);
    return true;
  }

  private replacePen(next: LivestockPenData): void {
    const idx = this.pens.findIndex((p) => p.id === next.id);
    if (idx >= 0) {
      this.pens[idx] = next;
      this.onChange?.();
    }
  }

  exportPens(): LivestockPenData[] {
    return this.pens.map((p) => ({
      ...p,
      ruminantOccupants: p.ruminantOccupants?.map((o) => ({ ...o })) ?? [],
    }));
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

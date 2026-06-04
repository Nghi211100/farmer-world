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
import {
  penFootprintTiles,
  penHasWaterMoat,
  penHasWaterMoatForPen,
  penFootprintOccupiesCell,
  penMoatCells,
  penMoatOccupiesCell,
  penMoatTouchesExternalWater,
  penOccupiesCell,
  PEN_MOAT_WATER_OBJECT,
  type LivestockPenLevel,
} from '../config/livestockAssets';
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
  feedPenAnimalAt,
  findPenForStocking,
  getPenForSpecies,
  isRuminantPen,
  canSellAllAnimalsInPen,
  livestockSellPrice,
  livestockSellPriceForPenAnimalAt,
  penHasStockedAnimals,
  removeSoldAnimalFromPen,
  removeSoldAnimalFromPenAt,
  sellAllAnimalsFromPen,
  penCapacity,
  penStockCount,
  totalSellAllAnimalsPrice,
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
  /** True while long-press drag moves the new-pen placement ghost. */
  placeDragging = false;

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
    this.placeDragging = false;
  }

  exitPlaceMode(): void {
    this.active = false;
    this.selectedItem = null;
    this.previewLocked = false;
    this.placeDragging = false;
  }

  startPlaceDrag(): void {
    if (!this.active) return;
    this.placeDragging = true;
    this.previewLocked = false;
  }

  finishPlaceDrag(): void {
    if (!this.active) return;
    this.placeDragging = false;
    this.previewLocked = true;
  }

  /**
   * Scan the farm grid for the first anchor where a pen footprint fits
   * (grass/walkable, not soil/water, not blocked by pens/buildings).
   * Level-1 anchors must also have a clear 4×4 upgrade ring.
   */
  findFirstValidPenPlacement(
    _placeTarget: LivestockPenPlaceTarget,
    level: number = 1
  ): { gx: number; gy: number } | null {
    const penLevel = level as LivestockPenLevel;
    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        if (this.canPlacePenAt(gx, gy, penLevel)) {
          return { gx, gy };
        }
      }
    }
    return null;
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
    if (!this.active || (this.previewLocked && !this.placeDragging)) return;
    this.ghostX = gx;
    this.ghostY = gy;
  }

  isGridOnPlaceGhostFootprint(gx: number, gy: number, level: number = 1): boolean {
    return penOccupiesCell({ gridX: this.ghostX, gridY: this.ghostY, level: level as 1 | 2 }, gx, gy);
  }

  getGhostFootprint(): { w: number; h: number } {
    return penFootprintTiles(1);
  }

  getPenAt(gx: number, gy: number): LivestockPenData | undefined {
    return this.pens.find((p) => penOccupiesCell(p, gx, gy));
  }

  /** Pen house footprint only (excludes duck/fish moat ring) — for taps and edit popups. */
  getPenAtFootprint(gx: number, gy: number): LivestockPenData | undefined {
    return this.pens.find((p) => penFootprintOccupiesCell(p, gx, gy));
  }

  /**
   * Livestock/build collision for decor placement. Footprint always blocks;
   * moat blocks except bridge tiles on moat cells that connect to external river water.
   */
  blocksBuildPlacement(gx: number, gy: number, opts?: { bridge?: boolean }): boolean {
    for (const p of this.pens) {
      if (penFootprintOccupiesCell(p, gx, gy)) return true;
      if (!penMoatOccupiesCell(p, gx, gy)) continue;
      if (opts?.bridge && penMoatTouchesExternalWater(this.grid, p, gx, gy)) continue;
      return true;
    }
    return false;
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

  private penMarkerFor(pen: LivestockPenData): string {
    return `livestock_pen_${isRuminantPen(pen) ? 'ruminant' : pen.animalType}`;
  }

  /** Match registry pen by id or top-left anchor when callers pass a stale copy. */
  private resolvePenInRegistry(pen: LivestockPenData): LivestockPenData | undefined {
    const byId = this.pens.find((p) => p.id === pen.id);
    if (byId) return byId;
    return this.pens.find(
      (p) =>
        p.gridX === pen.gridX &&
        p.gridY === pen.gridY &&
        penOccupiesCell(p, pen.gridX, pen.gridY)
    );
  }

  private canPlaceCell(gx: number, gy: number, ignorePenId?: string): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    if (this.penBlocksCell(gx, gy, ignorePenId)) return false;
    const ignoredPen = ignorePenId
      ? this.pens.find((p) => p.id === ignorePenId)
      : undefined;
    const isIgnoredPenFootprint =
      ignoredPen !== undefined && penOccupiesCell(ignoredPen, gx, gy);
    const isIgnoredPenMoat =
      ignoredPen !== undefined && penMoatOccupiesCell(ignoredPen, gx, gy);
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return false;
    if (isIgnoredPenFootprint) {
      if (cell.type === 'soil') return false;
      if (cell.type === 'water' && !isIgnoredPenMoat) return false;
      if (this.placementBlocked?.(gx, gy)) return false;
      return true;
    }
    if (!cell.walkable) return false;
    if (cell.object) return false;
    if (cell.type === 'void' || cell.type === 'water' || cell.type === 'soil') return false;
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

  /** Level-1 placement/move also requires a clear 4×4 upgrade expansion ring. */
  canPlacePenAt(
    gx: number,
    gy: number,
    level: LivestockPenLevel = 1,
    ignorePenId?: string
  ): boolean {
    const footprint = penFootprintTiles(level);
    if (!this.canPlaceFootprint(gx, gy, footprint, ignorePenId)) return false;
    const probePen = this.pens.find((p) => p.id === ignorePenId);
    const moatSpecies =
      this.selectedItem?.placeTarget !== 'ruminant'
        ? this.selectedItem?.placeTarget
        : probePen && !isRuminantPen(probePen)
          ? probePen.animalType
          : undefined;
    if (moatSpecies && penHasWaterMoat(moatSpecies)) {
      const moatProbe = {
        animalType: moatSpecies,
        gridX: gx,
        gridY: gy,
        level,
      };
      for (const { gx: mx, gy: my } of penMoatCells(moatProbe)) {
        if (!this.canPlaceMoatCell(mx, my, ignorePenId)) return false;
      }
    }
    if (level === 1 && this.getUpgradeRingBlockAtAnchor(gx, gy, ignorePenId ?? '__placement_probe__')) {
      return false;
    }
    return true;
  }

  private canPlaceMoatCell(gx: number, gy: number, ignorePenId?: string): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    if (this.penBlocksCell(gx, gy, ignorePenId)) return false;
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return false;
    if (this.placementBlocked?.(gx, gy)) return false;
    if (cell.object) return false;
    if (cell.type === 'void' || cell.type === 'soil' || cell.type === 'water') return false;
    return cell.walkable;
  }

  canPlace(gx: number, gy: number): boolean {
    return this.canPlacePenAt(gx, gy, 1);
  }

  canMovePenTo(pen: LivestockPenData, anchorGx: number, anchorGy: number): boolean {
    const level = (pen.level ?? 1) as LivestockPenLevel;
    return this.canPlacePenAt(anchorGx, anchorGy, level, pen.id);
  }

  /** Why a hypothetical level-1 pen at this anchor cannot expand to 4×4. */
  getUpgradeRingBlockAtAnchor(
    anchorGx: number,
    anchorGy: number,
    ignorePenId: string = '__placement_probe__'
  ): string | null {
    return this.getUpgradeRingBlockAtAnchorInternal(anchorGx, anchorGy, ignorePenId);
  }

  private getUpgradeRingBlockAtAnchorInternal(
    anchorGx: number,
    anchorGy: number,
    ignorePenId: string
  ): string | null {
    const probe: LivestockPenData = {
      id: ignorePenId,
      animalType: 'chicken',
      gridX: anchorGx,
      gridY: anchorGy,
      level: 1,
      state: 'unstocked',
    };
    for (const { gx, gy } of penUpgradeExpansionCells(probe)) {
      const reason = this.getPenUpgradeBlockMessageForCell(gx, gy, ignorePenId);
      if (reason) return reason;
    }
    return null;
  }

  /** First blocking reason for one expansion ring cell (Vietnamese), or null if clear. */
  private getPenUpgradeBlockMessageForCell(
    gx: number,
    gy: number,
    ignorePenId: string
  ): string | null {
    if (!this.grid.inBounds(gx, gy)) {
      return 'Không đủ đất — chuồng quá gần mép bản đồ';
    }
    if (this.penBlocksCell(gx, gy, ignorePenId)) {
      return 'Vùng 4×4 bị chặn — chuồng khác đang chiếm ô';
    }
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return 'Vùng 4×4 bị chặn — dọn ô trống quanh chuồng';
    if (this.placementBlocked?.(gx, gy)) {
      return 'Vùng 4×4 bị chặn — có công trình trên ô mở rộng';
    }
    const objectId = cell.object;
    if (objectId === PEN_MOAT_WATER_OBJECT) {
      const ignoredPen = this.pens.find((p) => p.id === ignorePenId);
      if (ignoredPen && penMoatOccupiesCell(ignoredPen, gx, gy)) {
        return null;
      }
    }
    if (objectId) {
      const isPenMarker = objectId.startsWith('livestock_pen_');
      if (!isPenMarker || this.penBlocksCell(gx, gy, ignorePenId)) {
        if (objectId.startsWith('tree_') || objectId === 'tree_01' || objectId === 'tree_02') {
          return 'Vùng 4×4 bị chặn — gỡ cây/đá quanh chuồng';
        }
        if (objectId.startsWith('rock_') || objectId.startsWith('bush_')) {
          return 'Vùng 4×4 bị chặn — gỡ đá/bụi cây quanh chuồng';
        }
        return 'Vùng 4×4 bị chặn — dọn ô trống quanh chuồng';
      }
    }
    if (cell.type === 'water') {
      const ignoredPen = this.pens.find((p) => p.id === ignorePenId);
      if (ignoredPen && penMoatOccupiesCell(ignoredPen, gx, gy)) {
        return null;
      }
      return 'Không thể mở rộng ra vùng nước — đặt chuồng xa mép nước';
    }
    if (
      objectId?.startsWith('livestock_pen_') &&
      !this.penBlocksCell(gx, gy, ignorePenId)
    ) {
      return null;
    }
    if (!cell.object && (cell.type === 'grass' || cell.type === 'path')) {
      return null;
    }
    if (!cell.walkable && cell.type !== 'soil') {
      return 'Vùng 4×4 bị chặn — dọn ô trống quanh chuồng';
    }
    return null;
  }

  /** Why this pen cannot expand to 4×4; null when the ring is valid. */
  getPenUpgradeBlockMessage(pen: LivestockPenData): string | null {
    if (!canUpgradePen(pen)) return 'Chuồng đã đạt cấp tối đa';
    for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
      const reason = this.getPenUpgradeBlockMessageForCell(gx, gy, pen.id);
      if (reason) return reason;
    }
    return null;
  }

  canUpgradeAt(pen: LivestockPenData): boolean {
    return this.getPenUpgradeBlockMessage(pen) === null;
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
    const marker = this.penMarkerFor(pen);
    if (occupied) {
      const level = (pen.level ?? 1) as LivestockPenLevel;
      if (level === 1) {
        for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
          if (this.grid.getCell(gx, gy)?.object === marker) {
            this.grid.clearObject(gx, gy);
          }
        }
      }
      for (const { gx, gy } of penFootprintCells({ ...pen, level })) {
        this.grid.setObject(gx, gy, marker);
      }
      if (penHasWaterMoatForPen(pen)) {
        for (const { gx, gy } of penMoatCells({ ...pen, level })) {
          const cell = this.grid.getCell(gx, gy);
          if (!cell) continue;
          if (cell.type === 'water') continue;
          if (cell.type !== 'grass' && cell.type !== 'void') continue;
          this.grid.setCell(gx, gy, {
            type: 'water',
            walkable: false,
            object: PEN_MOAT_WATER_OBJECT,
            groundVariant: undefined,
            pathVariant: undefined,
          });
        }
      }
      return;
    }
    for (const level of [1, 2] as const) {
      if (penHasWaterMoatForPen(pen)) {
        for (const { gx, gy } of penMoatCells({ ...pen, level })) {
          if (!this.grid.inBounds(gx, gy)) continue;
          if (this.grid.getCell(gx, gy)?.object !== PEN_MOAT_WATER_OBJECT) continue;
          this.grid.setCell(gx, gy, {
            type: 'grass',
            walkable: true,
            object: undefined,
          });
        }
      }
      for (const { gx, gy } of penFootprintCells({ ...pen, level })) {
        if (this.grid.getCell(gx, gy)?.object === marker) {
          this.grid.clearObject(gx, gy);
        }
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
      canFeed: canFeedPen(pen, nowMs),
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

  /** Dev/test: stock the pen at grid cell (not first pen of species). */
  tryStockPenAt(gx: number, gy: number): LivestockPenData | null {
    const pen = this.getPenAt(gx, gy);
    if (!pen || pen.state !== 'unstocked') return null;
    const type = pen.penKind === 'ruminant' ? 'sheep' : pen.animalType;
    const next = stockPenWithAnimal(pen, type);
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
    const current = this.resolvePenInRegistry(pen) ?? pen;
    if (!this.canUpgradeAt(current)) return null;
    const next = upgradePen(current);
    if (!next) return null;
    for (const { gx, gy } of penUpgradeExpansionCells(current)) {
      const cell = this.grid.getCell(gx, gy);
      const objectId = cell?.object;
      if (
        objectId?.startsWith('livestock_pen_') &&
        !this.penBlocksCell(gx, gy, current.id)
      ) {
        this.grid.clearObject(gx, gy);
      }
    }
    this.markPenFootprint(current, false);
    this.markPenFootprint(next, true);
    if (!this.replacePen(next)) return null;
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
    const next = removeSoldAnimalFromPen(current, nowMs);
    this.replacePen(next);
    return { pen: next, sellPrice };
  }

  trySellAnimalAt(
    pen: LivestockPenData,
    slotIndex: number,
    nowMs: number
  ): { pen: LivestockPenData; sellPrice: number } | null {
    const current = tickLivestockPen(pen, nowMs);
    const sellPrice = livestockSellPriceForPenAnimalAt(current, slotIndex, nowMs);
    if (sellPrice <= 0) return null;
    const next = removeSoldAnimalFromPenAt(current, slotIndex, nowMs);
    if (!next) return null;
    this.replacePen(next);
    return { pen: next, sellPrice };
  }

  trySellAllAnimals(
    pen: LivestockPenData,
    nowMs: number
  ): { pen: LivestockPenData; sellPrice: number } | null {
    const result = sellAllAnimalsFromPen(pen, nowMs);
    if (!result) return null;
    this.replacePen(result.pen);
    return { pen: result.pen, sellPrice: result.totalPrice };
  }

  canSellAllAnimals(pen: LivestockPenData, nowMs: number): boolean {
    return canSellAllAnimalsInPen(pen, nowMs);
  }

  getSellAllPrice(pen: LivestockPenData, nowMs: number): number {
    return totalSellAllAnimalsPrice(pen, nowMs);
  }

  tryFeedAnimalAt(
    pen: LivestockPenData,
    slotIndex: number,
    nowMs: number
  ): LivestockPenData | null {
    const next = feedPenAnimalAt(pen, slotIndex, nowMs);
    if (!next) return null;
    this.replacePen(next);
    return next;
  }

  removePen(pen: LivestockPenData): boolean {
    if (penHasStockedAnimals(pen)) return false;
    const idx = this.pens.findIndex((p) => p.id === pen.id);
    if (idx < 0) return false;
    this.markPenFootprint(pen, false);
    this.pens.splice(idx, 1);
    this.onChange?.();
    return true;
  }

  setPenHungryStateForTest(penId: string, hungry: boolean): boolean {
    const pen = this.pens.find((p) => p.id === penId);
    if (!pen || pen.state === 'unstocked') return false;
    const now = Date.now();
    const lifecycle = hungry ? ('hungry' as const) : ('producing' as const);
    const penAnimals = pen.penAnimals?.map((a) => ({
      ...a,
      lifecycleState: lifecycle,
      hungrySince: hungry ? now : undefined,
      lastUpdatedAt: now,
    }));
    const ruminantOccupants = pen.ruminantOccupants?.map((o) => ({
      ...o,
      lifecycleState: lifecycle,
      hungrySince: hungry ? now : undefined,
      lastUpdatedAt: now,
    }));
    const next: LivestockPenData = {
      ...pen,
      state: 'producing',
      lifecycleState: lifecycle,
      hungrySince: hungry ? now : undefined,
      lastUpdatedAt: now,
      ...(penAnimals ? { penAnimals } : {}),
      ...(ruminantOccupants ? { ruminantOccupants } : {}),
    };
    this.replacePen(next);
    return true;
  }

  private replacePen(next: LivestockPenData): boolean {
    let idx = this.pens.findIndex((p) => p.id === next.id);
    if (idx < 0) {
      idx = this.pens.findIndex((p) => p.gridX === next.gridX && p.gridY === next.gridY);
    }
    if (idx < 0) return false;
    this.pens[idx] = { ...next, id: this.pens[idx]!.id };
    this.onChange?.();
    return true;
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
      out.push(...penMoatCells(p));
    }
    return out;
  }
}

export { livestockPenKey };

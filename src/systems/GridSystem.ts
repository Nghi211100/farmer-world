import {
  FARM_SOIL_BOUNDS,
  GRID_SIZE,
  GROUND_DECOR_MIX,
  INITIAL_UNLOCKED_FARM_TILES,
  soilMoistureTextureKey,
  type GroundDecorVariant,
} from '../config/gameConfig';
import {
  computeFarmIslandWorldDepth,
  FARM_ISLAND_RING_MARGIN,
  getFarmLandGroundDepth,
  ISLAND_GROUND_MIN_SEP,
  isFarmNorthEdgeCell,
} from '../farmIslandLayout';
import {
  cartToIso,
  isoDepth,
  pickIsoTileAt,
  tileBottomFromTop,
  tileCenterFromGrid,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../utils/iso';
import { waterTextureKeyAt, type WaterNeighborProbe } from '../utils/waterAutotile';

export type MapLayer = 'ground' | 'objects' | 'crops' | 'buildings' | 'entities';

export interface TileCell {
  type: 'grass' | 'soil' | 'water' | 'path';
  walkable: boolean;
  object?: string;
  /** Soil only: false = locked until land purchase */
  unlocked?: boolean;
  /** Unlocked soil: moisture for empty/dug plots without a crop sprite (0–100) */
  soilWaterLevel?: number;
  /** Locked soil / outer grass: decorative ground variant (assigned on new game) */
  groundVariant?: GroundDecorVariant;
}

export interface GroundTextureOptions {
  /** Dig animation: neutral farm_plot instead of moisture tiles */
  farmPlotGround?: boolean;
  /** Tilled plot — moisture bands use soil (dry) / mud / wet_soil */
  dug?: boolean;
  /** Override cell {@link TileCell.soilWaterLevel} for texture pick (e.g. neglect-dry). */
  soilWaterLevel?: number;
}

export class GridSystem {
  readonly size = GRID_SIZE;
  readonly tileWidth = TILE_WIDTH;
  readonly tileHeight = TILE_HEIGHT;
  originX = 0;
  originY = 0;

  private cells: TileCell[][] = [];

  constructor() {
    this.initEmpty();
  }

  initEmpty(): void {
    this.cells = [];
    for (let y = 0; y < this.size; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = { type: 'grass', walkable: true };
      }
    }
  }

  setOrigin(screenWidth: number, screenHeight: number): void {
    this.originX = screenWidth / 2;
    this.originY = screenHeight / 4;
  }

  /** Grid coords of unlocked planting soil centroid, else full patch center. */
  getUnlockedFarmPlantingGridCenter(): { x: number; y: number } {
    const unlocked = this.getSoilTileCoords().filter(
      ({ x, y }) => this.isFarmPlantingCell(x, y) && this.isFarmUnlocked(x, y)
    );
    if (unlocked.length > 0) {
      let sx = 0;
      let sy = 0;
      for (const { x, y } of unlocked) {
        sx += x;
        sy += y;
      }
      return { x: sx / unlocked.length, y: sy / unlocked.length };
    }
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  /**
   * Lay out the grid so the farm soil patch center sits in the HUD playable band
   * (camera scroll 0, zoom 1 baseline).
   */
  centerInViewport(
    viewW: number,
    viewH: number,
    hudTop = 56,
    hudBottom = 72
  ): void {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const centerGx = (minX + maxX) / 2;
    const centerGy = (minY + maxY) / 2;
    const targetX = viewW / 2;
    const targetY = (viewH + hudTop - hudBottom) / 2;
    const topOffsetX = (centerGx - centerGy) * (this.tileWidth / 2);
    const topOffsetY = (centerGx + centerGy) * (this.tileHeight / 2);
    this.originX = targetX - topOffsetX;
    this.originY = targetY - topOffsetY - this.tileHeight / 2;
  }

  /** Farm soil patch bottom-right anchor (SE corner tile bottom vertex). */
  getFarmSoilBottomRightAnchor(): { x: number; y: number } {
    const { maxX, maxY } = FARM_SOIL_BOUNDS;
    return this.gridToTileBottom(maxX, maxY);
  }

  private accumulateIsoBounds(
    corners: [number, number][],
    out: { minX: number; minY: number; maxX: number; maxY: number }
  ): void {
    const hw = this.tileWidth / 2;
    for (const [gx, gy] of corners) {
      const top = this.gridToScreen(gx, gy);
      const bottom = tileBottomFromTop(top);
      out.minX = Math.min(out.minX, top.x - hw);
      out.maxX = Math.max(out.maxX, top.x + hw);
      out.minY = Math.min(out.minY, top.y);
      out.maxY = Math.max(out.maxY, bottom.y);
    }
  }

  getMapScreenBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    const corners: [number, number][] = [
      [0, 0],
      [this.size - 1, 0],
      [0, this.size - 1],
      [this.size - 1, this.size - 1],
    ];
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.accumulateIsoBounds(corners, box);
    return {
      ...box,
      centerX: (box.minX + box.maxX) / 2,
      centerY: (box.minY + box.maxY) / 2,
    };
  }

  /**
   * Screen AABB of unlocked planting soil (diamond bottoms included).
   * Falls back to the full farm soil rectangle when nothing is unlocked yet.
   */
  getUnlockedFarmPlantingScreenBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    const unlocked = this.getSoilTileCoords().filter(
      ({ x, y }) => this.isFarmPlantingCell(x, y) && this.isFarmUnlocked(x, y)
    );
    if (unlocked.length === 0) {
      return this.getFarmSoilScreenBounds();
    }
    const corners: [number, number][] = unlocked.map(({ x, y }) => [x, y]);
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.accumulateIsoBounds(corners, box);
    const anchor = this.getFarmSoilCameraAnchor();
    return {
      ...box,
      centerX: anchor.x,
      centerY: anchor.y,
    };
  }

  /**
   * Outer iso rhombus of FARM_SOIL_BOUNDS: N/E/S/W apexes of the 8×8 soil cluster
   * (not the axis-aligned AABB from {@link getFarmSoilScreenBounds}).
   */
  getFarmSoilScreenRhombus(): {
    north: { x: number; y: number };
    east: { x: number; y: number };
    south: { x: number; y: number };
    west: { x: number; y: number };
    center: { x: number; y: number };
  } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const northTop = this.gridToScreen(minX, minY);
    const eastTop = this.gridToScreen(maxX, minY);
    const southTop = this.gridToScreen(maxX, maxY);
    const westTop = this.gridToScreen(minX, maxY);
    const hw = this.tileWidth / 2;
    const hh = this.tileHeight / 2;
    return {
      north: { x: northTop.x, y: northTop.y },
      east: { x: eastTop.x + hw, y: eastTop.y + hh },
      south: tileBottomFromTop(southTop),
      west: { x: westTop.x - hw, y: westTop.y + hh },
      center: this.getFarmSoilPatchCenterScreen(),
    };
  }

  /** Screen AABB of the farm soil rectangle (diamond bottoms included). */
  getFarmSoilScreenBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const corners: [number, number][] = [
      [minX, minY],
      [maxX, minY],
      [minX, maxY],
      [maxX, maxY],
    ];
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.accumulateIsoBounds(corners, box);
    const patchCenter = this.getFarmSoilPatchCenterScreen();
    return {
      ...box,
      centerX: patchCenter.x,
      centerY: patchCenter.y,
    };
  }

  /**
   * Screen AABB of soil + outer path ring (camera fit / scroll limits).
   * Includes the iso north apex row that sits outside {@link getFarmSoilScreenBounds}.
   */
  getFarmFootprintScreenBounds(ringMargin = FARM_ISLAND_RING_MARGIN): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const corners: [number, number][] = [
      [minX - ringMargin, minY - ringMargin],
      [maxX + ringMargin, minY - ringMargin],
      [minX - ringMargin, maxY + ringMargin],
      [maxX + ringMargin, maxY + ringMargin],
    ];
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.accumulateIsoBounds(corners, box);
    const patchCenter = this.getFarmSoilPatchCenterScreen();
    return {
      ...box,
      centerX: patchCenter.x,
      centerY: patchCenter.y,
    };
  }

  /** Iso diamond center of the full farm soil rectangle (FARM_SOIL_BOUNDS). */
  getFarmSoilPatchCenterScreen(): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    return this.gridToTileCenter((minX + maxX) / 2, (minY + maxY) / 2);
  }

  /** Camera scroll anchor: iso center of the full farm soil patch (FARM_SOIL_BOUNDS). */
  getFarmSoilCameraAnchor(): { x: number; y: number } {
    return this.getFarmSoilPatchCenterScreen();
  }

  getCell(gx: number, gy: number): TileCell | null {
    if (!this.inBounds(gx, gy)) return null;
    return this.cells[gy][gx];
  }

  setCell(gx: number, gy: number, cell: Partial<TileCell>): void {
    if (!this.inBounds(gx, gy)) return;
    this.cells[gy][gx] = { ...this.cells[gy][gx], ...cell };
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < this.size && gy < this.size;
  }

  isWalkable(gx: number, gy: number): boolean {
    const c = this.getCell(gx, gy);
    return c !== null && c.walkable && !c.object;
  }

  hasObject(gx: number, gy: number): boolean {
    const c = this.getCell(gx, gy);
    return !!c?.object;
  }

  setObject(gx: number, gy: number, objectId: string | undefined): void {
    if (!this.inBounds(gx, gy)) return;
    this.cells[gy][gx].object = objectId;
    if (objectId) this.cells[gy][gx].walkable = false;
  }

  /** Removes a placed object and restores walkability for grass / unlocked soil. */
  clearObject(gx: number, gy: number): void {
    if (!this.inBounds(gx, gy)) return;
    const cell = this.cells[gy][gx];
    delete cell.object;
    if (cell.type === 'water') {
      cell.walkable = false;
    } else if (cell.type === 'soil') {
      cell.walkable = !!cell.unlocked;
    } else {
      cell.walkable = true;
    }
  }

  /** Top vertex of the tile diamond */
  gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return cartToIso(gx, gy, this.originX, this.originY);
  }

  /** Diamond geometric center; accepts fractional grid coords during movement */
  gridToTileCenter(gx: number, gy: number): { x: number; y: number } {
    return tileCenterFromGrid(gx, gy, this.originX, this.originY);
  }

  /** Player feet at diamond center (not bottom vertex) */
  gridToPlayerTile(gx: number, gy: number): { x: number; y: number } {
    return tileCenterFromGrid(gx, gy, this.originX, this.originY);
  }

  /** Diamond bottom vertex (crops, decorations, buildings — not player) */
  gridToTileBottom(gx: number, gy: number): { x: number; y: number } {
    return tileBottomFromTop(this.gridToScreen(gx, gy));
  }

  /** World-space pick using isometric diamond hit test (matches top-vertex tile sprites). */
  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return pickIsoTileAt(
      worldX,
      worldY,
      this.originX,
      this.originY,
      this.size,
      (gx, gy) => this.inBounds(gx, gy)
    );
  }

  /** @deprecated Use worldToGrid — kept for callers passing camera world coords */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    return this.worldToGrid(screenX, screenY);
  }

  /**
   * Ground tiles Y-sort only among themselves. Entities, crops, buildings, and nature
   * share a higher band so (gx+gy) never pulls floor art over the player.
   */
  getDepth(gx: number, gy: number, layer: MapLayer = 'entities'): number {
    const layerOffset: Record<MapLayer, number> = {
      ground: 0,
      crops: 1,
      entities: 4,
      buildings: 5,
      objects: 6,
    };
    const depth = isoDepth(gx, gy, layerOffset[layer]);
    if (layer === 'ground') {
      const isFootprint = this.isFarmIslandFootprintCell(gx, gy);
      const base = getFarmLandGroundDepth(gx, gy, depth, isFootprint);

      // Deterministic z-order:
      // For ground tiles on the topmost north edge row(s) of the farm footprint,
      // force their depth to be strictly above farm_island by a safety margin.
      if (isFootprint && isFarmNorthEdgeCell(gx, gy, FARM_ISLAND_RING_MARGIN)) {
        const islandDepth = computeFarmIslandWorldDepth();
        return Math.max(base, islandDepth + ISLAND_GROUND_MIN_SEP);
      }

      return base;
    }
    return depth + this.worldDepthBase();
  }

  /** Lowest depth for the world-object band (above every ground tile on this map). */
  private worldDepthBase(): number {
    const maxTileSum = (this.size - 1) * 2;
    return isoDepth(maxTileSum, 0, 0) + 20;
  }

  /** Build placeholder map: grass, trees, rocks, soil farm area, spawn */
  generatePlaceholderMap(): { spawnX: number; spawnY: number } {
    const spawnX = 10;
    const spawnY = 10;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = { type: 'grass', walkable: true };
      }
    }

    // Water border strip
    for (let x = 0; x < this.size; x++) {
      this.setCell(x, 0, { type: 'water', walkable: false });
      this.setCell(x, this.size - 1, { type: 'water', walkable: false });
    }
    for (let y = 1; y < this.size - 1; y++) {
      this.setCell(0, y, { type: 'water', walkable: false });
      this.setCell(this.size - 1, y, { type: 'water', walkable: false });
    }

    // Farming soil area (center-left) — only INITIAL_UNLOCKED_FARM_TILES start unlocked
    const soilCoords: { x: number; y: number }[] = [];
    for (let y = FARM_SOIL_BOUNDS.minY; y <= FARM_SOIL_BOUNDS.maxY; y++) {
      for (let x = FARM_SOIL_BOUNDS.minX; x <= FARM_SOIL_BOUNDS.maxX; x++) {
        soilCoords.push({ x, y });
        this.setCell(x, y, { type: 'soil', walkable: true, unlocked: false });
      }
    }
    for (const { x, y } of this.pickInitialUnlockedSoil(soilCoords)) {
      this.setCell(x, y, { unlocked: true, soilWaterLevel: 0 });
    }

    // Trees
    const treeSpots: [number, number, string][] = [
      [1, 9, 'tree_01'],
      [1, 10, 'tree_02'],
      [16, 12, 'tree_01'],
      [2, 14, 'tree_02'],
    ];
    for (const [tx, ty, key] of treeSpots) {
      if (this.isFarmIslandFootprintCell(tx, ty)) continue;
      if (isFarmNorthEdgeCell(tx, ty)) continue;
      this.setCell(tx, ty, { walkable: false });
      this.setObject(tx, ty, key);
    }

    // Rocks and bushes
    const decor: [number, number, string][] = [
      [5, 15, 'rock_01'],
      [12, 15, 'bush_01'],
      [17, 11, 'bush_01'],
    ];
    for (const [dx, dy, key] of decor) {
      if (this.isFarmIslandFootprintCell(dx, dy)) continue;
      if (isFarmNorthEdgeCell(dx, dy)) continue;
      this.setCell(dx, dy, { walkable: false });
      this.setObject(dx, dy, key);
    }

    this.applyFarmPathRing();
    this.assignAllGroundDecorVariants();

    return { spawnX, spawnY };
  }

  /** Center cluster of the farm soil patch (matches FARM_SOIL_BOUNDS). */
  getFarmSoilCenter(): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    return {
      x: Math.floor((minX + maxX) / 2),
      y: Math.floor((minY + maxY) / 2),
    };
  }

  isFarmSoilCell(gx: number, gy: number): boolean {
    const cell = this.getCell(gx, gy);
    return cell?.type === 'soil';
  }

  /** True when cell lies in the farm planting rectangle and is soil. */
  isFarmPlantingCell(gx: number, gy: number): boolean {
    if (
      gx < FARM_SOIL_BOUNDS.minX ||
      gx > FARM_SOIL_BOUNDS.maxX ||
      gy < FARM_SOIL_BOUNDS.minY ||
      gy > FARM_SOIL_BOUNDS.maxY
    ) {
      return false;
    }
    return this.getCell(gx, gy)?.type === 'soil';
  }

  /**
   * Soil rectangle plus outer ring (path/water neighbors) where island art must sit under tiles.
   */
  isFarmIslandFootprintCell(gx: number, gy: number, ringMargin = 1): boolean {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    return (
      gx >= minX - ringMargin &&
      gx <= maxX + ringMargin &&
      gy >= minY - ringMargin &&
      gy <= maxY + ringMargin
    );
  }

  /**
   * Farm land (soil, path ring, water) always draws ground tiles above island.png.
   * Island art is only visible in the moat/margin where no ground sprites exist.
   */
  hidesGroundForFarmIsland(_gx: number, _gy: number): boolean {
    return false;
  }

  /**
   * All cells that show decorative grass textures:
   * - outer grass (not water/path, no object)
   * - locked farm soil (grass appearance via groundVariant)
   * Excludes unlocked farm soil (farm_plot / moisture textures).
   */
  getGroundDecorEligiblePool(): { x: number; y: number }[] {
    const pool: { x: number; y: number }[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const cell = this.getCell(x, y);
        if (!cell || cell.object) continue;
        if (cell.type === 'water' || cell.type === 'path') continue;
        if (cell.type === 'soil') {
          if (this.isFarmUnlocked(x, y)) continue;
          pool.push({ x, y });
          continue;
        }
        if (cell.type === 'grass') {
          pool.push({ x, y });
        }
      }
    }
    return pool;
  }

  /**
   * Ring around the soil rectangle: orthogonal + diagonal neighbors outside soil,
   * inside map. Skips water and cells with map objects (trees/rocks).
   */
  applyFarmPathRing(): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFarmSoilCell(x, y)) continue;
        if (!this.isAdjacentToFarmSoil(x, y)) continue;
        const cell = this.getCell(x, y);
        if (!cell || cell.type === 'water' || cell.object) continue;
        this.setCell(x, y, { type: 'path', walkable: true });
      }
    }
  }

  /** Backfill path ring on saves created before path tiles existed. */
  ensureFarmPathRing(): void {
    this.applyFarmPathRing();
  }

  /** Backfill decor variants on eligible cells that lack groundVariant (e.g. old saves). */
  ensureGroundDecor(): void {
    const open = this.getGroundDecorEligiblePool().filter(
      ({ x, y }) => !this.getCell(x, y)?.groundVariant
    );
    if (open.length === 0) return;
    this.assignGroundDecorVariants(open, open.length);
  }

  private isAdjacentToFarmSoil(gx: number, gy: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.isFarmSoilCell(gx + dx, gy + dy)) return true;
      }
    }
    return false;
  }

  getSoilTileCoords(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.getCell(x, y)?.type === 'soil') out.push({ x, y });
      }
    }
    return out;
  }

  /** Deterministic priority: Manhattan distance to farm center, then y, then x. */
  private pickSoilTilesByCenter(
    soilCoords: { x: number; y: number }[],
    count: number
  ): { x: number; y: number }[] {
    const { x: cx, y: cy } = this.getFarmSoilCenter();
    return [...soilCoords]
      .sort((a, b) => {
        const da = Math.abs(a.x - cx) + Math.abs(a.y - cy);
        const db = Math.abs(b.x - cx) + Math.abs(b.y - cy);
        if (da !== db) return da - db;
        return a.y - b.y || a.x - b.x;
      })
      .slice(0, count);
  }

  private pickInitialUnlockedSoil(
    soilCoords: { x: number; y: number }[]
  ): { x: number; y: number }[] {
    return this.pickSoilTilesByCenter(soilCoords, INITIAL_UNLOCKED_FARM_TILES);
  }

  /**
   * After loading a save: explicit booleans on soil, then cap or fill to
   * INITIAL_UNLOCKED_FARM_TILES + landPurchases (center cluster wins ties).
   */
  normalizeUnlockedSoil(landPurchases = 0): void {
    const allowed = INITIAL_UNLOCKED_FARM_TILES + Math.max(0, landPurchases);
    const soilCoords = this.getSoilTileCoords();
    if (soilCoords.length === 0) return;

    for (const { x, y } of soilCoords) {
      const cell = this.getCell(x, y);
      if (cell && cell.unlocked === undefined) {
        this.setCell(x, y, { unlocked: false });
      }
    }

    let unlocked = soilCoords.filter(({ x, y }) => this.isFarmUnlocked(x, y));

    if (unlocked.length > allowed) {
      const keep = new Set(
        this.pickSoilTilesByCenter(unlocked, allowed).map(({ x, y }) => `${x},${y}`)
      );
      for (const { x, y } of soilCoords) {
        if (!keep.has(`${x},${y}`)) {
          this.setCell(x, y, { unlocked: false });
        }
      }
      return;
    }

    if (unlocked.length < allowed) {
      const locked = soilCoords.filter(({ x, y }) => !this.isFarmUnlocked(x, y));
      const toUnlock = this.pickSoilTilesByCenter(locked, allowed - unlocked.length);
      for (const { x, y } of toUnlock) {
        this.setCell(x, y, { unlocked: true });
      }
    }
  }

  /** Soil is farmable only when explicitly unlocked. */
  isFarmUnlocked(gx: number, gy: number): boolean {
    const cell = this.getCell(gx, gy);
    if (!cell || cell.type !== 'soil') return true;
    return cell.unlocked === true;
  }

  isLockedSoil(gx: number, gy: number): boolean {
    const cell = this.getCell(gx, gy);
    return cell?.type === 'soil' && !this.isFarmUnlocked(gx, gy);
  }

  countUnlockedSoil(): number {
    return this.getSoilTileCoords().filter(({ x, y }) => this.isFarmUnlocked(x, y)).length;
  }

  unlockSoilTile(gx: number, gy: number): boolean {
    const cell = this.getCell(gx, gy);
    if (!cell || cell.type !== 'soil' || cell.unlocked === true) return false;
    this.setCell(gx, gy, { unlocked: true });
    return true;
  }

  private static readonly GROUND_DECOR_GROUP: GroundDecorVariant[] = [
    'flower_ground',
    'flower_ground',
    'flower_ground',
    'grass_light',
    'grass_light',
    'grass',
    'grass',
    'grass',
    'grass',
    'grass',
  ];

  private shuffledArray<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private shuffledGroundDecorGroup(): GroundDecorVariant[] {
    return this.shuffledArray(GridSystem.GROUND_DECOR_GROUP);
  }

  /** Build N variants: floor(N/10) shuffled 3/2/5 groups + proportional remainder. */
  private buildGroundDecorVariantList(count: number): GroundDecorVariant[] {
    if (count <= 0) return [];
    const { groupSize, flower, grassLight } = GROUND_DECOR_MIX;
    const list: GroundDecorVariant[] = [];
    const groups = Math.floor(count / groupSize);
    const remainder = count % groupSize;

    for (let g = 0; g < groups; g++) {
      list.push(...this.shuffledGroundDecorGroup());
    }

    if (remainder > 0) {
      const flowerCount = Math.round(remainder * (flower / groupSize));
      const grassLightCount = Math.round(remainder * (grassLight / groupSize));
      const grassCount = remainder - flowerCount - grassLightCount;
      const tail: GroundDecorVariant[] = [
        ...Array(flowerCount).fill('flower_ground' as GroundDecorVariant),
        ...Array(grassLightCount).fill('grass_light' as GroundDecorVariant),
        ...Array(grassCount).fill('grass' as GroundDecorVariant),
      ];
      list.push(...this.shuffledArray(tail));
    }

    return this.shuffledArray(list);
  }

  /**
   * Assign shuffled decor variants (3/2/5 per 10 + proportional remainder) to up to
   * `count` random coords. Persisted via grid save (`groundVariant` on cell).
   */
  private assignGroundDecorVariants(
    coords: { x: number; y: number }[],
    count: number
  ): void {
    if (coords.length === 0 || count <= 0) return;
    const assignCount = Math.min(count, coords.length);
    const variants = this.buildGroundDecorVariantList(assignCount);
    const picked = this.shuffleCoords(coords).slice(0, assignCount);
    picked.forEach(({ x, y }, i) => {
      this.setCell(x, y, { groundVariant: variants[i] ?? 'grass' });
    });
  }

  /** On new game: ratio-based decor on every eligible cell (after path/objects). */
  assignAllGroundDecorVariants(): void {
    const pool = this.getGroundDecorEligiblePool();
    this.assignGroundDecorVariants(pool, pool.length);
  }

  private shuffleCoords<T extends { x: number; y: number }>(coords: T[]): T[] {
    const out = [...coords];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  getSoilWaterLevel(gx: number, gy: number): number {
    const cell = this.getCell(gx, gy);
    if (!cell || cell.type !== 'soil') return 0;
    return Math.max(0, Math.min(100, cell.soilWaterLevel ?? 0));
  }

  setSoilWaterLevel(gx: number, gy: number, level: number): void {
    if (!this.inBounds(gx, gy)) return;
    const cell = this.getCell(gx, gy);
    if (!cell || cell.type !== 'soil' || !this.isFarmUnlocked(gx, gy)) return;
    this.setCell(gx, gy, { soilWaterLevel: Math.max(0, Math.min(100, level)) });
  }

  addSoilWater(gx: number, gy: number, amount: number): number {
    const next = Math.min(100, this.getSoilWaterLevel(gx, gy) + amount);
    this.setSoilWaterLevel(gx, gy, next);
    return next;
  }

  getGroundTextureKey(gx: number, gy: number, options?: GroundTextureOptions): string {
    const cell = this.getCell(gx, gy);
    if (!cell) return 'grass';
    if (cell.type === 'water') {
      const probe: WaterNeighborProbe = (nx, ny) => {
        if (!this.inBounds(nx, ny)) return false;
        return this.getCell(nx, ny)?.type === 'water';
      };
      return waterTextureKeyAt(gx, gy, probe);
    }
    if (cell.type === 'path') return 'stone_path';
    if (cell.type === 'soil') {
      if (!this.isFarmUnlocked(gx, gy)) {
        return cell.groundVariant ?? 'grass';
      }
      if (options?.farmPlotGround) return 'farm_plot';
      const moisture =
        options?.soilWaterLevel ?? this.getSoilWaterLevel(gx, gy);
      return soilMoistureTextureKey(moisture, options?.dug === true);
    }
    if (cell.type === 'grass') {
      return cell.groundVariant ?? 'grass';
    }
    return 'grass';
  }

  getAllCells(): TileCell[][] {
    return this.cells;
  }

  loadCells(cells: TileCell[][]): boolean {
    if (cells.length !== this.size) {
      console.warn(
        `[GridSystem] Saved grid size ${cells.length} does not match ${this.size}; using default map`
      );
      return false;
    }
    this.cells = cells;
    return true;
  }
}

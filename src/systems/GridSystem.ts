import {
  FARM_PLAYER_SPAWN_GX,
  FARM_PLAYER_SPAWN_GY,
  FARM_SOIL_BOUNDS,
  GRID_SIZE,
  GROUND_DECOR_MIX,
  INITIAL_UNLOCKED_FARM_TILES,
  soilMoistureTextureKey,
  type GroundDecorVariant,
  type PathGroundVariant,
  type TileType,
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
  isoRectFootprintScreenBounds,
  isoRectFootprintScreenRhombus,
  pickIsoTileAt,
  tileBottomFromTop,
  tileCenterFromGrid,
  TILE_HEIGHT,
  TILE_WIDTH,
  type IsoFootprintScreenBounds,
  type IsoScreenRhombus,
} from '../utils/iso';
import {
  waterPlacementPreviewProbe,
  waterTextureKeyAt,
  type WaterNeighborProbe,
} from '../utils/waterAutotile';
import {
  computePlayableFarmViewportLayout,
  FARM_MAP_TOP_INSET_FRAC,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenY,
  type PlayableFarmViewportLayout,
} from '../ui/hudLayout';
import type { FarmFootprintBounds } from '../farmCameraScroll';

export type MapLayer = 'ground' | 'objects' | 'crops' | 'buildings' | 'entities';

export interface TileCell {
  type: TileType;
  walkable: boolean;
  object?: string;
  /** Soil only: false = locked until land purchase */
  unlocked?: boolean;
  /** Unlocked soil: moisture for empty/dug plots without a crop sprite (0–100) */
  soilWaterLevel?: number;
  /** Locked soil / outer grass: decorative ground variant (assigned on new game) */
  groundVariant?: GroundDecorVariant;
  /** Path tiles: which path texture to draw (defaults to stone_path). */
  pathVariant?: PathGroundVariant;
}

export interface GroundTextureOptions {
  /** Dig animation: neutral farm_plot instead of moisture tiles */
  farmPlotGround?: boolean;
  /** Tilled plot — moisture bands use soil (dry) / mud / wet_soil */
  dug?: boolean;
  /** Override cell {@link TileCell.soilWaterLevel} for texture pick (e.g. neglect-dry). */
  soilWaterLevel?: number;
  /** Build ghost: pick shore sprite as if this cell were already water. */
  waterPlacementPreview?: boolean;
}

export class GridSystem {
  readonly size = GRID_SIZE;
  readonly tileWidth = TILE_WIDTH;
  readonly tileHeight = TILE_HEIGHT;
  originX = 0;
  originY = 0;
  /**
   * Extra world Y for the full map (tiles, crops, buildings) without moving the soil
   * rhombus / island pan bounds — {@link alignMapTopToPanBoundsInset} adjusts this, not originY.
   */
  mapTopPanOffsetY = 0;

  /** Horizontal map shift applied to the full 20x20 map layer against pan bounds. */
  mapTopPanOffsetX = 0;

  private cells: TileCell[][] = [];
  /** Extra movement blockers (e.g. pen footprint without a stale grid marker). */
  private walkBlocked?: (gx: number, gy: number) => boolean;

  constructor() {
    this.initEmpty();
  }

  initEmpty(): void {
    this.cells = [];
    for (let y = 0; y < this.size; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = { type: 'void', walkable: false };
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
   * Lay out the grid so the farm footprint iso rhombus center sits at the HUD-balanced viewport
   * center (camera scroll 0, zoom 1 baseline). See {@link computePlayableFarmViewportLayout}.
   */
  /**
   * Move farm world origin so a camera scroll of (0,0) matches a prior scroll offset.
   * Does not reset {@link mapTopPanOffsetX} / {@link mapTopPanOffsetY} (screen-relative offsets).
   */
  shiftFarmWorldBy(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.originX += dx;
    this.originY += dy;
  }

  /**
   * Analytical hard placement: set {@link originX}/{@link originY} so tile `(gx, gy)` diamond center
   * equals `(worldX, worldY)` on the map layer. Clears virtual {@link mapTopPanOffsetX/Y}.
   */
  setMapTileCenterWorld(gx: number, gy: number, worldX: number, worldY: number): void {
    this.mapTopPanOffsetX = 0;
    this.mapTopPanOffsetY = 0;
    const cx = gx + 0.5;
    const cy = gy + 0.5;
    this.originX = worldX - (cx - cy) * (this.tileWidth / 2);
    this.originY = worldY - (cx + cy) * (this.tileHeight / 2);
  }

  centerInViewport(
    viewW: number,
    viewH: number,
    padX = 10,
    padY = 10
  ): void {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const centerGx = (minX + maxX) / 2;
    const centerGy = (minY + maxY) / 2;
    const layout = computePlayableFarmViewportLayout(viewW, viewH, padX, padY);
    const { centerX: targetX, centerY: targetY } = layout;
    const topOffsetX = (centerGx - centerGy) * (this.tileWidth / 2);
    const topOffsetY = (centerGx + centerGy) * (this.tileHeight / 2);
    this.originX = targetX - topOffsetX;
    this.originY = targetY - topOffsetY - this.tileHeight / 2;
    const footprintCenter = this.getFarmFootprintScreenRhombus().center;
    this.originX += targetX - footprintCenter.x;
    this.originY += targetY - footprintCenter.y;
    this.mapTopPanOffsetY = 0;
    this.mapTopPanOffsetX = 0;
  }

  /**
   * Align map AABB top to a screen Y inside the playable HUD band (after camera scroll/zoom).
   * Smaller {@link FARM_MAP_TOP_INSET_FRAC} moves the map up on screen.
   */
  alignMapTopToPlayableInset(
    layout: PlayableFarmViewportLayout,
    scrollY: number,
    zoom: number,
    insetFrac: number = FARM_MAP_TOP_INSET_FRAC
  ): void {
    const playableH = layout.playableBottom - layout.playableTop;
    const targetScreenY = getFarmMapTopTargetScreenY(
      layout.playableTop,
      playableH,
      insetFrac
    );
    const mapMinY = this.getMapScreenBounds().minY;
    const currentScreenY = (mapMinY - scrollY) * zoom;
    const deltaScreen = targetScreenY - currentScreenY;
    this.originY += deltaScreen / zoom;
  }

  /**
   * Align full 20×20 map top to a fraction down the orange pan-bounds AABB (world Y).
   * Adjusts {@link mapTopPanOffsetY} so the full map layer (footprint + outer tiles) shifts together.
   */
  alignMapTopToPanBoundsInset(
    panBounds: FarmFootprintBounds,
    _scrollY: number,
    _zoom: number,
    frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
  ): void {
    const panH = panBounds.maxY - panBounds.minY;
    const targetMapMinY = panBounds.minY + panH * frac;
    const currentMapMinY = this.getMapScreenBounds().minY;
    this.mapTopPanOffsetY += targetMapMinY - currentMapMinY;

    // Center full map AABB horizontally in pan bounds (scroll-zero bake → map center at viewport center world).
    const panW = panBounds.maxX - panBounds.minX;
    const visual = this.getVisualMapScreenBounds();
    const mapW = visual.maxX - visual.minX;
    const targetMapMinX = panBounds.minX + (panW - mapW) / 2;
    this.mapTopPanOffsetX = targetMapMinX - visual.minX;
  }

  /**
   * Align map-layer top Y to pan-bounds inset at camera scroll (0,0) without changing
   * {@link mapTopPanOffsetX} (preserves horizontal pan-target after scroll-zero bake).
   */
  alignMapTopYToPanBoundsInset(
    panBounds: FarmFootprintBounds,
    frac: number = FARM_MAP_TOP_PAN_BOUNDS_FRAC
  ): void {
    const panH = panBounds.maxY - panBounds.minY;
    const targetMapMinY = panBounds.minY + panH * frac;
    const currentMapMinY = this.getMapScreenBounds().minY;
    this.mapTopPanOffsetY += targetMapMinY - currentMapMinY;
  }

  /** Screen center of the farm soil + path ring AABB (iso diamond bounds). */
  getFarmFootprintAabbCenterScreen(): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = this.getFarmFootprintScreenBounds();
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  /** Farm soil patch bottom-right anchor (SE corner tile bottom vertex). */
  getFarmSoilBottomRightAnchor(): { x: number; y: number } {
    const { maxX, maxY } = FARM_SOIL_BOUNDS;
    return this.gridToMapTileBottom(maxX, maxY);
  }

  private accumulateIsoBounds(
    corners: [number, number][],
    out: { minX: number; minY: number; maxX: number; maxY: number },
    useMapOffset = false
  ): void {
    const hw = this.tileWidth / 2;
    for (const [gx, gy] of corners) {
      const top = useMapOffset ? this.gridToMapScreen(gx, gy) : this.gridToScreen(gx, gy);
      const bottom = tileBottomFromTop(top);
      out.minX = Math.min(out.minX, top.x - hw);
      out.maxX = Math.max(out.maxX, top.x + hw);
      out.minY = Math.min(out.minY, top.y);
      out.maxY = Math.max(out.maxY, bottom.y);
    }
  }

  /** Screen center of the full 20×20 map AABB ({@link getMapScreenBounds}). */
  getFarmMapCenterScreen(): { x: number; y: number } {
    const b = this.getMapScreenBounds();
    return { x: b.centerX, y: b.centerY };
  }

  /**
   * Visual / playable map center for bake and zoom keyframes: default farmer spawn
   * (where the character stands at the viewport center), not the iso AABB centroid on water.
   */
  getFarmPlayableMapCenterScreen(): { x: number; y: number } {
    return this.getFarmPlayerSpawnScreen();
  }

  /**
   * True when {@link getFarmMapCenterScreen} matches the AABB center from corner tiles
   * [0,0], [size−1,0], [0,size−1], [size−1,size−1] (iso diamond extents), not grid (9.5, 9.5).
   */
  isFarmMapCenterTrueAabb(): boolean {
    const corners: [number, number][] = [
      [0, 0],
      [this.size - 1, 0],
      [0, this.size - 1],
      [this.size - 1, this.size - 1],
    ];
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.accumulateIsoBounds(corners, box, true);
    const c = this.getFarmMapCenterScreen();
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    return Math.abs(c.x - cx) < 1e-4 && Math.abs(c.y - cy) < 1e-4;
  }

  /** Full 20×20 map AABB including {@link mapTopPanOffsetY} (camera virtual layer). */
  getMapScreenBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  } {
    return this.getVisualMapScreenBounds(true);
  }

  /**
   * 20×20 map AABB from {@link gridToScreen} when `includeMapTopOffset` is false (pre-pan baseline).
   * {@link alignMapTopToPanBoundsInset} compares that baseline to the pan target before setting
   * {@link mapTopPanOffsetY}; rendered tiles use {@link gridToMapScreen}.
   */
  getVisualMapScreenBounds(includeMapTopOffset = false): {
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
    this.accumulateIsoBounds(corners, box, includeMapTopOffset);
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
    this.accumulateIsoBounds(corners, box, true);
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
  getFarmSoilScreenRhombus(): IsoScreenRhombus {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const tilesW = maxX - minX + 1;
    const tilesH = maxY - minY + 1;
    return isoRectFootprintScreenRhombus(
      minX,
      minY,
      tilesW,
      tilesH,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY
    );
  }

  /** Soil + path ring outer iso rhombus (10×10 cells for 8×8 soil + margin 1). */
  getFarmFootprintScreenRhombus(ringMargin = FARM_ISLAND_RING_MARGIN): IsoScreenRhombus {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const anchorGx = minX - ringMargin;
    const anchorGy = minY - ringMargin;
    const tilesW = maxX - minX + 1 + 2 * ringMargin;
    const tilesH = maxY - minY + 1 + 2 * ringMargin;
    return isoRectFootprintScreenRhombus(
      anchorGx,
      anchorGy,
      tilesW,
      tilesH,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY
    );
  }

  /**
   * Soil tile tops vs cyan footprint rhombus (world space). Used by tests and
   * {@link FarmScene.getSoilFootprintAlignMetricsForTest}.
   */
  measureSoilFootprintAlignment(ringMargin = FARM_ISLAND_RING_MARGIN): {
    soilGridRange: { minX: number; maxX: number; minY: number; maxY: number };
    footprintCenterX: number;
    footprintCenterY: number;
    soilClusterCenterX: number;
    soilClusterCenterY: number;
    centerAlignErrorPx: number;
    maxTileOutsideAabbPx: number;
    soilFootprintAlignError: number;
  } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    const footprint = this.getFarmFootprintScreenRhombus(ringMargin);
    const aabbMinX = Math.min(
      footprint.north.x,
      footprint.east.x,
      footprint.south.x,
      footprint.west.x
    );
    const aabbMaxX = Math.max(
      footprint.north.x,
      footprint.east.x,
      footprint.south.x,
      footprint.west.x
    );
    const aabbMinY = Math.min(
      footprint.north.y,
      footprint.east.y,
      footprint.south.y,
      footprint.west.y
    );
    const aabbMaxY = Math.max(
      footprint.north.y,
      footprint.east.y,
      footprint.south.y,
      footprint.west.y
    );

    let maxTileOutsideAabbPx = 0;

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const top = this.gridToMapScreen(gx, gy);
        const outsideX =
          top.x < aabbMinX ? aabbMinX - top.x : top.x > aabbMaxX ? top.x - aabbMaxX : 0;
        const outsideY =
          top.y < aabbMinY ? aabbMinY - top.y : top.y > aabbMaxY ? top.y - aabbMaxY : 0;
        maxTileOutsideAabbPx = Math.max(
          maxTileOutsideAabbPx,
          Math.hypot(outsideX, outsideY)
        );
      }
    }

    const patchCenter = this.getFarmSoilPatchCenterScreen();
    const soilClusterCenterX = patchCenter.x;
    const soilClusterCenterY = patchCenter.y;
    const centerAlignErrorPx = Math.hypot(
      footprint.center.x - soilClusterCenterX,
      footprint.center.y - soilClusterCenterY
    );

    return {
      soilGridRange: { minX, maxX, minY, maxY },
      footprintCenterX: footprint.center.x,
      footprintCenterY: footprint.center.y,
      soilClusterCenterX,
      soilClusterCenterY,
      centerAlignErrorPx,
      maxTileOutsideAabbPx,
      soilFootprintAlignError: Math.max(centerAlignErrorPx, maxTileOutsideAabbPx),
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
    this.accumulateIsoBounds(corners, box, true);
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
    const anchorGx = minX - ringMargin;
    const anchorGy = minY - ringMargin;
    const tilesW = maxX - minX + 1 + 2 * ringMargin;
    const tilesH = maxY - minY + 1 + 2 * ringMargin;
    const box = isoRectFootprintScreenBounds(
      anchorGx,
      anchorGy,
      tilesW,
      tilesH,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY
    );
    const patchCenter = this.getFarmSoilPatchCenterScreen();
    return {
      minX: box.minX,
      minY: box.minY,
      maxX: box.maxX,
      maxY: box.maxY,
      centerX: patchCenter.x,
      centerY: patchCenter.y,
    };
  }

  /** Iso diamond center of the full farm soil rectangle (FARM_SOIL_BOUNDS). */
  getFarmSoilPatchCenterScreen(): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
    return this.gridToMapTileCenter((minX + maxX) / 2, (minY + maxY) / 2);
  }

  /** Camera scroll anchor: iso center of the full farm soil patch (FARM_SOIL_BOUNDS). */
  getFarmSoilCameraAnchor(): { x: number; y: number } {
    return this.getFarmSoilPatchCenterScreen();
  }

  /** Default farmer spawn in world/map space (not the scroll-zero layout anchor; see farmWorldScrollAnchor). */
  getFarmPlayerSpawnScreen(
    gx: number = FARM_PLAYER_SPAWN_GX,
    gy: number = FARM_PLAYER_SPAWN_GY
  ): { x: number; y: number } {
    return this.gridToPlayerTile(gx, gy);
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

  setWalkBlocked(fn: ((gx: number, gy: number) => boolean) | undefined): void {
    this.walkBlocked = fn;
  }

  isWalkable(gx: number, gy: number): boolean {
    const c = this.getCell(gx, gy);
    if (c === null || !c.walkable || c.object) return false;
    if (this.walkBlocked?.(gx, gy)) return false;
    return true;
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
    if (cell.type === 'water' || cell.type === 'void') {
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

  /** Map-layer top vertex (ground, island, debug, camera bounds) including {@link mapTopPanOffsetY}. */
  gridToMapScreen(gx: number, gy: number): { x: number; y: number } {
    const p = this.gridToScreen(gx, gy);
    return { x: p.x + this.mapTopPanOffsetX, y: p.y + this.mapTopPanOffsetY };
  }

  /** Diamond geometric center; accepts fractional grid coords during movement */
  gridToTileCenter(gx: number, gy: number): { x: number; y: number } {
    return tileCenterFromGrid(gx, gy, this.originX, this.originY);
  }

  /** Tile center on the shifted map layer (VFX, crops). */
  gridToMapTileCenter(gx: number, gy: number): { x: number; y: number } {
    return tileCenterFromGrid(
      gx,
      gy,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY
    );
  }

  /** Player feet at diamond center on the map layer (not bottom vertex). */
  gridToPlayerTile(gx: number, gy: number): { x: number; y: number } {
    return this.gridToMapTileCenter(gx, gy);
  }

  /** Diamond bottom vertex on the map layer (crops, decorations, buildings). */
  gridToTileBottom(gx: number, gy: number): { x: number; y: number } {
    return this.gridToMapTileBottom(gx, gy);
  }

  /** Walk destination pin: diamond center on map layer (same anchor as {@link gridToPlayerTile}). */
  gridToMoveDestinationMarker(gx: number, gy: number): { x: number; y: number } {
    return this.gridToMapTileCenter(gx, gy);
  }

  /** Diamond bottom on the map layer (alias for pens / explicit map-layer callers). */
  gridToMapTileBottom(gx: number, gy: number): { x: number; y: number } {
    return tileBottomFromTop(this.gridToMapScreen(gx, gy));
  }

  /** Ground tile top vertex on the map layer (same as {@link gridToMapScreen}). */
  gridToGroundScreen(gx: number, gy: number): { x: number; y: number } {
    return this.gridToMapScreen(gx, gy);
  }

  /** Screen bounds for a rectangular tile footprint (e.g. livestock pen 3×3). */
  getRectFootprintScreenBounds(
    anchorGx: number,
    anchorGy: number,
    tilesW: number,
    tilesH: number
  ): IsoFootprintScreenBounds {
    return isoRectFootprintScreenBounds(
      anchorGx,
      anchorGy,
      tilesW,
      tilesH,
      this.originX,
      this.originY
    );
  }

  /** Rect footprint on the shifted map layer (livestock pens). */
  getRectMapFootprintScreenBounds(
    anchorGx: number,
    anchorGy: number,
    tilesW: number,
    tilesH: number
  ): IsoFootprintScreenBounds {
    return isoRectFootprintScreenBounds(
      anchorGx,
      anchorGy,
      tilesW,
      tilesH,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY
    );
  }

  /** World-space pick using isometric diamond hit test (matches top-vertex tile sprites). */
  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return pickIsoTileAt(
      worldX,
      worldY,
      this.originX + this.mapTopPanOffsetX,
      this.originY + this.mapTopPanOffsetY,
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

  /** Minimal 20×20 map: farm soil patch, stone path ring, void elsewhere (decor from Build). */
  generatePlaceholderMap(): { spawnX: number; spawnY: number } {
    const spawnX = FARM_PLAYER_SPAWN_GX;
    const spawnY = FARM_PLAYER_SPAWN_GY;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = { type: 'void', walkable: false };
      }
    }

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

    this.applyFarmPathRing();

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

  /** River / placed water tile (`type: 'water'`). Used for bridge placement. */
  isRiverWaterCell(gx: number, gy: number): boolean {
    if (!this.inBounds(gx, gy)) return false;
    return this.getCell(gx, gy)?.type === 'water';
  }

  /**
   * Bridge may span river water, a 1-tile-wide crossing (grass/path between opposite water),
   * or decor path tiles along a river bank (adjacent to water).
   */
  canPlaceBridgeAt(gx: number, gy: number): boolean {
    if (!this.inBounds(gx, gy)) return false;
    const cell = this.getCell(gx, gy);
    if (!cell) return false;

    if (cell.type === 'water') return true;

    if (cell.type === 'grass') {
      return this.isNarrowRiverCrossingCell(gx, gy);
    }

    if (cell.type === 'path') {
      const variant = cell.pathVariant ?? 'stone_path';
      if (variant === 'bridge_tile' || variant === 'stone_path' || variant === 'field_border') {
        return false;
      }
      return (
        this.isNarrowRiverCrossingCell(gx, gy) || this.hasCardinalRiverWaterNeighbor(gx, gy)
      );
    }

    return false;
  }

  private hasCardinalRiverWaterNeighbor(gx: number, gy: number): boolean {
    return (
      this.isRiverWaterCell(gx, gy - 1) ||
      this.isRiverWaterCell(gx, gy + 1) ||
      this.isRiverWaterCell(gx + 1, gy) ||
      this.isRiverWaterCell(gx - 1, gy)
    );
  }

  /** Water on two opposite cardinals — land strip or iso-picked shore in a 1-wide river. */
  private isNarrowRiverCrossingCell(gx: number, gy: number): boolean {
    const pairs: ReadonlyArray<[[number, number], [number, number]]> = [
      [[0, -1], [0, 1]],
      [[-1, 0], [1, 0]],
    ];
    for (const [da, db] of pairs) {
      if (
        this.isRiverWaterCell(gx + da[0], gy + da[1]) &&
        this.isRiverWaterCell(gx + db[0], gy + db[1])
      ) {
        return true;
      }
    }
    return false;
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
        if (cell.type !== 'void' && cell.type !== 'grass') continue;
        this.setCell(x, y, {
          type: 'path',
          walkable: true,
          groundVariant: undefined,
          pathVariant: 'stone_path',
        });
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

  isAdjacentToFarmSoil(gx: number, gy: number): boolean {
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
    if (cell.type === 'water' || options?.waterPlacementPreview) {
      const baseProbe: WaterNeighborProbe = (nx, ny) => {
        if (!this.inBounds(nx, ny)) return false;
        return this.getCell(nx, ny)?.type === 'water';
      };
      const probe = options?.waterPlacementPreview
        ? waterPlacementPreviewProbe(gx, gy, baseProbe)
        : baseProbe;
      return waterTextureKeyAt(gx, gy, probe);
    }
    if (cell.type === 'path') return cell.pathVariant ?? 'stone_path';
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
    if (cell.type === 'void') {
      return 'grass';
    }
    return 'grass';
  }

  isVoidCell(gx: number, gy: number): boolean {
    return this.getCell(gx, gy)?.type === 'void';
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

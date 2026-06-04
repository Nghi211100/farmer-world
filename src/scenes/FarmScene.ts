import Phaser from 'phaser';
import { applyViewportCoverBackground } from '../backgroundLayout';
import {
  computeFarmIslandScreenBounds,
  computeFarmIslandWorldDepth,
  FARM_ISLAND_SCALE_BOOST,
  isFarmNorthEdgeCell,
  layoutFarmIslandImage,
} from '../farmIslandLayout';
import { getCropDef } from '../config/CropConfig';
import {
  DEFAULT_COINS,
  DEFAULT_ENERGY,
  DEFAULT_GEMS,
  FARM_PLAYER_SPAWN_GX,
  FARM_PLAYER_SPAWN_GY,
  FarmTool,
  isDebugMode,
  isFarmCameraDebug,
  isFarmCenterDebugMarkers,
  getFarmForceSpawnWorld,
  isFarmGridDebug,
  isPersistentToolBarEnabled,
  LAND_EXPAND_STRINGS,
  PlayerFarmAction,
  SOIL_IDLE_STRINGS,
} from '../config/gameConfig';
import { CropSelectPopup } from '../ui/CropSelectPopup';
import { FarmActionPopup, type FarmPopupAction } from '../ui/FarmActionPopup';
import { ExpandLandDimOverlay } from '../ui/ExpandLandDimOverlay';
import { BuildPlacementConfirm } from '../ui/BuildPlacementConfirm';
import { LandUnlockConfirm } from '../ui/LandUnlockConfirm';
import { ObjectEditPopup, type ObjectEditAction } from '../ui/ObjectEditPopup';
import { ObjectEditSystem } from '../systems/ObjectEditSystem';
import { BuildingSprite, renderBuildings } from '../entities/Building';
import { cropKey, CropSprite, syncCropSprites } from '../entities/Crop';
import { renderMapDecorations } from '../entities/Decoration';
import { Player } from '../entities/Player';
import { BuildSystem } from '../systems/BuildSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { GridSystem } from '../systems/GridSystem';
import { playDigDust, playPlantEffect, playWaterDrop } from '../systems/ActionEffects';
import { playHarvestEffects } from '../systems/HarvestEffects';
import {
  applyIsoBottomBorderWaterSprite,
  applyIsoTileSprite,
  applyIsoTopBorderWaterSprite,
  DISPLAY_SIZE,
  drawIsoTileClickPick,
  drawIsoTileDebug,
  FARM_NORTH_EDGE_GROUND_SCALE,
  GROUND_TILE_SEAM_SCALE,
  fitSpriteDisplay,
  fitSpriteToIsoFootprint,
  NATURE_DISPLAY_SCALE,
  tileCenterFromTop,
} from '../utils/iso';
import { penFootprintTiles, penHouseDisplaySize } from '../config/livestockAssets';
import {
  buildFarmCenterDebugMarkers,
  buildFarmViewportHudDebugOverlay,
  buildFarmWorldDebugGridOverlay,
  farmViewportCenterWorldAtScroll,
  refreshFarmViewportHudVoidHint,
  type FarmCenterDebugMarkersOverlay,
  type FarmViewportHudDebugOverlay,
} from '../utils/farmViewportDebug';
import { farmWorldToScreen, screenBoundsToFootprint } from '../utils/farmViewportDebugLayout';
import {
  getWaterCornerDisplayOffset,
  getWaterGroundDisplayScale,
  getWaterTextureDisplayOffset,
  WATER_BOTTOM_BORDER_TEXTURE_KEY,
  WATER_TOP_BORDER_TEXTURE_KEY,
  type WaterNeighborProbe,
} from '../utils/waterAutotile';
import { EnergySystem } from '../systems/EnergySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { LandSystem } from '../systems/LandSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type { BuildItemDef } from '../systems/BuildSystem';
import { LivestockSystem, type LivestockPenPlaceItemDef } from '../systems/LivestockSystem';
import {
  getLivestockDef,
  LIVESTOCK_PEN_UPGRADE_COST,
  RUMINANT_PEN_LABEL_VI,
  type AnimalType,
  type LivestockPenData,
} from '../config/LivestockConfig';
import { renderLivestockPens, type LivestockPenSprite } from '../entities/LivestockPen';
import type { BuildingData } from '../config/gameConfig';
import {
  computePlayableFarmViewportLayout,
  expandSelectHintToastFontSize,
  FARM_MAP_TOP_PAN_BOUNDS_FRAC,
  getFarmMapTopTargetScreenYFromPanBounds,
  getPlayableBandGeometricCenter,
  getFarmPanBoundsScrollTargetScreen,
  shiftPlayableBandForPanBoundsCenter,
} from '../ui/hudLayout';
import type { UIScene } from './UIScene';
import { ToolBar } from '../ui/ToolBar';
import { exceedsDragThreshold } from '../utils/pointerGesture';
import {
  clampScrollToFarmPlayable,
  clampScrollSoFootprintOverlapsViewport,
  computeCenteredFarmCameraScroll,
  computeFarmViewportVoidMargins,
  resolveFarmPanClampBounds,
  mergeFarmCameraScrollWithOversizeCenter,
  getConfiguredFarmCameraScrollLimits,
  snapFarmOversizeScrollToLimitsMidpoint,
  computeFarmPlayableScreenMargins,
  type FarmFootprintBounds,
  type FarmCameraScrollLimits,
  type PlayableBandRect,
} from '../farmCameraScroll';
import {
  runMapTopPanBoundsCameraPasses,
  syncFarmMapTopCameraScroll,
} from '../farmMapTopCamera';
import {
  computeScrollForMapCenterScreenTarget,
  enforceFarmMapCenterWorldAnchor,
  FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX,
  getFarmMapCenterScreenTargetAtScrollZero,
  getFarmMapCenterWorldOffsetDelta,
  getFarmMapCenterWorldTargetAtDefaultScroll,
  logFarmMapCenterWorldAnchorDeviation,
  type FarmMapCenterWorldEnforceResult,
} from '../farmWorldScrollAnchor';
import {
  clampFarmCameraZoom,
  FARM_CAMERA_DEFAULT_ZOOM,
  FARM_CAMERA_INERTIA_MS,
  FARM_CAMERA_MAX_ZOOM,
  FARM_CAMERA_MIN_ZOOM,
  FARM_CAMERA_PINCH_ZOOM_SCALE,
  FARM_CAMERA_WHEEL_ZOOM_SCALE,
  getFarmDefaultScrollAtZoom,
  getFarmMapCenterWorldOffsets,
} from '../config/farmCameraConfig';
import {
  decayPanVelocity,
  panInertiaIsSettled,
  stepSmoothZoomAtAnchor,
  stepSmoothZoomAtMapCenter,
} from '../farmCameraMotion';

type FarmMode = 'normal' | 'build' | 'livestock' | 'expand' | 'plant';
/** Padding inside playable HUD band when fitting the farm diamond. */
const FARM_FIT_PAD_X = 10;
const FARM_FIT_PAD_Y = 10;
export class FarmScene extends Phaser.Scene {
  grid!: GridSystem;
  farming!: FarmingSystem;
  buildSystem!: BuildSystem;
  livestockSystem!: LivestockSystem;
  objectEditSystem!: ObjectEditSystem;
  inventory!: InventorySystem;
  economy!: EconomySystem;
  energySystem!: EnergySystem;
  landSystem!: LandSystem;
  saveSystem!: SaveSystem;
  player!: Player;

  private gems = DEFAULT_GEMS;
  private energyPassiveTimer = 0;
  private farmMode: FarmMode = 'normal';
  private selectedSeedId?: string;
  private selectedTool: FarmTool = FarmTool.HOE;
  private pendingPlantCell?: { x: number; y: number };
  private pendingFarmTile?: { x: number; y: number };
  private farmActionPopup!: FarmActionPopup;
  private farmPopupsReady = false;
  private cropSelectPopup!: CropSelectPopup;
  private landUnlockConfirm!: LandUnlockConfirm;
  private buildPlacementConfirm!: BuildPlacementConfirm;
  private objectEditPopup!: ObjectEditPopup;
  private pendingExpandTile?: { x: number; y: number };
  private toolBar?: ToolBar;

  private tileSprites: Phaser.GameObjects.Image[] = [];
  private tileDebugGraphics?: Phaser.GameObjects.Graphics;
  private farmWorldDebugContainer?: Phaser.GameObjects.Container;
  private farmViewportHudDebugContainer?: FarmViewportHudDebugOverlay;
  private clickPickGraphics?: Phaser.GameObjects.Graphics;
  private clickPickLabel?: Phaser.GameObjects.Text;
  private clickPickGx = -1;
  private clickPickGy = -1;
  private cameraDebugLabel?: Phaser.GameObjects.Text;
  private farmCenterDebugMarkers?: FarmCenterDebugMarkersOverlay;
  private cropSprites = new Map<string, CropSprite>();
  private buildingSprites = new Map<string, BuildingSprite>();
  private livestockPenSprites = new Map<string, LivestockPenSprite>();
  private ghostSprite?: Phaser.GameObjects.Sprite;
  private expandDimOverlay?: ExpandLandDimOverlay;
  private decorations: ReturnType<typeof renderMapDecorations> = [];
  private backgroundImage?: Phaser.GameObjects.Image;
  private farmIslandImage?: Phaser.GameObjects.Image;
  private resizeLayoutTimer?: ReturnType<typeof setTimeout>;

  private isDragging = false;
  private pointerGestureActive = false;
  private pointerGestureDragged = false;
  private pointerGestureCancelled = false;
  private pointerGestureStartX = 0;
  private pointerGestureStartY = 0;
  /** Last pointer position for pan deltas (touch can leave prevPosition stale on one axis). */
  private pointerPanLastX = 0;
  private pointerPanLastY = 0;
  private lastPinchDist = 0;
  private lastPanDeltaX = 0;
  private lastPanDeltaY = 0;
  /** Smooth zoom target (wheel/pinch); `cam.zoom` lerps toward this each frame. */
  private cameraTargetZoom = FARM_CAMERA_DEFAULT_ZOOM;
  private cameraZoomAnchorX = 0;
  private cameraZoomAnchorY = 0;
  private cameraPanVelocityX = 0;
  private cameraPanVelocityY = 0;
  private cameraInertiaRemainingMs = 0;
  /** TODO(phase-3): double-tap focus on farm soil — track last tap for stub hook. */
  private lastCameraTapTime = 0;
  private lastCameraTapX = 0;
  private lastCameraTapY = 0;
  /** User panned/zoomed camera — skip auto-recenter on resize until explicit refocus. */
  private cameraScrollTouchedByUser = false;
  /** Last zoom for which map-center world-offset keyframes were applied (1.9 bake baseline). */
  private lastMapCenterWorldOffsetZoom = FARM_CAMERA_DEFAULT_ZOOM;
  /** Expected 20×20 map AABB center world at {@link cameras.main} zoom (after last enforce). */
  private farmMapCenterWorldTargetX = 0;
  private farmMapCenterWorldTargetY = 0;
  private lastCameraLayoutW = 0;
  private lastCameraLayoutH = 0;
  private saveTimer = 0;
  private readonly onPageHide = () => this.flushSave();
  private readonly onBeforeUnload = () => this.flushSave();

  constructor() {
    super({ key: 'FarmScene' });
  }

  create(): void {
    this.grid = new GridSystem();
    this.farming = new FarmingSystem(this.grid);
    this.buildSystem = new BuildSystem(this.grid);
    this.livestockSystem = new LivestockSystem(this.grid);
    this.buildSystem.setPlacementBlocked((gx, gy) => this.livestockSystem.getPenAt(gx, gy) != null);
    this.livestockSystem.setPlacementBlocked((gx, gy) =>
      this.buildSystem.getBuildings().some((b) => b.gridX === gx && b.gridY === gy)
    );
    this.objectEditSystem = new ObjectEditSystem(
      this.grid,
      this.buildSystem,
      this.livestockSystem
    );
    this.inventory = new InventorySystem();
    this.economy = new EconomySystem(DEFAULT_COINS);
    this.energySystem = new EnergySystem(DEFAULT_ENERGY);
    this.landSystem = new LandSystem();
    this.saveSystem = new SaveSystem();

    this.loadGameState();
    this.setupPersistenceHooks();
    this.grid.centerInViewport(
      this.scale.width,
      this.scale.height,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y
    );
    this.setupBackground();
    this.layoutBackground();
    this.setupFarmIsland();
    this.layoutFarmIsland();
    this.renderMap();
    this.setupPlayer();
    this.setupCamera();
    this.layoutBackground();
    this.setupCameraDebugOverlay();
    this.syncFarmDebugOverlays();
    this.setupFarmPopups();
    this.setupInput();
    if (isPersistentToolBarEnabled()) {
      this.setupToolBar();
    }
    this.setFarmMode('normal');
    this.scale.on('resize', this.handleResize, this);
    this.setupUISync();
    this.emitHud();
    this.emitGameRefs();

    this.farming.setOnChange(() => {
      syncCropSprites(this, this.grid, this.farming, this.cropSprites);
      this.refreshFarmSoilGround();
      this.scheduleSave();
    });
    this.farming.startTick(1000);

    this.buildSystem.setOnChange(() => {
      renderBuildings(this, this.grid, this.buildSystem.getBuildings(), this.buildingSprites);
      this.scheduleSave();
    });
    this.livestockSystem.setOnChange(() => {
      renderLivestockPens(
        this,
        this.grid,
        this.livestockSystem.getPens(),
        this.livestockPenSprites
      );
      this.scheduleSave();
    });

    syncCropSprites(this, this.grid, this.farming, this.cropSprites);
    renderBuildings(this, this.grid, this.buildSystem.getBuildings(), this.buildingSprites);
    renderLivestockPens(
      this,
      this.grid,
      this.livestockSystem.getPens(),
      this.livestockPenSprites
    );

    // Layout after UIScene launch; mirrors `ui-ready` if that event was missed.
    this.time.delayedCall(0, () => {
      if (!this.cameraScrollTouchedByUser) {
        this.focusCameraOnFarmSoil();
        this.time.delayedCall(0, () => {
          if (!this.cameraScrollTouchedByUser) {
            this.snapMainCameraOversizeScrollToMidpoint();
          }
        });
      }
    });
  }

  private loadGameState(): void {
    const saved = this.saveSystem.load();
    const savedGrid = this.saveSystem.loadGrid();
    const landPurchases = saved?.landPurchases ?? 0;
    const hasMainSave = saved !== null;

    let gridLoaded = false;
    if (savedGrid) {
      gridLoaded = this.grid.loadCells(savedGrid);
      if (gridLoaded) {
        this.grid.normalizeUnlockedSoil(landPurchases);
        this.grid.ensureFarmPathRing();
        this.grid.ensureGroundDecor();
      }
    }

    if (!gridLoaded) {
      if (hasMainSave) {
        console.info('[FarmScene] Main save found without grid — using default map layout');
      }
      this.grid.generatePlaceholderMap();
    }

    if (saved) {
      const state = this.saveSystem.applySave(
        saved,
        this.farming,
        this.inventory,
        this.economy,
        this.energySystem
      );
      this.gems = state.gems;
      this.selectedSeedId = state.selectedSeed;
      this.selectedTool = state.selectedTool ?? FarmTool.HOE;
      this.buildSystem.loadBuildings(saved.buildings);
      this.livestockSystem.loadPens(saved.livestock ?? []);
      console.info('[FarmScene] Loaded save', {
        coins: state.coins,
        crops: Object.keys(saved.crops ?? {}).length,
        gridLoaded,
      });
      this.scheduleSave();
    } else {
      this.bootstrapNewGame();
    }
  }

  /** First launch with no save — starter economy only; returning players use applySave. */
  private bootstrapNewGame(): void {
    this.economy.setCoins(DEFAULT_COINS);
    this.gems = DEFAULT_GEMS;
    this.energySystem.setEnergy(DEFAULT_ENERGY, Date.now());
    const starter = SaveSystem.createDefault();
    this.inventory.loadWarehouse({
      warehouse: starter.warehouse,
      seeds: starter.seeds,
      level: starter.warehouseLevel,
    });
    this.inventory.addDefaultIfMissing();
    console.info('[FarmScene] New game — starter resources', {
      coins: DEFAULT_COINS,
      gems: DEFAULT_GEMS,
      energy: DEFAULT_ENERGY,
    });
    this.livestockSystem.loadPens([]);
    this.scheduleSave();
  }

  private setupPersistenceHooks(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushSave();
    });
  }

  private teardownPersistenceHooks(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  setSelectedTool(tool: FarmTool): void {
    this.selectedTool = tool;
    this.toolBar?.setSelected(tool);
    if (this.farmMode === 'plant') {
      this.setFarmMode('normal');
    }
    this.scheduleSave();
  }

  getSelectedTool(): FarmTool {
    return this.selectedTool;
  }

  private emitGameRefs(): void {
    this.events.emit('register-game', {
      inventory: this.inventory,
      economy: this.economy,
      energy: this.energySystem,
      getHud: () => ({
        coins: this.economy.getCoins(),
        gems: this.gems,
        energy: this.energySystem.getEnergy(),
      }),
      getSelectedSeed: () => this.selectedSeedId,
      setSelectedSeed: (id: string) => {
        this.selectedSeedId = id;
        this.setSelectedTool(FarmTool.SEED);
        this.scheduleSave();
      },
      canPurchaseLivestock: (animalType: AnimalType) =>
        this.validateShopLivestockPurchase(animalType),
    });
  }

  /** Shop Animals tab: pen/pond must exist and be empty before payment. */
  validateShopLivestockPurchase(animalType: AnimalType): { ok: boolean; message: string } {
    const def = getLivestockDef(animalType);
    if (def.houseOnly) {
      return { ok: false, message: `Chưa có art thú ${def.labelVi}` };
    }
    if (!this.livestockSystem.findPenForStocking(animalType)) {
      const place = animalType === 'fish' ? 'hồ cá' : `chuồng ${def.labelVi}`;
      return {
        ok: false,
        message: `Cần đặt ${place} trước (Build → Chăn nuôi)`,
      };
    }
    return { ok: true, message: '' };
  }

  /** Logical viewport for layout — synced with main camera (matches HUD + debug dots). */
  private getLayoutViewportSize(): { width: number; height: number } {
    this.syncMainCameraViewport();
    const cam = this.cameras.main;
    const w = cam.width > 0 ? cam.width : this.scale.width;
    const h = cam.height > 0 ? cam.height : this.scale.height;
    return { width: w > 0 ? w : 1, height: h > 0 ? h : 1 };
  }

  /** Keep main camera in sync with scale after hi-DPI resize (avoids stale cam.width). */
  private syncMainCameraViewport(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    if (w > 0 && h > 0) {
      this.cameras.main.setSize(w, h);
    }
  }

  /** Screen-fixed background (cover-fills viewport; iso map diamond leaves corners otherwise). */
  private setupBackground(): void {
    this.backgroundImage = this.add
      .image(0, 0, 'ui_background')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(-10000);
  }

  /** Cover-fit background to the full logical viewport (resize + orientation). */
  private layoutBackground(): void {
    const bg = this.backgroundImage;
    if (!bg) return;

    this.syncMainCameraViewport();
    const cam = this.cameras.main;
    const viewW = cam.width > 0 ? cam.width : this.getLayoutViewportSize().width;
    const viewH = cam.height > 0 ? cam.height : this.getLayoutViewportSize().height;
    applyViewportCoverBackground(bg, viewW, viewH);
    bg.setPosition(viewW / 2, viewH / 2);
  }

  /**
   * World-space island art under the 8×8 farm soil patch (scrolls with camera).
   * Uniform cover-fit to soil screen AABB — see farmIslandLayout.ts.
   */
  private setupFarmIsland(): void {
    this.farmIslandImage = this.add
      .image(0, 0, 'farm_island')
      .setDepth(computeFarmIslandWorldDepth());
  }

  /** Cover-fit island.png to farm soil bounds; scaled by FARM_ISLAND_SCALE_BOOST. */
  private layoutFarmIsland(): void {
    const image = this.farmIslandImage;
    if (!image) return;

    const frame = image.frame;
    const texW = frame.cutWidth || frame.width;
    const texH = frame.cutHeight || frame.height;
    image.setDepth(computeFarmIslandWorldDepth());
    layoutFarmIslandImage(image, this.grid.getFarmSoilScreenRhombus(), texW, texH, {
      scaleBoost: FARM_ISLAND_SCALE_BOOST,
    });
  }

  private renderMap(): void {
    for (const s of this.tileSprites) s.destroy();
    this.tileSprites = [];
    for (const d of this.decorations) d.sprite.destroy();
    this.decorations = [];

    for (let y = 0; y < this.grid.size; y++) {
      for (let x = 0; x < this.grid.size; x++) {
        const pos = this.grid.gridToMapScreen(x, y);
        const tile = this.add.image(pos.x, pos.y, 'grass');
        this.tileSprites.push(tile);
        this.applyGroundTileAt(x, y, tile);
      }
    }

    this.syncFarmDebugOverlays();
    this.decorations = renderMapDecorations(this, this.grid);
    this.ensureNorthApexGroundDrawnOnTop();
  }

  /** Re-stack north path/soil ground sprites above island.png after layout changes. */
  private ensureNorthApexGroundDrawnOnTop(): void {
    const island = this.farmIslandImage;
    if (island) {
      island.setDepth(computeFarmIslandWorldDepth());
      this.children.sendToBack(island);
    }
    const size = this.grid.size;
    for (let gy = 0; gy < size; gy++) {
      for (let gx = 0; gx < size; gx++) {
        if (!isFarmNorthEdgeCell(gx, gy)) continue;
        const spr = this.tileSprites[gy * size + gx];
        if (!spr?.visible) continue;
        spr.setDepth(this.grid.getDepth(gx, gy, 'ground'));
        this.children.bringToTop(spr);
      }
    }
  }

  private syncFarmDebugOverlays(): void {
    this.renderTileDebugOutlines();
    this.renderPlayableViewportDebug();
    this.syncFarmCenterDebugMarkers();
  }

  private syncFarmCenterDebugMarkers(): void {
    this.farmCenterDebugMarkers?.destroy();
    this.farmCenterDebugMarkers = undefined;
    if (!isFarmCenterDebugMarkers()) return;

    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    this.farmCenterDebugMarkers = buildFarmCenterDebugMarkers(this, viewW, viewH);
    this.refreshFarmCenterDebugMarkers();
  }

  private refreshFarmCenterDebugMarkers(): void {
    const overlay = this.farmCenterDebugMarkers;
    if (!overlay || !this.grid) return;

    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const mapCenterWorld = this.grid.gridToMapTileCenter(
      FARM_PLAYER_SPAWN_GX,
      FARM_PLAYER_SPAWN_GY
    );
    const mapCenterScreenTarget = getFarmMapCenterScreenTargetAtScrollZero(
      viewW,
      viewH,
      cam.zoom
    );
    const mapCenterWorldOffset = getFarmMapCenterWorldOffsets(viewW, viewH, cam.zoom);
    overlay.refresh(
      {
        mapCenterWorld,
        mapCenterScreenTarget,
        mapCenterWorldOffset,
        mapCenterZoom: cam.zoom,
        scrollOriginWorld: { x: cam.scrollX, y: cam.scrollY },
        viewportCenterWorld: farmViewportCenterWorldAtScroll(
          viewW,
          viewH,
          cam.zoom,
          cam.scrollX,
          cam.scrollY,
          mapCenterScreenTarget
        ),
      },
      cam
    );
  }

  /** World-space iso outlines on every logical map cell (grass, water, farm). */
  private renderTileDebugOutlines(): void {
    this.tileDebugGraphics?.destroy();
    this.tileDebugGraphics = undefined;
    if (!isFarmGridDebug()) return;

    const g = this.add.graphics();
    const maxGx = this.grid.size - 1;
    const maxGy = this.grid.size - 1;
    g.setDepth(this.grid.getDepth(maxGx, maxGy, 'entities') - 1);
    g.setScrollFactor(1);
    for (let y = 0; y < this.grid.size; y++) {
      for (let x = 0; x < this.grid.size; x++) {
        if (this.livestockSystem.getPenAt(x, y)) continue;
        const pos = this.grid.gridToMapScreen(x, y);
        const onFarm = this.grid.isFarmIslandFootprintCell(x, y);
        drawIsoTileDebug(g, pos.x, pos.y, onFarm ? 0x00ff88 : 0x4488ff, onFarm ? 0.85 : 0.35);
      }
    }
    this.tileDebugGraphics = g;
  }

  /** World-space farm pan bounds grid + screen-fixed viewport HUD outlines. */
  private renderPlayableViewportDebug(): void {
    this.farmWorldDebugContainer?.destroy();
    this.farmWorldDebugContainer = undefined;
    this.farmViewportHudDebugContainer?.destroy();
    this.farmViewportHudDebugContainer = undefined;
    if (!isFarmGridDebug()) return;

    const mapBounds = this.grid.getMapScreenBounds();
    const footprintBounds = this.grid.getFarmFootprintScreenBounds();
    const worldOverlay = buildFarmWorldDebugGridOverlay(this, {
      map: screenBoundsToFootprint(mapBounds),
      panBounds: this.getFarmCameraScrollBounds(),
      footprint: screenBoundsToFootprint(footprintBounds),
      tileCount: this.grid.size * this.grid.size,
      gridSize: this.grid.size,
    });
    worldOverlay.setScrollFactor(1);
    worldOverlay.setDepth(9997);
    this.farmWorldDebugContainer = worldOverlay;

    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const cam = this.cameras.main;
    const hudOverlay = buildFarmViewportHudDebugOverlay(
      this,
      viewW,
      viewH,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y,
      {
        map: screenBoundsToFootprint(mapBounds),
        panBounds: this.getFarmCameraScrollBounds(),
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
      }
    );
    hudOverlay.setScrollFactor(0);
    hudOverlay.setDepth(9998);
    this.farmViewportHudDebugContainer = hudOverlay;
  }

  private refreshFarmDebugHudVoidHint(): void {
    const hud = this.farmViewportHudDebugContainer;
    if (!hud) return;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const cam = this.cameras.main;
    refreshFarmViewportHudVoidHint(hud, viewW, viewH, {
      map: screenBoundsToFootprint(this.grid.getMapScreenBounds()),
      panBounds: this.getFarmCameraScrollBounds(),
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
      zoom: cam.zoom,
    });
  }

  private showClickPickDebug(gx: number, gy: number): void {
    if (!isDebugMode()) return;
    if (!this.grid.inBounds(gx, gy)) return;
    this.clearClickPickDebug();
    this.clickPickGx = gx;
    this.clickPickGy = gy;

    const top = this.grid.gridToMapScreen(gx, gy);
    const g = this.add.graphics();
    g.setDepth(10000);
    drawIsoTileClickPick(g, top.x, top.y);
    this.clickPickGraphics = g;

    const center = tileCenterFromTop(top);
    this.clickPickLabel = this.add
      .text(center.x, center.y, `${gx},${gy}`, {
        fontSize: '11px',
        color: '#ffcccc',
        backgroundColor: '#330000cc',
        padding: { x: 4, y: 2 },
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10001);
  }

  private clearClickPickDebug(): void {
    this.clickPickGraphics?.destroy();
    this.clickPickGraphics = undefined;
    this.clickPickLabel?.destroy();
    this.clickPickLabel = undefined;
  }

  private refreshClickPickDebug(): void {
    if (this.clickPickGx < 0 || this.clickPickGy < 0) return;
    this.showClickPickDebug(this.clickPickGx, this.clickPickGy);
  }

  private setupCameraDebugOverlay(): void {
    this.cameraDebugLabel?.destroy();
    this.cameraDebugLabel = undefined;
    if (!isFarmCameraDebug()) return;

    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    this.cameraDebugLabel = this.add
      .text(viewW / 2, viewH / 2, '', {
        fontSize: '11px',
        color: '#aaffcc',
        backgroundColor: '#001a0dcc',
        padding: { x: 6, y: 4 },
        fontFamily: 'monospace',
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(10002);
    this.refreshCameraDebugOverlay();
    this.refreshFarmCenterDebugMarkers();
  }

  private refreshCameraDebugOverlay(): void {
    const label = this.cameraDebugLabel;
    if (!label) return;

    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const spawn = this.grid.gridToMapTileCenter(FARM_PLAYER_SPAWN_GX, FARM_PLAYER_SPAWN_GY);
    const worldTarget = getFarmMapCenterWorldTargetAtDefaultScroll(
      viewW,
      viewH,
      cam.zoom
    );
    const spawnWorldErrorX = spawn.x - worldTarget.x;
    const spawnWorldErrorY = spawn.y - worldTarget.y;
    label.setPosition(viewW / 2, viewH / 2);
    label.setText(
      [
        `zoom ${cam.zoom.toFixed(3)} (${FARM_CAMERA_MIN_ZOOM}–${FARM_CAMERA_MAX_ZOOM}) target ${this.cameraTargetZoom.toFixed(3)}`,
        `scroll ${cam.scrollX.toFixed(1)}, ${cam.scrollY.toFixed(1)}`,
        `view ${viewW}×${viewH}  userPan ${this.cameraScrollTouchedByUser ? 'yes' : 'no'}`,
        `spawn(10,10) world ${spawn.x.toFixed(1)}, ${spawn.y.toFixed(1)}`,
        `spawn target ${worldTarget.x.toFixed(1)}, ${worldTarget.y.toFixed(1)}`,
        `spawnWorldError ${spawnWorldErrorX.toFixed(2)}, ${spawnWorldErrorY.toFixed(2)}`,
      ].join('\n')
    );
  }

  private applyGroundTileAt(gx: number, gy: number, spr: Phaser.GameObjects.Image): void {
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return;
    if (this.farming.hidesGroundUnderCrop(gx, gy)) {
      spr.setVisible(false);
      return;
    }
    if (this.grid.hidesGroundForFarmIsland(gx, gy)) {
      spr.setVisible(false);
      return;
    }
    spr.setVisible(true);
    const textureKey = this.grid.getGroundTextureKey(gx, gy, {
      farmPlotGround: this.farming.showsFarmPlotGround(gx, gy),
      dug: this.farming.showsSoilMoistureGround(gx, gy),
      soilWaterLevel: this.farming.getGroundSoilWaterLevel(gx, gy),
    });
    spr.setTexture(textureKey);
    spr.clearTint();
    const top = this.grid.gridToMapScreen(gx, gy);
    let px = top.x;
    let py = top.y;
    if (cell.type === 'water') {
      const probe: WaterNeighborProbe = (nx, ny) => {
        if (!this.grid.inBounds(nx, ny)) return false;
        return this.grid.getCell(nx, ny)?.type === 'water';
      };
      const nudge = getWaterCornerDisplayOffset(gx, gy, probe);
      if (nudge) {
        px += nudge.dx;
        py += nudge.dy;
      }
      const textureNudge = getWaterTextureDisplayOffset(textureKey);
      if (textureNudge) {
        px += textureNudge.dx;
        py += textureNudge.dy;
      }
    }
    spr.setPosition(px, py);
    const underFarmIsland = this.grid.isFarmIslandFootprintCell(gx, gy);
    if (cell.type === 'water') {
      if (textureKey === WATER_TOP_BORDER_TEXTURE_KEY) {
        applyIsoTopBorderWaterSprite(spr);
      } else if (textureKey === WATER_BOTTOM_BORDER_TEXTURE_KEY) {
        applyIsoBottomBorderWaterSprite(spr);
      } else {
        const waterScale = getWaterGroundDisplayScale();
        applyIsoTileSprite(
          spr,
          underFarmIsland
            ? Math.max(waterScale, GROUND_TILE_SEAM_SCALE)
            : waterScale
        );
      }
    } else {
      applyIsoTileSprite(spr, this.farmFootprintGroundScale(gx, gy));
    }
    spr.setDepth(this.grid.getDepth(gx, gy, 'ground'));
  }

  /** Seam scale for farm soil + path ring; north apex row is enlarged to mask island cliff bleed. */
  private farmFootprintGroundScale(gx: number, gy: number): number {
    if (!this.grid.isFarmIslandFootprintCell(gx, gy)) {
      return GROUND_TILE_SEAM_SCALE;
    }
    if (isFarmNorthEdgeCell(gx, gy)) {
      return Math.max(GROUND_TILE_SEAM_SCALE, FARM_NORTH_EDGE_GROUND_SCALE);
    }
    return GROUND_TILE_SEAM_SCALE;
  }

  private refreshTileAt(gx: number, gy: number): void {
    const idx = gy * this.grid.size + gx;
    const spr = this.tileSprites[idx];
    if (!spr) return;
    this.applyGroundTileAt(gx, gy, spr);
  }

  /** Refresh purchased tile and orthogonal neighbors (locked decor / moisture edges). */
  private refreshPurchasedLandTiles(gx: number, gy: number): void {
    this.refreshTileAt(gx, gy);
    for (const [ax, ay] of [
      [gx + 1, gy],
      [gx - 1, gy],
      [gx, gy + 1],
      [gx, gy - 1],
    ]) {
      if (this.grid.inBounds(ax, ay)) this.refreshTileAt(ax, ay);
    }
  }

  /** Refresh unlocked/locked farm soil ground textures (moisture + decor). */
  private refreshFarmSoilGround(): void {
    for (const { x, y } of this.grid.getSoilTileCoords()) {
      this.refreshTileAt(x, y);
    }
  }

  private setupPlayer(): void {
    this.player = new Player(
      this,
      this.grid,
      FARM_PLAYER_SPAWN_GX,
      FARM_PLAYER_SPAWN_GY
    );
  }

  private setupCamera(): void {
    this.cameraScrollTouchedByUser = false;
    this.lastMapCenterWorldOffsetZoom = FARM_CAMERA_DEFAULT_ZOOM;
    const cam = this.cameras.main;
    cam.setZoom(FARM_CAMERA_DEFAULT_ZOOM);
    this.cameraTargetZoom = FARM_CAMERA_DEFAULT_ZOOM;
    this.resetCameraMotionState(cam.width / 2, cam.height / 2);
    // Initial centering runs on `ui-ready` once HUD playable bands are stable.
  }

  private resetCameraMotionState(anchorX: number, anchorY: number): void {
    this.cameraZoomAnchorX = anchorX;
    this.cameraZoomAnchorY = anchorY;
    this.cameraPanVelocityX = 0;
    this.cameraPanVelocityY = 0;
    this.cameraInertiaRemainingMs = 0;
    this.lastPanDeltaX = 0;
    this.lastPanDeltaY = 0;
  }

  private stopCameraInertia(): void {
    this.cameraPanVelocityX = 0;
    this.cameraPanVelocityY = 0;
    this.cameraInertiaRemainingMs = 0;
  }

  /** Zoom-interpolated pan clamp from {@link farmCameraConfig}. */
  private getMergedFarmCameraScrollLimits(zoom: number): FarmCameraScrollLimits {
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    return getConfiguredFarmCameraScrollLimits(viewW, viewH, zoom);
  }

  /**
   * Final layout pass: tile (10,10) world → zoom keyframe; clears {@link mapTopPanOffset}.
   * Does not change camera scroll (world-only); safe when {@link cameraScrollTouchedByUser}.
   */
  private enforceFarmMapCenterWorldAnchorAtZoom(zoom: number): FarmMapCenterWorldEnforceResult {
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const enforced = enforceFarmMapCenterWorldAnchor(
      this.grid,
      viewW,
      viewH,
      zoom,
      this.farmIslandImage ?? null
    );
    this.farmMapCenterWorldTargetX = enforced.target.x;
    this.farmMapCenterWorldTargetY = enforced.target.y;
    logFarmMapCenterWorldAnchorDeviation(enforced, zoom, viewW, viewH);
    return enforced;
  }

  /** Absolute last layout step: world anchor + island/sprites (never moves scroll). */
  private finalizeFarmWorldAnchorAtZoom(zoom: number): FarmMapCenterWorldEnforceResult {
    const enforced = this.enforceFarmMapCenterWorldAnchorAtZoom(zoom);
    this.lastMapCenterWorldOffsetZoom = zoom;
    this.layoutFarmIsland();
    this.syncMapLayerSpritesAfterCameraLayout();
    return enforced;
  }

  /**
   * Per-frame safety net: tile (10,10) world must match zoom keyframe; pan/scroll never move it.
   * Re-runs analytical hard lock only when drift or stale mapTopPanOffset is detected.
   */
  private ensureFarmSpawnTileWorldHardLock(): void {
    if (!this.grid) return;
    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const target = getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, cam.zoom);
    const spawn = this.grid.gridToMapTileCenter(
      FARM_PLAYER_SPAWN_GX,
      FARM_PLAYER_SPAWN_GY
    );
    const err = Math.hypot(spawn.x - target.x, spawn.y - target.y);
    const staleOffset =
      Math.abs(this.grid.mapTopPanOffsetX) > 1e-9 ||
      Math.abs(this.grid.mapTopPanOffsetY) > 1e-9;
    const zoomStale = Math.abs(this.lastMapCenterWorldOffsetZoom - cam.zoom) > 1e-6;
    if (
      err > FARM_SPAWN_WORLD_ANCHOR_TOLERANCE_PX ||
      staleOffset ||
      zoomStale
    ) {
      this.finalizeFarmWorldAnchorAtZoom(cam.zoom);
    }
  }

  /**
   * Shift farm world so playable map center tracks zoom-keyframe world offsets (baseline = 1.9 bake).
   */
  private syncMapCenterWorldOffsetToZoom(fromZoom: number, toZoom: number): void {
    if (!this.grid) return;
    if (Math.abs(fromZoom - toZoom) < 1e-6) return;
    this.finalizeFarmWorldAnchorAtZoom(toZoom);
    if (!this.cameraScrollTouchedByUser) {
      this.applyFarmDefaultCameraScrollAtZoom(toZoom);
    }
    if (this.farmCenterDebugMarkers) {
      this.refreshFarmCenterDebugMarkers();
    }
  }

  /**
   * Default scroll from viewport keyframes (after world anchor); only when the user has not panned.
   */
  private applyFarmDefaultCameraScrollAtZoom(zoom: number): void {
    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const scroll = getFarmDefaultScrollAtZoom(viewW, viewH, zoom);
    const limits = getConfiguredFarmCameraScrollLimits(viewW, viewH, zoom);
    const clamped = clampScrollToFarmPlayable(scroll.scrollX, scroll.scrollY, limits);
    cam.scrollX = clamped.scrollX;
    cam.scrollY = clamped.scrollY;
  }

  /**
   * First-load / refocus scroll: viewport keyframes at default zoom (world anchor applied separately).
   * Does not re-run {@link GridSystem.centerInViewport} (safe during zoom animation).
   */
  private applyFarmMapCenterScrollAtZoom(zoom: number): void {
    this.applyFarmDefaultCameraScrollAtZoom(zoom);
  }

  private updateFarmCameraMotion(delta: number): void {
    if (this.pointerGestureActive || this.isDragging) {
      return;
    }

    const cam = this.cameras.main;

    if (Math.abs(cam.zoom - this.cameraTargetZoom) > 0.0005) {
      const previousZoom = cam.zoom;
      if (!this.cameraScrollTouchedByUser) {
        const { width: viewW, height: viewH } = this.getLayoutViewportSize();
        const step = stepSmoothZoomAtMapCenter(
          this.grid.getFarmPlayableMapCenterScreen(),
          viewW,
          viewH,
          cam.scrollX,
          cam.scrollY,
          previousZoom,
          this.cameraTargetZoom
        );
        this.syncMapCenterWorldOffsetToZoom(this.lastMapCenterWorldOffsetZoom, step.zoom);
        cam.setZoom(step.zoom);
        this.applyFarmDefaultCameraScrollAtZoom(step.zoom);
        this.clampMainCameraScrollToPlayable();
      } else {
        const anchorBefore = this.getFarmCameraCenterAnchor();
        const keepScreenX = (anchorBefore.x - cam.scrollX) * previousZoom;
        const keepScreenY = (anchorBefore.y - cam.scrollY) * previousZoom;
        const step = stepSmoothZoomAtAnchor(
          cam.scrollX,
          cam.scrollY,
          cam.zoom,
          this.cameraTargetZoom,
          this.cameraZoomAnchorX,
          this.cameraZoomAnchorY
        );
        this.syncMapCenterWorldOffsetToZoom(this.lastMapCenterWorldOffsetZoom, step.zoom);
        const anchorAfter = this.getFarmCameraCenterAnchor();
        cam.setZoom(step.zoom);
        cam.scrollX = anchorAfter.x - keepScreenX / step.zoom;
        cam.scrollY = anchorAfter.y - keepScreenY / step.zoom;
        this.clampMainCameraScrollToPlayable();
        if (step.settled) {
          this.adjustScrollAfterZoom(previousZoom);
        }
      }
    }

    if (
      this.cameraInertiaRemainingMs > 0 &&
      !panInertiaIsSettled(this.cameraPanVelocityX, this.cameraPanVelocityY)
    ) {
      this.cameraInertiaRemainingMs = Math.max(0, this.cameraInertiaRemainingMs - delta);
      cam.scrollX -= this.cameraPanVelocityX / cam.zoom;
      cam.scrollY -= this.cameraPanVelocityY / cam.zoom;
      this.clampMainCameraScrollToPlayable();
      const decayed = decayPanVelocity(this.cameraPanVelocityX, this.cameraPanVelocityY);
      this.cameraPanVelocityX = decayed.velocityX;
      this.cameraPanVelocityY = decayed.velocityY;
    } else if (this.cameraInertiaRemainingMs <= 0) {
      this.stopCameraInertia();
    }
  }

  /** Stub hook for double-tap-to-focus (phase 3 cinematic); no-op for now. */
  private tryDoubleTapCameraFocus(_pointer: Phaser.Input.Pointer): void {
    // TODO: refocus on farm soil when double-tap detected within time/distance threshold.
  }

  /**
   * Re-layout grid + camera after HUD/safe-area/viewport are stable (first load, ui-ready, resize).
   */
  private focusCameraOnFarmSoil(options?: { recenterCamera?: boolean }): void {
    if (this.pointerGestureActive || this.isDragging) {
      return;
    }
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const w = Math.round(viewW);
    const h = Math.round(viewH);
    if (w <= 1 || h <= 1) return;
    const cam = this.cameras.main;
    const preserveView =
      this.cameraScrollTouchedByUser && options?.recenterCamera !== true;
    if (
      preserveView &&
      w === this.lastCameraLayoutW &&
      h === this.lastCameraLayoutH
    ) {
      this.syncMainCameraViewport();
      this.clampMainCameraScrollToPlayable();
      return;
    }
    this.lastCameraLayoutW = w;
    this.lastCameraLayoutH = h;
    const anchorBefore = preserveView ? this.getFarmCameraCenterAnchor() : null;
    const patchScreenBefore = preserveView
      ? {
          x: (anchorBefore!.x - cam.scrollX) * cam.zoom,
          y: (anchorBefore!.y - cam.scrollY) * cam.zoom,
        }
      : null;

    this.syncMainCameraViewport();
    if (!preserveView) {
      this.grid.centerInViewport(w, h, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
      this.repositionWorld();
    } else {
      this.finalizeFarmWorldAnchorAtZoom(cam.zoom);
    }

    if (preserveView && patchScreenBefore) {
      const anchorAfter = this.getFarmCameraCenterAnchor();
      cam.scrollX = anchorAfter.x - patchScreenBefore.x / cam.zoom;
      cam.scrollY = anchorAfter.y - patchScreenBefore.y / cam.zoom;
      this.clampMainCameraScrollToPlayable();
    } else {
      this.centerCameraOnMap();
    }
    this.layoutBackground();
  }

  /** World anchor for camera centering: playable map center (farmer spawn / visual center). */
  private getFarmCameraCenterAnchor(): { x: number; y: number } {
    return this.grid.getFarmPlayableMapCenterScreen();
  }

  /**
   * Pan-bounds center + map-top passes at a given zoom (load, refocus, after user zoom).
   * When the user has panned: scroll-only — hard-lock tile (10,10) world, skip map-top passes.
   */
  private applyCenteredFarmCameraScroll(zoom: number): void {
    if (this.cameraScrollTouchedByUser) {
      this.finalizeFarmWorldAnchorAtZoom(zoom);
      return;
    }
    const farm = this.getFarmCameraScrollBounds();
    const anchor = this.getFarmCameraCenterAnchor();
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const viewport = computePlayableFarmViewportLayout(
      viewW,
      viewH,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y
    );
    const { playableLeft, playableTop, playableRight, playableBottom } = viewport;
    const geomPlayable = {
      playableLeft,
      playableTop,
      playableRight,
      playableBottom,
    };
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(
      geomPlayable,
      viewW,
      viewH
    );
    const targetCenter = getFarmPanBoundsScrollTargetScreen(viewW, viewH, geomPlayable);

    let scroll = computeCenteredFarmCameraScroll(
      anchor,
      targetCenter,
      farm,
      scrollPlayable,
      zoom
    );
    const mapTopHooks = {
      alignMapTop: (panBounds: FarmFootprintBounds, scrollY: number, z: number) =>
        this.grid.alignMapTopToPanBoundsInset(panBounds, scrollY, z),
      getPanBounds: () => this.getFarmCameraScrollBounds(),
      getMapBounds: () => this.grid.getMapScreenBounds(),
      getCenterAnchor: () => this.getFarmCameraCenterAnchor(),
      repositionWorld: () => this.repositionFarmMapLayerOnly(),
      scrollPlayable,
      panTargetCenter: targetCenter,
      zoom,
    };
    scroll = runMapTopPanBoundsCameraPasses(mapTopHooks, scroll);
    const synced = syncFarmMapTopCameraScroll(
      this.grid,
      () => this.getFarmCameraScrollBounds(),
      scroll.scrollY,
      zoom,
      FARM_MAP_TOP_PAN_BOUNDS_FRAC,
      scrollPlayable
    );
    const finalized = mergeFarmCameraScrollWithOversizeCenter(
      { scrollX: scroll.scrollX, scrollY: synced.scrollY },
      this.getFarmCameraScrollBounds(),
      scrollPlayable,
      targetCenter,
      zoom
    );
    this.setMainCameraScrollFromLayout(finalized.scrollX, finalized.scrollY, scrollPlayable, zoom);
    this.finalizeFarmWorldAnchorAtZoom(zoom);
  }

  /** Apply layout scroll: oversize midpoint snap, then ensure soil stays on screen. */
  private setMainCameraScrollFromLayout(
    scrollX: number,
    scrollY: number,
    scrollPlayable: PlayableBandRect,
    zoom: number
  ): void {
    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const snap = snapFarmOversizeScrollToLimitsMidpoint(
      { scrollX, scrollY },
      this.getFarmCameraScrollBounds(),
      scrollPlayable,
      zoom
    );
    const footprint = this.grid.getFarmFootprintScreenBounds();
    const soilFootprint: FarmFootprintBounds = {
      minX: footprint.minX,
      minY: footprint.minY,
      maxX: footprint.maxX,
      maxY: footprint.maxY,
    };
    const limits = this.getMergedFarmCameraScrollLimits(zoom);
    const visible = clampScrollSoFootprintOverlapsViewport(
      soilFootprint,
      limits,
      viewW,
      viewH,
      zoom,
      snap,
      scrollPlayable
    );
    if (!this.cameraScrollTouchedByUser) {
      this.applyFarmMapCenterScrollAtZoom(zoom);
    } else {
      cam.scrollX = visible.scrollX;
      cam.scrollY = visible.scrollY;
    }
  }

  /**
   * First load / refocus: viewport default scroll + zoom; bake playable map center to keyframe world.
   */
  private applyDefaultFarmCameraPosition(zoom: number): void {
    if (this.cameraScrollTouchedByUser) return;
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    this.cameraTargetZoom = zoom;
    this.syncMainCameraViewport();
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    this.grid.centerInViewport(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
    this.finalizeFarmWorldAnchorAtZoom(zoom);
    this.applyFarmMapCenterScrollAtZoom(zoom);
    this.clampMainCameraScrollToPlayable();
  }

  /** Re-apply default scroll/zoom after layout when the user has not panned. */
  private snapMainCameraOversizeScrollToMidpoint(): void {
    this.applyDefaultFarmCameraPosition(this.cameras.main.zoom);
  }

  /**
   * After zoom changes: center on pan target when the user has not panned yet; otherwise keep the
   * soil anchor fixed on screen so wheel/pinch zoom does not undo horizontal pan.
   */
  private adjustScrollAfterZoom(
    previousZoom: number,
    options?: { forceRecenter?: boolean }
  ): void {
    if (this.pointerGestureActive || this.isDragging) {
      return;
    }
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const viewport = computePlayableFarmViewportLayout(
      viewW,
      viewH,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y
    );
    const scrollPlayable = shiftPlayableBandForPanBoundsCenter(
      {
        playableLeft: viewport.playableLeft,
        playableTop: viewport.playableTop,
        playableRight: viewport.playableRight,
        playableBottom: viewport.playableBottom,
      },
      viewW,
      viewH
    );
    const limits = this.getMergedFarmCameraScrollLimits(zoom);
    let scrollX = cam.scrollX;
    let scrollY = cam.scrollY;
    const anchorBefore = this.getFarmCameraCenterAnchor();
    const keepScreenX = (anchorBefore.x - cam.scrollX) * previousZoom;
    const keepScreenY = (anchorBefore.y - cam.scrollY) * previousZoom;
    this.syncMapCenterWorldOffsetToZoom(this.lastMapCenterWorldOffsetZoom, zoom);
    if (!this.cameraScrollTouchedByUser || options?.forceRecenter) {
      const defaultScroll = getFarmDefaultScrollAtZoom(viewW, viewH, zoom);
      scrollX = defaultScroll.scrollX;
      scrollY = defaultScroll.scrollY;
    } else {
      const anchorAfter = this.getFarmCameraCenterAnchor();
      scrollX = anchorAfter.x - keepScreenX / zoom;
      scrollY = anchorAfter.y - keepScreenY / zoom;
    }
    let scroll = clampScrollToFarmPlayable(scrollX, scrollY, limits);
    const footprint = this.grid.getFarmFootprintScreenBounds();
    const soilFootprint: FarmFootprintBounds = {
      minX: footprint.minX,
      minY: footprint.minY,
      maxX: footprint.maxX,
      maxY: footprint.maxY,
    };
    scroll = clampScrollSoFootprintOverlapsViewport(
      soilFootprint,
      limits,
      viewW,
      viewH,
      zoom,
      scroll,
      scrollPlayable
    );
    if (!this.cameraScrollTouchedByUser || options?.forceRecenter) {
      this.setMainCameraScrollFromLayout(
        scroll.scrollX,
        scroll.scrollY,
        scrollPlayable,
        zoom
      );
    } else {
      cam.scrollX = scroll.scrollX;
      cam.scrollY = scroll.scrollY;
    }
    this.cameraTargetZoom = zoom;
  }

  /** Center farm at default zoom/scroll in the playable HUD band. */
  private centerCameraOnMap(): void {
    const cam = this.cameras.main;
    cam.removeBounds();

    const zoom = FARM_CAMERA_DEFAULT_ZOOM;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    this.resetCameraMotionState(viewW / 2, viewH / 2);
    if (!this.cameraScrollTouchedByUser) {
      this.applyDefaultFarmCameraPosition(zoom);
    } else {
      cam.setZoom(zoom);
      this.cameraTargetZoom = zoom;
      this.applyCenteredFarmCameraScroll(zoom);
    }
  }

  private getMainCameraPlayableBand(viewW: number, viewH: number): PlayableBandRect {
    const { playableLeft, playableTop, playableRight, playableBottom } =
      computePlayableFarmViewportLayout(viewW, viewH, FARM_FIT_PAD_X, FARM_FIT_PAD_Y);
    return shiftPlayableBandForPanBoundsCenter(
      {
        playableLeft,
        playableTop,
        playableRight,
        playableBottom,
      },
      viewW,
      viewH
    );
  }

  /** Keep farm footprint inside HUD playable band after layout, pan, or zoom. */
  private clampMainCameraScroll(
    _farm: { minX: number; minY: number; maxX: number; maxY: number },
    playable: PlayableBandRect & { zoom: number }
  ): void {
    const cam = this.cameras.main;
    const limits = this.getMergedFarmCameraScrollLimits(playable.zoom);
    const next = clampScrollToFarmPlayable(cam.scrollX, cam.scrollY, limits);
    cam.scrollX = next.scrollX;
    cam.scrollY = next.scrollY;
  }

  private clampMainCameraScrollToPlayable(): void {
    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const scrollPlayable = this.getMainCameraPlayableBand(viewW, viewH);
    this.clampMainCameraScroll(this.getFarmCameraScrollBounds(), {
      ...scrollPlayable,
      zoom: cam.zoom,
    });
    if (!this.cameraScrollTouchedByUser) {
      this.setMainCameraScrollFromLayout(
        cam.scrollX,
        cam.scrollY,
        scrollPlayable,
        cam.zoom
      );
    }
  }

  /**
   * Pan clamp target: island.png screen AABB (falls back to soil footprint before island loads).
   * Tile-only footprint is much smaller than the island art, which caused overly tight pan limits.
   */
  /**
   * Pan clamp: inset island AABB when the image is loaded (trim empty PNG alpha);
   * fallback to soil+path footprint before island layout.
   */
  private getFarmCameraScrollBounds(): FarmFootprintBounds {
    const fp = this.grid.getFarmFootprintScreenBounds();
    const footprint: FarmFootprintBounds = {
      minX: fp.minX,
      minY: fp.minY,
      maxX: fp.maxX,
      maxY: fp.maxY,
    };
    if (!this.farmIslandImage) {
      return resolveFarmPanClampBounds(footprint, null);
    }
    const frame = this.farmIslandImage.frame;
    const texW = frame.cutWidth || frame.width;
    const texH = frame.cutHeight || frame.height;
    const island = computeFarmIslandScreenBounds(
      this.grid.getFarmSoilScreenRhombus(),
      texW,
      texH,
      { scaleBoost: FARM_ISLAND_SCALE_BOOST }
    );
    return resolveFarmPanClampBounds(footprint, island);
  }

  private setupToolBar(): void {
    const { width, height } = this.scale;
    this.toolBar = new ToolBar(this, width, height);
    this.toolBar.setSelected(this.selectedTool);
    this.toolBar.setOnChange((tool) => this.setSelectedTool(tool));
  }

  private scheduleResizeCameraLayout(): void {
    if (this.resizeLayoutTimer !== undefined) {
      clearTimeout(this.resizeLayoutTimer);
    }
    this.resizeLayoutTimer = setTimeout(() => {
      this.resizeLayoutTimer = undefined;
      if (this.pointerGestureActive || this.isDragging) {
        this.scheduleResizeCameraLayout();
        return;
      }
      this.focusCameraOnFarmSoil();
      this.snapMainCameraOversizeScrollToMidpoint();
    }, 100);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.toolBar?.resize(gameSize.width, gameSize.height);
    this.landUnlockConfirm?.resize();
    this.syncMainCameraViewport();
    this.layoutBackground();
    this.syncFarmDebugOverlays();
    this.scheduleResizeCameraLayout();
  }

  /** Island + tile sprites only (preserves {@link mapTopPanOffset} during map-top camera passes). */
  private repositionFarmMapLayerOnly(): void {
    this.layoutFarmIsland();
    this.syncMapLayerSpritesAfterCameraLayout();
  }

  private repositionWorld(): void {
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    this.finalizeFarmWorldAnchorAtZoom(zoom);
    if (!this.cameraScrollTouchedByUser) {
      this.applyFarmDefaultCameraScrollAtZoom(zoom);
    }
  }

  /** Reposition map-layer sprites after {@link mapTopPanOffset} changes (no camera re-layout). */
  private syncMapLayerSpritesAfterCameraLayout(): void {
    for (let i = 0; i < this.tileSprites.length; i++) {
      const gx = i % this.grid.size;
      const gy = Math.floor(i / this.grid.size);
      this.applyGroundTileAt(gx, gy, this.tileSprites[i]);
    }
    this.ensureNorthApexGroundDrawnOnTop();
    for (const d of this.decorations) {
      const foot = this.grid.gridToTileBottom(d.gridX, d.gridY);
      d.sprite.setPosition(foot.x, foot.y);
    }
    const spawn = this.player.getGridPosition();
    const center = this.grid.gridToPlayerTile(spawn.x, spawn.y);
    this.player.sprite.setPosition(center.x, center.y);
    this.player.sprite.setOrigin(0.5, 1);
    this.player.sprite.setDepth(
      this.grid.getDepth(Math.round(spawn.x), Math.round(spawn.y), 'entities')
    );
    syncCropSprites(this, this.grid, this.farming, this.cropSprites);
    renderBuildings(this, this.grid, this.buildSystem.getBuildings(), this.buildingSprites);
    renderLivestockPens(
      this,
      this.grid,
      this.livestockSystem.getPens(),
      this.livestockPenSprites
    );
    this.syncFarmDebugOverlays();
    this.refreshClickPickDebug();
    this.refreshCameraDebugOverlay();
    this.refreshFarmCenterDebugMarkers();
    this.expandDimOverlay?.refresh();
  }

  private getUIScene(): UIScene | undefined {
    return this.scene.get('UIScene') as UIScene | undefined;
  }

  private beginPointerGesture(pointer: Phaser.Input.Pointer): void {
    this.pointerGestureActive = true;
    this.pointerGestureDragged = false;
    this.pointerGestureCancelled = false;
    this.pointerGestureStartX = pointer.x;
    this.pointerGestureStartY = pointer.y;
    this.pointerPanLastX = pointer.x;
    this.pointerPanLastY = pointer.y;
    this.isDragging = false;
  }

  private cancelPointerGesture(): void {
    this.pointerGestureActive = false;
    this.pointerGestureDragged = false;
    this.pointerGestureCancelled = true;
    this.isDragging = false;
  }

  private endPointerGesture(): void {
    this.pointerGestureActive = false;
    this.isDragging = false;
  }

  private updatePointerDragState(pointer: Phaser.Input.Pointer): void {
    if (!this.pointerGestureActive || this.pointerGestureCancelled) return;
    if (
      !this.pointerGestureDragged &&
      exceedsDragThreshold(
        this.pointerGestureStartX,
        this.pointerGestureStartY,
        pointer.x,
        pointer.y
      )
    ) {
      this.pointerGestureDragged = true;
      this.isDragging = true;
      this.pointerPanLastX = pointer.x;
      this.pointerPanLastY = pointer.y;
    }
  }

  private panCameraWithPointer(pointer: Phaser.Input.Pointer): void {
    this.cameraScrollTouchedByUser = true;
    this.stopCameraInertia();
    const cam = this.cameras.main;
    const dx = pointer.x - this.pointerPanLastX;
    const dy = pointer.y - this.pointerPanLastY;
    this.pointerPanLastX = pointer.x;
    this.pointerPanLastY = pointer.y;
    if (dx === 0 && dy === 0) {
      return;
    }
    this.lastPanDeltaX = dx;
    this.lastPanDeltaY = dy;
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    this.clampMainCameraScrollToPlayable();
    this.ensureFarmSpawnTileWorldHardLock();
  }

  /**
   * Tile/building/walk handling on pointerup when movement stayed within drag threshold.
   * Deferred from pointerdown so panning works when press starts on farm soil.
   */
  private handlePointerTap(pointer: Phaser.Input.Pointer): void {
    const { x, y } = this.screenPointToGrid(pointer);
    if (isDebugMode()) {
      this.showClickPickDebug(x, y);
    }

    if (this.buildSystem.active && this.buildSystem.selectedItem) {
      if (this.buildPlacementConfirm?.hitsPointer(pointer)) {
        return;
      }
      this.handleBuildPreviewTap(x, y);
      return;
    }

    if (this.livestockSystem.active && this.livestockSystem.selectedItem) {
      if (this.buildPlacementConfirm?.hitsPointer(pointer)) {
        return;
      }
      this.handleLivestockPlacePreviewTap(x, y);
      return;
    }

    if (this.livestockSystem.upgradeMode) {
      const pen = this.livestockSystem.getPenAt(x, y);
      if (pen) this.handleLivestockPenUpgradeTap(pen);
      return;
    }

    if (this.objectEditSystem.active) {
      if (this.buildPlacementConfirm?.hitsPointer(pointer)) {
        return;
      }
      this.handleObjectMovePreviewTap(x, y);
      return;
    }

    if (this.farmMode === 'expand') {
      if (!this.landUnlockConfirm.isVisible()) {
        this.handleExpandLand(x, y);
      }
      return;
    }

    const cell = this.grid.getCell(x, y);

    if (this.farmMode === 'normal') {
      const pen = this.livestockSystem.getPenAt(x, y);
      if (pen) {
        this.dismissFarmPopups();
        const now = Date.now();
        this.livestockSystem.tick(now);
        const action = this.livestockSystem.getPenAction(pen, now);
        if (action.canCollect || action.canFeed || action.ticked.state === 'producing') {
          this.handleLivestockPenTap(pen);
          return;
        }
        this.showObjectEditPopup(x, y, true);
        return;
      }
    }

    if (this.farmMode === 'normal' && this.objectEditSystem.findEditableAt(x, y)) {
      this.dismissFarmPopups();
      this.showObjectEditPopup(x, y);
      return;
    }

    if (this.farmMode === 'normal' && cell && this.isLockedFarmSoil(x, y)) {
      return;
    }

    if (this.farmMode === 'normal' && cell && this.isFarmInteractableTile(x, y, cell)) {
      this.dismissFarmPopups();
      this.handleFarmTileTap(x, y, cell);
      return;
    }

    this.dismissFarmPopups();
    this.player.clearOnReach();
    this.pendingFarmTile = undefined;

    if (this.grid.isWalkable(x, y)) {
      this.player.moveTo(x, y, this.grid);
    }
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      if (this.toolBar?.hitsPointer(pointer)) {
        return;
      }

      const ui = this.getUIScene();
      if (ui?.hitsInteractiveHud(pointer)) {
        if (
        this.farmActionPopup.isVisible() ||
        this.cropSelectPopup.isVisible() ||
        this.objectEditPopup?.isVisible()
      ) {
          this.dismissFarmPopups();
        }
        return;
      }

      if (this.handleObjectEditPointer(pointer)) {
        return;
      }

      if (this.input.pointer1.isDown && this.input.pointer2?.isDown) {
        this.lastPinchDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y
        );
        this.cancelPointerGesture();
        return;
      }

      if (this.handleLandUnlockPointer(pointer)) {
        return;
      }

      if (this.handleBuildConfirmPointer(pointer)) {
        return;
      }

      if (this.handleFarmPopupPointer(pointer)) {
        return;
      }

      this.beginPointerGesture(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildSystem.active && !this.buildSystem.previewLocked) {
        const { x, y } = this.screenPointToGrid(pointer);
        this.buildSystem.updateGhost(x, y);
        this.updateGhostSprite();
      }

      if (this.objectEditSystem.active && !this.objectEditSystem.previewLocked) {
        const { x, y } = this.screenPointToGrid(pointer);
        this.objectEditSystem.updateGhost(x, y);
        this.updateGhostSprite();
      }

      if (this.pointerGestureActive && pointer.isDown) {
        this.updatePointerDragState(pointer);
      }

      if (this.isDragging && pointer.isDown) {
        this.panCameraWithPointer(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const wasDrag = this.pointerGestureDragged;
      const wasTap =
        this.pointerGestureActive &&
        !this.pointerGestureCancelled &&
        !this.pointerGestureDragged;
      this.endPointerGesture();
      if (wasDrag) {
        this.cameraPanVelocityX = this.lastPanDeltaX;
        this.cameraPanVelocityY = this.lastPanDeltaY;
        this.cameraInertiaRemainingMs = FARM_CAMERA_INERTIA_MS;
        this.clampMainCameraScrollToPlayable();
      }
      if (wasTap) {
        const now = this.time.now;
        const dt = now - this.lastCameraTapTime;
        const dist = Phaser.Math.Distance.Between(
          pointer.x,
          pointer.y,
          this.lastCameraTapX,
          this.lastCameraTapY
        );
        if (dt < 300 && dist < 24) {
          this.tryDoubleTapCameraFocus(pointer);
        }
        this.lastCameraTapTime = now;
        this.lastCameraTapX = pointer.x;
        this.lastCameraTapY = pointer.y;
        this.handlePointerTap(pointer);
      }
    });

    this.input.on('pointerupoutside', () => {
      this.endPointerGesture();
    });

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      this.stopCameraInertia();
      this.cameraZoomAnchorX = pointer.x;
      this.cameraZoomAnchorY = pointer.y;
      this.cameraTargetZoom = clampFarmCameraZoom(
        this.cameraTargetZoom - dy * FARM_CAMERA_WHEEL_ZOOM_SCALE
      );
    });

    this.input.addPointer(2);

    this.input.on('pointermove', () => {
      if (this.input.pointer1.isDown && this.input.pointer2?.isDown) {
        this.cancelPointerGesture();
        const dist = Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y
        );
        this.stopCameraInertia();
        this.cameraZoomAnchorX = (this.input.pointer1.x + this.input.pointer2.x) / 2;
        this.cameraZoomAnchorY = (this.input.pointer1.y + this.input.pointer2.y) / 2;
        const delta = (dist - this.lastPinchDist) * FARM_CAMERA_PINCH_ZOOM_SCALE;
        this.cameraTargetZoom = clampFarmCameraZoom(this.cameraTargetZoom + delta);
        this.lastPinchDist = dist;
      }
    });
  }

  private handleBuildPreviewTap(gx: number, gy: number): void {
    if (!this.buildSystem.selectedItem) return;
    if (!this.buildSystem.canPlace(gx, gy)) {
      this.showToast("Can't build here");
      return;
    }
    this.buildSystem.lockPreviewAt(gx, gy);
    this.updateGhostSprite();
    this.showBuildPlacementConfirm();
  }

  private showBuildPlacementConfirm(): void {
    const { ghostX, ghostY } = this.buildSystem;
    const item = this.buildSystem.selectedItem;
    if (!item) return;
    const canPlace = this.buildSystem.canPlace(ghostX, ghostY);
    const canAfford = this.economy.getCoins() >= item.cost;
    this.buildPlacementConfirm.show(
      ghostX,
      ghostY,
      canPlace && canAfford,
      () => this.confirmBuildPlacement(),
      () => this.cancelBuildMode()
    );
  }

  private confirmBuildPlacement(): void {
    const { ghostX, ghostY } = this.buildSystem;
    const item = this.buildSystem.selectedItem;
    if (!item || !this.buildSystem.canPlace(ghostX, ghostY)) {
      this.showToast("Can't build here");
      this.showBuildPlacementConfirm();
      return;
    }
    const cost = item.cost;
    if (!this.economy.spend(cost)) {
      this.showToast(`Need ${cost} coins`);
      this.showBuildPlacementConfirm();
      return;
    }
    const placedGx = ghostX;
    const placedGy = ghostY;
    const placed = this.buildSystem.place(placedGx, placedGy);
    if (placed) {
      this.emitHud();
      this.scheduleSave();
      this.advanceBuildPreviewAfterPlace(placedGx, placedGy);
    } else {
      this.economy.earn(cost);
      this.showBuildPlacementConfirm();
    }
  }

  /** Stay in build mode; lock preview on adjacent valid tile or unlock ghost. */
  private advanceBuildPreviewAfterPlace(placedGx: number, placedGy: number): void {
    const next = this.buildSystem.findNextPlacementTile(placedGx, placedGy);
    if (next) {
      this.buildSystem.lockPreviewAt(next.gx, next.gy);
      this.updateGhostSprite();
      this.showBuildPlacementConfirm();
      return;
    }
    this.buildSystem.unlockPreview();
    this.buildPlacementConfirm.hide();
    this.updateGhostSprite();
  }

  private cancelBuildMode(): void {
    this.finishBuildMode();
    this.events.emit('cancel-build-mode');
  }

  private finishBuildMode(): void {
    this.buildPlacementConfirm.hide();
    this.ghostSprite?.setVisible(false);
    this.setFarmMode('normal');
  }

  private handleLivestockPenPlaceSelect(item: LivestockPenPlaceItemDef): void {
    this.buildSystem.exitBuildMode();
    this.livestockSystem.exitUpgradeMode();
    this.livestockSystem.enterPlaceMode(item);
    this.setFarmMode('livestock');
    this.updateGhostSprite();
    const hint =
      item.placeTarget === 'fish'
        ? 'Chọn ô 3×3, đặt hồ cá, rồi bấm ✓'
        : 'Chọn ô 3×3 cỏ trống, đặt chuồng, rồi bấm ✓';
    this.events.emit('mode-hint', { text: hint, prominent: true });
  }

  private handleLivestockPlacePreviewTap(gx: number, gy: number): void {
    if (!this.livestockSystem.selectedItem) return;
    if (!this.livestockSystem.canPlace(gx, gy)) {
      this.showToast('Không đặt được tại đây');
      return;
    }
    this.livestockSystem.lockPreviewAt(gx, gy);
    this.updateGhostSprite();
    this.showLivestockPlacementConfirm();
  }

  private showLivestockPlacementConfirm(): void {
    const { ghostX, ghostY } = this.livestockSystem;
    const item = this.livestockSystem.selectedItem;
    if (!item) return;
    const canPlace = this.livestockSystem.canPlace(ghostX, ghostY);
    const canAfford = this.economy.getCoins() >= item.cost;
    this.buildPlacementConfirm.show(
      ghostX,
      ghostY,
      canPlace && canAfford,
      () => this.confirmLivestockPlacement(),
      () => this.cancelLivestockPlaceMode()
    );
  }

  private confirmLivestockPlacement(): void {
    const { ghostX, ghostY } = this.livestockSystem;
    const item = this.livestockSystem.selectedItem;
    if (!item || !this.livestockSystem.canPlace(ghostX, ghostY)) {
      this.showToast('Không đặt được tại đây');
      this.showLivestockPlacementConfirm();
      return;
    }
    if (!this.economy.spend(item.cost)) {
      this.showToast(`Cần ${item.cost} xu`);
      this.showLivestockPlacementConfirm();
      return;
    }
    const placed = this.livestockSystem.place(ghostX, ghostY);
    if (placed) {
      this.livestockSystem.exitPlaceMode();
      this.buildPlacementConfirm.hide();
      this.ghostSprite?.setVisible(false);
      this.setFarmMode('normal');
      this.emitHud();
      this.scheduleSave();
      const def = getLivestockDef(item.placeTarget as AnimalType);
      const label =
        item.placeTarget === 'fish'
          ? 'hồ cá'
          : item.placeTarget === 'ruminant'
            ? RUMINANT_PEN_LABEL_VI.toLowerCase()
            : `chuồng ${def.labelVi}`;
      this.showToast(`Đã đặt ${label}`);
      this.events.emit('mode-hint', { text: '', prominent: false });
    } else {
      this.economy.earn(item.cost);
      this.showLivestockPlacementConfirm();
    }
  }

  private cancelLivestockPlaceMode(): void {
    this.livestockSystem.exitPlaceMode();
    this.buildPlacementConfirm.hide();
    this.ghostSprite?.setVisible(false);
    this.setFarmMode('normal');
    this.events.emit('mode-hint', { text: '', prominent: false });
  }

  private handleShopLivestockStock(animalType: AnimalType): void {
    const def = getLivestockDef(animalType);
    const stocked = this.livestockSystem.stockSpeciesPen(animalType);
    if (!stocked) {
      this.economy.earn(def.animalCost);
      this.showToast(
        this.livestockSystem.findPenForStocking(animalType)
          ? `Chuồng ${def.labelVi} đã có thú`
          : `Cần đặt chuồng/hồ ${def.labelVi} trước`
      );
      return;
    }
    this.emitHud();
    this.scheduleSave();
    this.showToast(`Đã mua ${def.labelVi} vào chuồng`);
  }


  private handleLivestockPenUpgradeTap(pen: LivestockPenData): void {
    const current = this.livestockSystem.getPenAt(pen.gridX, pen.gridY) ?? pen;
    const action = this.livestockSystem.getPenAction(current, Date.now());
    if (!action.canUpgrade) {
      this.showToast('Không thể nâng cấp chuồng tại đây');
      return;
    }
    if (!this.economy.spend(LIVESTOCK_PEN_UPGRADE_COST)) {
      this.showToast(`Cần ${LIVESTOCK_PEN_UPGRADE_COST} xu để nâng cấp chuồng`);
      return;
    }
    if (!this.livestockSystem.tryUpgrade(current)) {
      this.economy.earn(LIVESTOCK_PEN_UPGRADE_COST);
      this.showToast('Vùng 4×4 bị chặn — dọn ô trống quanh chuồng');
      return;
    }
    this.livestockSystem.exitUpgradeMode();
    this.setFarmMode('normal');
    this.emitHud();
    this.scheduleSave();
    this.showToast('Đã nâng cấp chuồng lên 4×4');
  }

  private handleLivestockPenTap(pen: LivestockPenData): void {
    const now = Date.now();
    this.livestockSystem.tick(now);
    const current =
      this.livestockSystem.getPenAt(pen.gridX, pen.gridY) ??
      this.livestockSystem.getPens().find((p) => p.id === pen.id) ??
      pen;
    const def = getLivestockDef(current.animalType);
    const action = this.livestockSystem.getPenAction(current, now);

    if (action.canFeed) {
      if (!this.economy.spend(def.feedCost)) {
        this.showToast(`Cần ${def.feedCost} xu cho ăn`);
        return;
      }
      this.livestockSystem.tryFeed(current, now);
      this.emitHud();
      this.scheduleSave();
      this.showToast(`Đã cho ${def.labelVi} ăn`);
      return;
    }

    if (action.canCollect) {
      const result = this.livestockSystem.tryCollect(current, now);
      if (!result) return;
      this.inventory.add(result.productItemId, result.qty);
      this.emitHud();
      this.scheduleSave();
      this.showToast(`Thu hoạch +${result.qty} ${def.productLabel}`);
      return;
    }

    if (action.ticked.state === 'producing' && action.ticked.readyAt) {
      const sec = Math.max(1, Math.ceil((action.ticked.readyAt - now) / 1000));
      this.showToast(`${def.labelVi} đang sản xuất (~${sec}s)`);
    }
  }

  private showObjectEditPopup(gx: number, gy: number, penOnly = false): void {
    const pen = penOnly ? this.livestockSystem.getPenAt(gx, gy) : undefined;
    const showHungryWarning = pen?.lifecycleState === 'hungry';
    this.objectEditPopup.show(
      gx,
      gy,
      penOnly ? { hideRemove: true, showHungryWarning } : undefined
    );
  }

  private executeObjectEditAction(action: ObjectEditAction, gx: number, gy: number): void {
    if (action === 'remove') {
      if (this.objectEditSystem.removeAt(gx, gy)) {
        this.refreshMapDecorations();
        this.scheduleSave();
        this.showToast('Removed');
      }
      return;
    }
    const session = this.objectEditSystem.beginMove(gx, gy);
    if (!session) {
      if (this.livestockSystem.getPenAt(gx, gy)?.state === 'producing') {
        this.showToast('Không di chuyển khi đang sản xuất');
      }
      return;
    }
    this.setObjectOriginHidden(session.originGx, session.originGy, true);
    this.updateGhostSprite();
    const hint =
      session.payload.kind === 'pen'
        ? 'Chọn ô mới cho chuồng, rồi bấm ✓'
        : 'Tap a tile, then tap ✓ to place';
    this.events.emit('mode-hint', { text: hint, prominent: false });
  }

  private finishObjectEditInteraction(): void {
    if (this.objectEditSystem.active) return;
  }

  private handleObjectMovePreviewTap(gx: number, gy: number): void {
    if (!this.objectEditSystem.canPlaceAt(gx, gy)) {
      this.showToast("Can't place here");
      return;
    }
    this.objectEditSystem.lockPreviewAt(gx, gy);
    this.updateGhostSprite();
    this.showObjectMoveConfirm();
  }

  private showObjectMoveConfirm(): void {
    const { ghostX, ghostY } = this.objectEditSystem;
    const canPlace = this.objectEditSystem.canPlaceAt(ghostX, ghostY);
    this.buildPlacementConfirm.show(
      ghostX,
      ghostY,
      canPlace,
      () => this.confirmObjectMove(),
      () => this.cancelObjectMoveMode()
    );
  }

  private confirmObjectMove(): void {
    const { ghostX, ghostY } = this.objectEditSystem;
    if (!this.objectEditSystem.confirmMoveAt(ghostX, ghostY)) {
      this.showToast("Can't place here");
      this.showObjectMoveConfirm();
      return;
    }
    const movedPen = this.objectEditSystem.isPenSession();
    this.refreshMapDecorations();
    this.objectEditSystem.endMove();
    this.buildPlacementConfirm.hide();
    this.ghostSprite?.setVisible(false);
    this.events.emit('mode-hint', { text: '', prominent: false });
    this.scheduleSave();
    this.showToast(movedPen ? 'Đã di chuyển chuồng' : 'Moved');
  }

  private cancelObjectMoveMode(clearHint = true): void {
    const session = this.objectEditSystem.getSession();
    if (session) {
      this.setObjectOriginHidden(session.originGx, session.originGy, false);
    }
    this.objectEditSystem.cancelMove();
    this.buildPlacementConfirm.hide();
    this.ghostSprite?.setVisible(false);
    if (clearHint && this.farmMode === 'normal') {
      this.events.emit('mode-hint', { text: '', prominent: false });
    }
  }

  private setObjectOriginHidden(gx: number, gy: number, hidden: boolean): void {
    const pen = this.livestockSystem.getPenAt(gx, gy);
    if (pen) {
      const spr = this.livestockPenSprites.get(pen.id);
      spr?.container.setVisible(!hidden);
      return;
    }
    const k = `${gx},${gy}`;
    const buildingSpr = this.buildingSprites.get(k);
    if (buildingSpr) {
      buildingSpr.sprite.setVisible(!hidden);
      return;
    }
    const deco = this.decorations.find((d) => d.gridX === gx && d.gridY === gy);
    deco?.sprite.setVisible(!hidden);
  }

  private refreshMapDecorations(): void {
    for (const d of this.decorations) d.sprite.destroy();
    this.decorations = renderMapDecorations(this, this.grid);
  }

  private isExpandPurchaseTarget(gx: number, gy: number): boolean {
    return (
      this.landSystem.canUnlockSoilAt(this.grid, gx, gy) ||
      this.landSystem.canExpandAt(this.grid, gx, gy)
    );
  }

  private handleExpandLand(gx: number, gy: number): void {
    if (!this.isExpandPurchaseTarget(gx, gy)) {
      this.cancelExpandMode();
      return;
    }

    this.pendingExpandTile = { x: gx, y: gy };
    const cost = this.economy.getLandCost();
    this.expandDimOverlay?.hide();
    this.landUnlockConfirm.show(
      cost,
      this.economy.getCoins(),
      () => {
        const tile = this.pendingExpandTile ?? { x: gx, y: gy };
        this.confirmExpandLand(tile.x, tile.y);
        if (this.farmMode === 'expand') {
          this.expandDimOverlay?.show();
        }
      },
      () => {
        this.pendingExpandTile = undefined;
        if (this.farmMode === 'expand') {
          this.expandDimOverlay?.show();
        }
      }
    );
  }

  private cancelExpandMode(): void {
    this.landUnlockConfirm.hide();
    this.pendingExpandTile = undefined;
    if (this.farmMode === 'expand') {
      this.setFarmMode('normal');
    }
  }

  private confirmExpandLand(gx: number, gy: number): void {
    this.pendingExpandTile = undefined;

    if (!this.isExpandPurchaseTarget(gx, gy)) {
      this.showToast(LAND_EXPAND_STRINGS.invalidTile);
      return;
    }

    const cost = this.economy.getLandCost();
    if (!this.economy.canAfford(cost)) {
      this.showToast(LAND_EXPAND_STRINGS.insufficientCoins(cost));
      return;
    }

    const spent = this.economy.purchaseLand();
    if (spent === null) return;

    const result = this.landSystem.purchaseAt(this.grid, gx, gy);
    if (!result.ok) {
      this.economy.earn(spent);
      this.showToast(LAND_EXPAND_STRINGS.invalidTile);
      return;
    }

    const tx = result.x ?? gx;
    const ty = result.y ?? gy;
    this.refreshPurchasedLandTiles(tx, ty);

    if (result.kind === 'unlock') {
      this.showToast(LAND_EXPAND_STRINGS.successUnlock(spent));
    } else {
      this.showToast(LAND_EXPAND_STRINGS.successExpand(spent));
    }
    this.emitHud();
    this.scheduleSave();
  }

  private setupFarmPopups(): void {
    this.farmActionPopup = new FarmActionPopup(this, this.grid);
    this.cropSelectPopup = new CropSelectPopup(this, this.grid);

    this.farmActionPopup.setOnAction((action, gx, gy) => this.executeFarmPopupAction(action, gx, gy));
    this.farmActionPopup.setOnDismiss(() => this.finishFarmInteraction());
    this.cropSelectPopup.setOnDismiss(() => this.finishFarmInteraction());
    this.cropSelectPopup.setOnSelect((_cropId, seedId) => {
      if (!this.pendingFarmTile) return;
      this.selectedSeedId = seedId;
      this.tryPlant(this.pendingFarmTile.x, this.pendingFarmTile.y, seedId);
    });
    this.landUnlockConfirm = new LandUnlockConfirm(this);
    this.buildPlacementConfirm = new BuildPlacementConfirm(this, this.grid);
    this.objectEditPopup = new ObjectEditPopup(this, this.grid);
    this.objectEditPopup.setOnAction((action, gx, gy) =>
      this.executeObjectEditAction(action, gx, gy)
    );
    this.objectEditPopup.setOnDismiss(() => this.finishObjectEditInteraction());
    this.expandDimOverlay = new ExpandLandDimOverlay(this, this.grid, (gx, gy) =>
      this.isExpandPurchaseTarget(gx, gy)
    );
    this.farmPopupsReady = true;
  }

  isFarmPopupsReadyForTest(): boolean {
    return this.farmPopupsReady;
  }

  /** Dev/test: neglect-dry a tilled plot immediately (see {@link FarmingSystem.forceSoilIdleDryForTest}). */
  forceSoilIdleDryForTest(gx: number, gy: number): boolean {
    if (!this.farming.forceSoilIdleDryForTest(gx, gy)) return false;
    this.refreshTileAt(gx, gy);
    return true;
  }

  refocusFarmCameraForTest(): ReturnType<FarmScene['getFarmCameraCenterMetricsForTest']> {
    this.cameraScrollTouchedByUser = false;
    this.focusCameraOnFarmSoil({ recenterCamera: true });
    const cam = this.cameras.main;
    this.finalizeFarmWorldAnchorAtZoom(cam.zoom);
    this.applyFarmMapCenterScrollAtZoom(cam.zoom);
    this.clampMainCameraScrollToPlayable();
    this.applyForceSpawnWorldCaptureScroll();
    return this.getFarmCameraCenterMetricsForTest();
  }

  /**
   * After `?forceSpawnWorld=…`: re-apply analytical scroll so tile (10,10) stays on the HUD
   * target and the island footprint intersects the playable band (capture / debug).
   */
  private applyForceSpawnWorldCaptureScroll(): void {
    if (!getFarmForceSpawnWorld()) return;
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const enforced = this.finalizeFarmWorldAnchorAtZoom(zoom);
    cam.scrollX = enforced.scrollX;
    cam.scrollY = enforced.scrollY;
    this.clampMainCameraScrollToPlayable();
  }

  /** Dev/e2e: snap oversize scroll axes to clamp midpoint; returns before/after diagnostics. */
  /** Dev/e2e: pan camera by screen pixels (same math as pointer drag). */
  panFarmCameraForTest(dxScreen: number, dyScreen: number): void {
    this.cameraScrollTouchedByUser = true;
    this.stopCameraInertia();
    const cam = this.cameras.main;
    cam.scrollX -= dxScreen / cam.zoom;
    cam.scrollY -= dyScreen / cam.zoom;
    this.clampMainCameraScrollToPlayable();
    this.ensureFarmSpawnTileWorldHardLock();
  }

  /** Dev/e2e: set zoom keeping a screen anchor fixed (defaults to viewport center). */
  setFarmCameraZoomForTest(
    zoom: number,
    anchorScreenX?: number,
    anchorScreenY?: number
  ): void {
    const cam = this.cameras.main;
    const previousZoom = cam.zoom;
    const clamped = clampFarmCameraZoom(zoom);
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const anchorX = anchorScreenX ?? viewW / 2;
    const anchorY = anchorScreenY ?? viewH / 2;
    cam.setZoom(clamped);
    this.cameraTargetZoom = clamped;
    this.cameraZoomAnchorX = anchorX;
    this.cameraZoomAnchorY = anchorY;
    this.stopCameraInertia();
    this.adjustScrollAfterZoom(previousZoom, { forceRecenter: true });
  }

  /** Dev/e2e: change zoom like wheel/pinch (preserves pan when the user has panned). */
  stepFarmCameraZoomForTest(zoom: number): void {
    const cam = this.cameras.main;
    const previousZoom = cam.zoom;
    this.cameraScrollTouchedByUser = true;
    const clamped = clampFarmCameraZoom(zoom);
    cam.setZoom(clamped);
    this.cameraTargetZoom = clamped;
    this.stopCameraInertia();
    this.adjustScrollAfterZoom(previousZoom);
  }

  /** Dev/e2e: run debounced resize camera relayout (respects user view when flagged). */
  simulateFarmCameraResizeLayoutForTest(): void {
    this.focusCameraOnFarmSoil();
  }

  /** Dev/e2e: farm patch center vs viewport center after camera layout. */
  getFarmViewportDebugMetricsForTest(): {
    scaleW: number;
    scaleH: number;
    displayScaleW: number;
    displayScaleH: number;
    gameConfigW: number;
    gameConfigH: number;
    camW: number;
    camH: number;
    camX: number;
    camY: number;
    camZoom: number;
    gridOriginX: number;
    gridOriginY: number;
    mapBounds: ReturnType<GridSystem['getMapScreenBounds']>;
    bg: { x: number; y: number; displayW: number; displayH: number } | null;
  } {
    const cam = this.cameras.main;
    const bg = this.backgroundImage;
    return {
      scaleW: this.scale.width,
      scaleH: this.scale.height,
      displayScaleW: this.scale.displaySize.width,
      displayScaleH: this.scale.displaySize.height,
      gameConfigW: this.game.config.width as number,
      gameConfigH: this.game.config.height as number,
      camW: cam.width,
      camH: cam.height,
      camX: cam.x,
      camY: cam.y,
      camZoom: cam.zoom,
      gridOriginX: this.grid.originX,
      gridOriginY: this.grid.originY,
      mapBounds: this.grid.getMapScreenBounds(),
      bg: bg
        ? { x: bg.x, y: bg.y, displayW: bg.displayWidth, displayH: bg.displayHeight }
        : null,
    };
  }

  getFarmCameraCenterMetricsForTest(): {
    viewW: number;
    viewH: number;
    scrollX: number;
    scrollY: number;
    zoom: number;
    patchScreenX: number;
    patchScreenY: number;
    targetCenterX: number;
    targetCenterY: number;
    errorX: number;
    errorY: number;
    spawnScreenX: number;
    spawnScreenY: number;
    spawnErrorX: number;
    spawnErrorY: number;
    soilScreenX: number;
    soilScreenY: number;
    soilErrorX: number;
    soilErrorY: number;
    geomCenterX: number;
    geomCenterY: number;
    geomErrorX: number;
    geomErrorY: number;
    panBoundsCenterX: number;
    panBoundsCenterY: number;
    panBoundsWidth: number;
    panBoundsErrorX: number;
    panBoundsErrorY: number;
    mapTopScreenY: number;
    mapTopTargetScreenY: number;
    mapTopErrorY: number;
    panBoundsTopScreenY: number;
    /** Positive when map/WORLD ENDS top is above orange pan-bounds top. */
    mapTopAbovePanPx: number;
    playableLeft: number;
    playableTop: number;
    playableRight: number;
    playableBottom: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    mapVoidLeft: number;
    mapVoidRight: number;
    mapVoidTop: number;
    mapVoidBottom: number;
    panVoidLeft: number;
    panVoidRight: number;
    panVoidTop: number;
    panVoidBottom: number;
    islandVoidLeft: number;
    islandVoidRight: number;
    islandVoidTop: number;
    islandVoidBottom: number;
    soilVoidLeft: number;
    soilVoidRight: number;
    soilVoidTop: number;
    soilVoidBottom: number;
    scrollMidpointErrorX: number;
    scrollMidpointErrorY: number;
    /** Playable map center on screen at current scroll. */
    mapCenterScreenX: number;
    mapCenterScreenY: number;
    /** Interpolated map-center HUD target at current zoom ({@link getFarmMapCenterScreenTargetAtScrollZero}). */
    mapCenterTargetScreenX: number;
    mapCenterTargetScreenY: number;
    mapCenterErrorX: number;
    mapCenterErrorY: number;
    /** Playable map center in world space after bake (zoom keyframe target). */
    mapCenterAtOriginX: number;
    mapCenterAtOriginY: number;
    mapCenterWorldTargetX: number;
    mapCenterWorldTargetY: number;
    mapCenterWorldErrorX: number;
    mapCenterWorldErrorY: number;
    /** Tile (10,10) map-layer world (spawn anchor). */
    spawnWorldX: number;
    spawnWorldY: number;
    spawnWorldTargetX: number;
    spawnWorldTargetY: number;
    spawnWorldErrorX: number;
    spawnWorldErrorY: number;
    /** True when 20×20 AABB center is corner-tile centroid (playable center may differ). */
    isMapCenterTrueAabb: boolean;
    /** Map-center HUD label screen vs dot screen (must be < 2px when debug markers on). */
    mapCenterDotHudDeltaX: number;
    mapCenterDotHudDeltaY: number;
  } | null {
    if (!this.grid) return null;
    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const viewport = computePlayableFarmViewportLayout(
      viewW,
      viewH,
      FARM_FIT_PAD_X,
      FARM_FIT_PAD_Y
    );
    const mapScreenBounds = this.grid.getMapScreenBounds();
    const panBounds = this.getFarmCameraScrollBounds();
    const mapTopTargetScreenY = getFarmMapTopTargetScreenYFromPanBounds(
      panBounds,
      cam.scrollY,
      cam.zoom
    );
    const mapTopScreenY = (mapScreenBounds.minY - cam.scrollY) * cam.zoom;
    const panBoundsTopScreenY = (panBounds.minY - cam.scrollY) * cam.zoom;
    const farm = this.getFarmCameraScrollBounds();
    const anchor = this.getFarmCameraCenterAnchor();
    const spawn = this.grid.getFarmPlayerSpawnScreen();
    const soilRhombus = this.grid.getFarmSoilScreenRhombus().center;
    const z = cam.zoom;
    const patchScreenX = (anchor.x - cam.scrollX) * z;
    const patchScreenY = (anchor.y - cam.scrollY) * z;
    const spawnScreenX = (spawn.x - cam.scrollX) * z;
    const spawnScreenY = (spawn.y - cam.scrollY) * z;
    const soilScreenX = (soilRhombus.x - cam.scrollX) * z;
    const soilScreenY = (soilRhombus.y - cam.scrollY) * z;
    const geomCenter = getPlayableBandGeometricCenter(viewport);
    const panBoundsCenter = getFarmPanBoundsScrollTargetScreen(viewW, viewH, viewport);
    const margins = computeFarmPlayableScreenMargins(
      farm,
      viewport,
      cam.scrollX,
      cam.scrollY,
      z
    );
    const mapFootprint = screenBoundsToFootprint(mapScreenBounds);
    const mapVoid = computeFarmViewportVoidMargins(
      mapFootprint,
      viewW,
      viewH,
      cam.scrollX,
      cam.scrollY,
      z
    );
    const panVoid = computeFarmViewportVoidMargins(
      farm,
      viewW,
      viewH,
      cam.scrollX,
      cam.scrollY,
      z
    );
    const footprint = this.grid.getFarmFootprintScreenBounds();
    const soilVoid = computeFarmViewportVoidMargins(
      {
        minX: footprint.minX,
        minY: footprint.minY,
        maxX: footprint.maxX,
        maxY: footprint.maxY,
      },
      viewW,
      viewH,
      cam.scrollX,
      cam.scrollY,
      z
    );
    let islandVoid = panVoid;
    const image = this.farmIslandImage;
    if (image) {
      const halfW = image.displayWidth / 2;
      const halfH = image.displayHeight / 2;
      islandVoid = computeFarmViewportVoidMargins(
        {
          minX: image.x - halfW,
          minY: image.y - halfH,
          maxX: image.x + halfW,
          maxY: image.y + halfH,
        },
        viewW,
        viewH,
        cam.scrollX,
        cam.scrollY,
        z
      );
    }
    const limits = this.getMergedFarmCameraScrollLimits(z);
    const midScrollX = (limits.x.minScroll + limits.x.maxScroll) / 2;
    const midScrollY = (limits.y.minScroll + limits.y.maxScroll) / 2;
    const spawnWorld = this.grid.gridToMapTileCenter(
      FARM_PLAYER_SPAWN_GX,
      FARM_PLAYER_SPAWN_GY
    );
    const mapCenterWorld = spawnWorld;
    const mapCenterHudScreen = farmWorldToScreen(cam, mapCenterWorld.x, mapCenterWorld.y);
    const mapCenterDotScreen = farmWorldToScreen(cam, mapCenterWorld.x, mapCenterWorld.y);
    const mapCenterScreenX = mapCenterHudScreen.x;
    const mapCenterScreenY = mapCenterHudScreen.y;
    const worldTarget = getFarmMapCenterWorldTargetAtDefaultScroll(viewW, viewH, z);
    const spawnWorldErrorX = spawnWorld.x - worldTarget.x;
    const spawnWorldErrorY = spawnWorld.y - worldTarget.y;
    const screenTarget = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    return {
      viewW,
      viewH,
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
      zoom: z,
      patchScreenX,
      patchScreenY,
      targetCenterX: viewport.centerX,
      targetCenterY: viewport.centerY,
      errorX: patchScreenX - viewport.centerX,
      errorY: patchScreenY - viewport.centerY,
      spawnScreenX,
      spawnScreenY,
      spawnErrorX: spawnScreenX - viewport.centerX,
      spawnErrorY: spawnScreenY - viewport.centerY,
      soilScreenX,
      soilScreenY,
      soilErrorX: soilScreenX - viewport.centerX,
      soilErrorY: soilScreenY - viewport.centerY,
      geomCenterX: geomCenter.x,
      geomCenterY: geomCenter.y,
      geomErrorX: patchScreenX - geomCenter.x,
      geomErrorY: patchScreenY - geomCenter.y,
      panBoundsCenterX: panBoundsCenter.x,
      panBoundsCenterY: panBoundsCenter.y,
      panBoundsWidth: panBounds.maxX - panBounds.minX,
      panBoundsErrorX: patchScreenX - panBoundsCenter.x,
      panBoundsErrorY: patchScreenY - panBoundsCenter.y,
      mapTopScreenY,
      mapTopTargetScreenY,
      mapTopErrorY: mapTopScreenY - mapTopTargetScreenY,
      panBoundsTopScreenY,
      mapTopAbovePanPx: panBoundsTopScreenY - mapTopScreenY,
      playableLeft: viewport.playableLeft,
      playableTop: viewport.playableTop,
      playableRight: viewport.playableRight,
      playableBottom: viewport.playableBottom,
      marginLeft: margins.left,
      marginRight: margins.right,
      marginTop: margins.top,
      marginBottom: margins.bottom,
      mapVoidLeft: mapVoid.left,
      mapVoidRight: mapVoid.right,
      mapVoidTop: mapVoid.top,
      mapVoidBottom: mapVoid.bottom,
      panVoidLeft: panVoid.left,
      panVoidRight: panVoid.right,
      panVoidTop: panVoid.top,
      panVoidBottom: panVoid.bottom,
      islandVoidLeft: islandVoid.left,
      islandVoidRight: islandVoid.right,
      islandVoidTop: islandVoid.top,
      islandVoidBottom: islandVoid.bottom,
      soilVoidLeft: soilVoid.left,
      soilVoidRight: soilVoid.right,
      soilVoidTop: soilVoid.top,
      soilVoidBottom: soilVoid.bottom,
      scrollMidpointErrorX: limits.x.oversize ? cam.scrollX - midScrollX : 0,
      scrollMidpointErrorY: limits.y.oversize ? cam.scrollY - midScrollY : 0,
      mapCenterScreenX,
      mapCenterScreenY,
      mapCenterTargetScreenX: screenTarget.x,
      mapCenterTargetScreenY: screenTarget.y,
      mapCenterErrorX: mapCenterScreenX - screenTarget.x,
      mapCenterErrorY: mapCenterScreenY - screenTarget.y,
      mapCenterAtOriginX: mapCenterWorld.x,
      mapCenterAtOriginY: mapCenterWorld.y,
      mapCenterWorldTargetX: this.farmMapCenterWorldTargetX || worldTarget.x,
      mapCenterWorldTargetY: this.farmMapCenterWorldTargetY || worldTarget.y,
      mapCenterWorldErrorX:
        mapCenterWorld.x - (this.farmMapCenterWorldTargetX || worldTarget.x),
      mapCenterWorldErrorY:
        mapCenterWorld.y - (this.farmMapCenterWorldTargetY || worldTarget.y),
      spawnWorldX: spawnWorld.x,
      spawnWorldY: spawnWorld.y,
      spawnWorldTargetX: worldTarget.x,
      spawnWorldTargetY: worldTarget.y,
      spawnWorldErrorX,
      spawnWorldErrorY,
      isMapCenterTrueAabb: this.grid.isFarmMapCenterTrueAabb(),
      mapCenterDotHudDeltaX: mapCenterDotScreen.x - mapCenterHudScreen.x,
      mapCenterDotHudDeltaY: mapCenterDotScreen.y - mapCenterHudScreen.y,
    };
  }

  getFarmCameraScrollLimitsForTest(): FarmCameraScrollLimits | null {
    if (!this.grid) return null;
    const cam = this.cameras.main;
    return this.getMergedFarmCameraScrollLimits(cam.zoom);
  }

  /**
   * Dev/e2e: playable map center screen after world-offset + scroll for `zoom` (from current baked state).
   */
  getFarmMapCenterScreenAtZoomForTest(zoom: number): {
    zoom: number;
    mapCenterWorldX: number;
    mapCenterWorldY: number;
    scrollX: number;
    scrollY: number;
    screenX: number;
    screenY: number;
    targetScreenX: number;
    targetScreenY: number;
  } | null {
    if (!this.grid) return null;
    const z = clampFarmCameraZoom(zoom);
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const { dx, dy } = getFarmMapCenterWorldOffsetDelta(
      viewW,
      viewH,
      this.lastMapCenterWorldOffsetZoom,
      z
    );
    const mapCenterNow = this.grid.getFarmPlayableMapCenterScreen();
    const mapCenter = { x: mapCenterNow.x + dx, y: mapCenterNow.y + dy };
    const scroll = computeScrollForMapCenterScreenTarget(mapCenter, viewW, viewH, z);
    const target = getFarmMapCenterScreenTargetAtScrollZero(viewW, viewH, z);
    return {
      zoom: z,
      mapCenterWorldX: mapCenter.x,
      mapCenterWorldY: mapCenter.y,
      scrollX: scroll.scrollX,
      scrollY: scroll.scrollY,
      screenX: (mapCenter.x - scroll.scrollX) * z,
      screenY: (mapCenter.y - scroll.scrollY) * z,
      targetScreenX: target.x,
      targetScreenY: target.y,
    };
  }

  /** Clears pending tile state after popups close / plant completes. */
  private finishFarmInteraction(): void {
    if (this.farmActionPopup.isVisible() || this.cropSelectPopup.isVisible()) {
      this.syncToolBarVisibility();
      return;
    }
    this.pendingFarmTile = undefined;
    this.pendingPlantCell = undefined;
    this.syncToolBarVisibility();
  }

  /** Hide debug persistent top tool strip while tile action / crop popups are open. */
  private syncToolBarVisibility(): void {
    if (!this.toolBar) return;
    const popupOpen =
      this.farmActionPopup?.isVisible() || this.cropSelectPopup?.isVisible();
    this.toolBar.setVisible(!popupOpen);
  }

  private dismissFarmPopups(): void {
    this.farmActionPopup.hide();
    this.cropSelectPopup.hide();
    this.objectEditPopup?.hide(false);
    if (this.objectEditSystem.active) {
      this.cancelObjectMoveMode(false);
    }
    this.finishFarmInteraction();
    this.finishObjectEditInteraction();
  }

  /**
   * Consume pointer when a farm popup is open so the same tap does not walk/dig/open another tile.
   * Popup chrome is handled by its own listeners; backdrop/outside only dismisses.
   */
  private handleLandUnlockPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.landUnlockConfirm?.isVisible()) return false;
    return this.landUnlockConfirm.handlePointerDown(pointer);
  }

  private handleBuildConfirmPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.buildPlacementConfirm?.isVisible()) return false;
    return this.buildPlacementConfirm.handlePointerDown(pointer);
  }

  private handleObjectEditPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.objectEditPopup?.isVisible()) return false;
    if (this.objectEditPopup.hitsPointer(pointer)) {
      return this.objectEditPopup.handlePointerDown(pointer);
    }
    this.objectEditPopup.hide();
    pointer.event?.stopPropagation();
    return true;
  }

  private handleFarmPopupPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.farmActionPopup.isVisible() && !this.cropSelectPopup.isVisible()) {
      return false;
    }

    if (this.isTapOnFarmPopup(pointer)) {
      pointer.event?.stopPropagation();
      return true;
    }

    this.dismissFarmPopups();
    pointer.event?.stopPropagation();
    return true;
  }

  private isTapOnFarmPopup(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.farmActionPopup.hitsPointer(pointer) ||
      this.cropSelectPopup.hitsPointer(pointer) ||
      this.farmActionPopup.hitsBackdrop(pointer) ||
      this.cropSelectPopup.hitsBackdrop(pointer)
    );
  }

  private isLockedFarmSoil(gx: number, gy: number): boolean {
    return this.grid.isLockedSoil(gx, gy);
  }

  private isFarmInteractableTile(
    gx: number,
    gy: number,
    cell: NonNullable<ReturnType<GridSystem['getCell']>>
  ): boolean {
    if (cell.object) return false;
    if (cell.type === 'water' || cell.type === 'path') return false;
    if (cell.type === 'soil') return this.grid.isFarmUnlocked(gx, gy);
    if (cell.type === 'grass') return this.farming.hasCropRecord(gx, gy);
    return false;
  }

  private isOnTile(px: number, py: number, gx: number, gy: number): boolean {
    return px === gx && py === gy;
  }

  /**
   * Walk destination for a farm tile tap: the clicked cell when walkable,
   * otherwise the nearest walkable neighbor (blocked by object/building).
   */
  private findWalkTargetForFarmTile(
    targetGx: number,
    targetGy: number
  ): { x: number; y: number } | null {
    if (this.grid.isWalkable(targetGx, targetGy)) {
      return { x: targetGx, y: targetGy };
    }

    const player = this.player.getGridPosition();
    const candidates: { x: number; y: number; dist: number }[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ax = targetGx + dx;
        const ay = targetGy + dy;
        if (this.grid.isWalkable(ax, ay)) {
          candidates.push({
            x: ax,
            y: ay,
            dist: Math.abs(ax - player.x) + Math.abs(ay - player.y),
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    return { x: candidates[0].x, y: candidates[0].y };
  }

  private getFarmPopupOptions(gx: number, gy: number) {
    const seeds = this.inventory.getAvailableSeeds();
    return {
      canDig: this.farming.canDig(gx, gy),
      canPlant: this.farming.canPlant(gx, gy) && seeds.length > 0,
      canWater: this.farming.canWater(gx, gy),
      canHarvest: this.farming.isReady(gx, gy),
    };
  }

  private handleFarmTileTap(
    gx: number,
    gy: number,
    cell: NonNullable<ReturnType<GridSystem['getCell']>>
  ): void {
    if (cell.type !== 'soil' || !this.grid.isFarmUnlocked(gx, gy)) return;

    this.pendingFarmTile = { x: gx, y: gy };
    const player = this.player.getGridPosition();

    if (this.isOnTile(player.x, player.y, gx, gy)) {
      this.showFarmActionPopup(gx, gy);
      return;
    }

    const walkTarget = this.findWalkTargetForFarmTile(gx, gy);
    if (!walkTarget) {
      this.showToast('Cannot reach this plot');
      this.pendingFarmTile = undefined;
      return;
    }

    this.player.moveTo(walkTarget.x, walkTarget.y, this.grid, () => {
      if (!this.pendingFarmTile) return;
      this.showFarmActionPopup(this.pendingFarmTile.x, this.pendingFarmTile.y);
    });
  }

  private showFarmActionPopup(gx: number, gy: number): void {
    const options = this.getFarmPopupOptions(gx, gy);
    if (!options.canDig && !options.canPlant && !options.canWater && !options.canHarvest) {
      this.showToast('Nothing to do on this tile');
      this.pendingFarmTile = undefined;
      return;
    }
    this.farmActionPopup.show(gx, gy, options);
    this.syncToolBarVisibility();
  }

  /** E2e: open land-tile tool modal without walking (layout smoke; skips economy checks). */
  showFarmActionPopupForTest(gx = 7, gy = 9): void {
    this.farmActionPopup.show(gx, gy, {
      canDig: true,
      canPlant: true,
      canWater: true,
      canHarvest: true,
    });
    this.syncToolBarVisibility();
  }

  isFarmActionPopupVisible(): boolean {
    return this.farmActionPopup.isVisible();
  }

  getFarmActionPopupLayoutForTest() {
    return this.farmActionPopup.getLayoutMetricsForTest();
  }

  getFarmActionPopupVisualForTest() {
    return this.farmActionPopup.getVisualMetricsForTest();
  }

  showCropSelectPopupForTest(gx = 7, gy = 9): void {
    this.cropSelectPopup.show(gx, gy, this.inventory);
    this.syncToolBarVisibility();
  }

  isCropSelectPopupVisible(): boolean {
    return this.cropSelectPopup.isVisible();
  }

  getCropSelectPopupLayoutForTest() {
    return this.cropSelectPopup.getLayoutMetricsForTest();
  }

  getCropSelectPopupVisualForTest() {
    return this.cropSelectPopup.getVisualMetricsForTest();
  }

  closeCropSelectPopupForTest(): void {
    this.cropSelectPopup.hide();
    this.syncToolBarVisibility();
  }

  closeFarmActionPopupForTest(): void {
    this.farmActionPopup.hide();
    this.syncToolBarVisibility();
  }

  isToolBarVisibleForTest(): boolean {
    return this.toolBar?.isVisible() ?? false;
  }

  showObjectEditPopupForTest(gx = 7, gy = 9, penOnly = false): void {
    this.showObjectEditPopup(gx, gy, penOnly);
  }

  isObjectEditPopupVisibleForTest(): boolean {
    return this.objectEditPopup.isVisible();
  }

  getObjectEditPopupActionsForTest(): ObjectEditAction[] {
    return this.objectEditPopup.getVisibleActionsForTest();
  }

  isObjectEditFeedWarningVisibleForTest(): boolean {
    return this.objectEditPopup.isFeedWarningBadgeVisibleForTest();
  }

  isPenHungryWarningVisibleForTest(gx: number, gy: number): boolean {
    const pen = this.livestockSystem.getPenAt(gx, gy);
    if (!pen) return false;
    return this.livestockPenSprites.get(pen.id)?.isHungryWarningVisibleForTest() ?? false;
  }

  forcePenHungryStateForTest(gx: number, gy: number, hungry: boolean): boolean {
    const pen = this.livestockSystem.getPenAt(gx, gy);
    if (!pen) return false;
    if (!this.livestockSystem.setPenHungryStateForTest(pen.id, hungry)) return false;
    this.refreshMapDecorations();
    return true;
  }

  tapPenForTest(gx: number, gy: number): boolean {
    if (this.farmMode !== 'normal') return false;
    const pen = this.livestockSystem.getPenAt(gx, gy);
    if (!pen) return false;
    this.dismissFarmPopups();
    const now = Date.now();
    this.livestockSystem.tick(now);
    const action = this.livestockSystem.getPenAction(pen, now);
    if (action.canCollect || action.canFeed || action.ticked.state === 'producing') {
      this.handleLivestockPenTap(pen);
      return true;
    }
    this.showObjectEditPopup(gx, gy, true);
    return true;
  }

  closeObjectEditPopupForTest(): void {
    this.objectEditPopup.hide();
  }

  getSoilFootprintAlignMetricsForTest(): {
    soilGridRange: { minX: number; maxX: number; minY: number; maxY: number };
    centerAlignErrorPx: number;
    maxTileOutsideAabbPx: number;
    maxSpriteDriftPx: number;
    soilFootprintAlignError: number;
  } | null {
    if (!this.grid) return null;
    const m = this.grid.measureSoilFootprintAlignment();
    let maxSpriteDriftPx = 0;
    const { minX, maxX, minY, maxY } = m.soilGridRange;
    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const spr = this.tileSprites[gy * this.grid.size + gx];
        if (!spr?.visible) continue;
        const expected = this.grid.gridToMapScreen(gx, gy);
        maxSpriteDriftPx = Math.max(
          maxSpriteDriftPx,
          Math.hypot(spr.x - expected.x, spr.y - expected.y)
        );
      }
    }
    const soilFootprintAlignError = Math.max(
      m.soilFootprintAlignError,
      maxSpriteDriftPx
    );
    return {
      soilGridRange: m.soilGridRange,
      centerAlignErrorPx: m.centerAlignErrorPx,
      maxTileOutsideAabbPx: m.maxTileOutsideAabbPx,
      maxSpriteDriftPx,
      soilFootprintAlignError,
    };
  }

  getFarmBoundsMetricsForTest(): {
    mapBounds: ReturnType<GridSystem['getMapScreenBounds']>;
    footprintBounds: ReturnType<GridSystem['getFarmFootprintScreenBounds']>;
    panBounds: FarmFootprintBounds;
    mapTopPanOffsetY: number;
    mapTopPanOffsetX: number;
    /** Soil iso rhombus center (island layout; above spawn when spawn is baked to center). */
    soilRhombusCenter: { x: number; y: number };
    /** Player spawn tile center in world/map space. */
    playerSpawnWorld: { x: number; y: number };
  } | null {
    if (!this.grid) return null;
    const spawn = this.player?.getGridPosition() ?? { x: 10, y: 10 };
    return {
      mapBounds: this.grid.getMapScreenBounds(),
      footprintBounds: this.grid.getFarmFootprintScreenBounds(),
      panBounds: this.getFarmCameraScrollBounds(),
      mapTopPanOffsetY: this.grid.mapTopPanOffsetY,
      mapTopPanOffsetX: this.grid.mapTopPanOffsetX,
      soilRhombusCenter: this.grid.getFarmSoilScreenRhombus().center,
      playerSpawnWorld: this.grid.getFarmPlayerSpawnScreen(spawn.x, spawn.y),
    };
  }

  setMapTopPanOffsetXForTest(offsetX: number): void {
    this.grid.mapTopPanOffsetX = offsetX;
    this.focusCameraOnFarmSoil({ recenterCamera: true });
  }

  private executeFarmPopupAction(action: FarmPopupAction, gx: number, gy: number): void {
    this.pendingFarmTile = { x: gx, y: gy };
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return;

    switch (action) {
      case 'dig':
        this.setSelectedTool(FarmTool.HOE);
        this.handleDig(gx, gy, cell);
        break;
      case 'water':
        this.setSelectedTool(FarmTool.WATERING_CAN);
        this.handleWater(gx, gy);
        break;
      case 'harvest':
        this.setSelectedTool(FarmTool.HARVEST_HAND);
        this.handleHarvest(gx, gy);
        break;
      case 'plant':
        this.cropSelectPopup.show(gx, gy, this.inventory);
        this.syncToolBarVisibility();
        return;
    }
    this.finishFarmInteraction();
  }

  private spendEnergyForAction(actionLabel: string): boolean {
    if (this.energySystem.canSpend()) {
      this.energySystem.spend();
      return true;
    }
    this.showToast(`Not enough energy for ${actionLabel}`);
    return false;
  }

  private handleDig(
    gx: number,
    gy: number,
    cell: NonNullable<ReturnType<GridSystem['getCell']>>
  ): boolean {
    if (cell.type === 'water') return false;
    if (!this.farming.canDig(gx, gy)) {
      if (cell.type === 'soil' && this.farming.isGrowing(gx, gy)) {
        this.showToast('Crop already here');
      }
      return false;
    }
    if (!this.spendEnergyForAction('digging')) return false;
    if (this.farming.dig(gx, gy)) {
      this.player.playFarmAction(PlayerFarmAction.DIGGING, 600);
      playDigDust(this, this.grid, gx, gy);
      this.refreshTileAt(gx, gy);
      syncCropSprites(this, this.grid, this.farming, this.cropSprites);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  private handleWater(gx: number, gy: number): boolean {
    if (!this.farming.canWater(gx, gy)) {
      if (this.farming.isReady(gx, gy)) this.showToast('Crop is ready — harvest it');
      return false;
    }
    if (!this.spendEnergyForAction('watering')) return false;
    if (this.farming.water(gx, gy)) {
      this.player.playFarmAction(PlayerFarmAction.WATERING, 500);
      playWaterDrop(this, this.grid, gx, gy);
      this.refreshTileAt(gx, gy);
      syncCropSprites(this, this.grid, this.farming, this.cropSprites);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  private handleHarvest(gx: number, gy: number): boolean {
    if (!this.farming.isReady(gx, gy)) {
      if (this.farming.isGrowing(gx, gy)) this.showToast('Not ready yet');
      return false;
    }
    const crop = this.farming.getCrop(gx, gy);
    const kind = crop ? (crop.cropType ?? crop.kind) : null;
    if (!kind) return false;
    const yieldAmt = getCropDef(kind).yield;
    const harvestItemId = getCropDef(kind).harvestItemId;
    if (!this.inventory.canAdd(harvestItemId, yieldAmt)) {
      this.showToast('Warehouse full — sell or upgrade');
      return false;
    }
    if (!this.spendEnergyForAction('harvesting')) return false;
    const result = this.farming.harvest(gx, gy);
    if (!result) return false;

    const { kind: harvestedKind, yield: harvestedYield } = result;
    this.inventory.add(getCropDef(harvestedKind).harvestItemId, harvestedYield);
    this.player.playFarmAction(PlayerFarmAction.HARVESTING, 550);

    const k = cropKey(gx, gy);
    const cs = this.cropSprites.get(k);
    playHarvestEffects(this, this.grid, gx, gy, harvestedKind, harvestedYield, cs);
    if (cs) {
      this.time.delayedCall(400, () => {
        cs.destroy();
        this.cropSprites.delete(k);
      });
    }

    syncCropSprites(this, this.grid, this.farming, this.cropSprites);
    this.dismissFarmPopups();
    this.emitHud();
    this.scheduleSave();
    return true;
  }

  tryPlantFromUI(seedId: string): void {
    this.selectedSeedId = seedId;
    if (this.pendingPlantCell) {
      this.tryPlant(this.pendingPlantCell.x, this.pendingPlantCell.y, seedId);
      this.pendingPlantCell = undefined;
    } else {
      this.finishFarmInteraction();
      this.showToast('Tap dug soil to plant');
    }
  }

  private tryPlant(gx: number, gy: number, seedId: string): boolean {
    const kind = this.inventory.cropKindFromSeedId(seedId);
    if (!kind || !this.inventory.hasSeedForCrop(kind)) {
      this.showToast('Not enough seeds');
      this.finishFarmInteraction();
      return false;
    }
    if (!this.spendEnergyForAction('planting')) return false;
    if (!this.inventory.consumeSeedForCrop(kind)) {
      this.finishFarmInteraction();
      return false;
    }
    if (!this.farming.plant(gx, gy, kind)) {
      this.inventory.add(seedId, 1);
      if (this.farming.isSoilIdleDry(gx, gy)) {
        this.showToast(SOIL_IDLE_STRINGS.cannotPlant);
      }
      this.finishFarmInteraction();
      return false;
    }
    this.selectedSeedId = seedId;
    this.farmActionPopup.hide(false);
    this.cropSelectPopup.hide(false);
    this.pendingFarmTile = undefined;
    playPlantEffect(this, this.grid, gx, gy);
    this.player.playFarmAction(PlayerFarmAction.PLANTING, 500);
    this.refreshTileAt(gx, gy);
    this.refreshTileAt(gx, gy);
    syncCropSprites(this, this.grid, this.farming, this.cropSprites);
    this.emitHud();
    this.scheduleSave();
    return true;
  }

  upgradeBuilding(building: BuildingData): boolean {
    const cost = this.economy.getBuildingUpgradeCost(building.type, building.level);
    if (!this.economy.canUpgradeBuilding(building.type, building.level)) {
      this.showToast(`Need ${cost} coins`);
      return false;
    }
    if (!this.economy.upgradeBuilding(building.type, building.level)) return false;
    this.buildSystem.upgradeBuilding(building);
    const k = `${building.gridX},${building.gridY}`;
    const spr = this.buildingSprites.get(k);
    if (spr) {
      spr.sprite.setTexture(building.textureKey);
      if (building.level >= 3) spr.sprite.setTint(0xffd699);
    }
    this.emitHud();
    this.scheduleSave();
    return true;
  }

  setFarmMode(mode: FarmMode): void {
    const enteringExpand = mode === 'expand' && this.farmMode !== 'expand';
    this.farmMode = mode;
    if (mode !== 'build') {
      this.buildPlacementConfirm?.hide();
      this.buildSystem.exitBuildMode();
      if (mode !== 'livestock') {
        this.ghostSprite?.setVisible(false);
      }
    }
    if (mode !== 'livestock') {
      this.livestockSystem.exitPlaceMode();
      this.livestockSystem.exitUpgradeMode();
    }
    if (mode !== 'normal') {
      this.cancelObjectMoveMode();
      this.objectEditPopup?.hide(false);
    }
    if (mode !== 'expand') {
      this.landUnlockConfirm?.hide();
      this.pendingExpandTile = undefined;
      this.expandDimOverlay?.hide();
    } else if (enteringExpand) {
      this.showToast(LAND_EXPAND_STRINGS.selectHint, { prominent: true });
      this.expandDimOverlay?.show();
    }
    const seedHint =
      this.selectedSeedId && this.inventory.cropKindFromSeedId(this.selectedSeedId)
        ? getCropDef(this.inventory.cropKindFromSeedId(this.selectedSeedId)!).name
        : 'a crop';
    const hints: Record<Exclude<FarmMode, 'normal'>, string> = {
      build: 'Tap a tile, then tap ✓ to build',
      livestock: this.livestockSystem.active
        ? 'Chọn ô 3×3, đặt chuồng/hồ, rồi bấm ✓'
        : 'Chạm chuồng cấp 1 để nâng lên 4×4',
      expand: LAND_EXPAND_STRINGS.selectHint,
      plant: this.selectedSeedId
        ? `Seed tool: tap dug soil to plant ${seedHint}`
        : 'Seed tool: pick seed in panel, dig soil, then plant',
    };
    if (mode === 'normal') {
      this.events.emit('mode-hint', { text: '', prominent: false });
    } else {
      this.events.emit('mode-hint', { text: hints[mode], prominent: mode === 'expand' });
    }
  }

  private setupUISync(): void {
    // UIScene emits these on FarmScene.events (not UIScene.events).
    this.events.on('ui-ready', () => {
      this.emitGameRefs();
      if (!this.cameraScrollTouchedByUser) {
        this.focusCameraOnFarmSoil();
        this.time.delayedCall(0, () => {
          if (!this.cameraScrollTouchedByUser) {
            this.snapMainCameraOversizeScrollToMidpoint();
          }
        });
      }
    });
    this.events.on('build-select', (item: BuildItemDef) => {
      this.livestockSystem.exitUpgradeMode();
      this.buildSystem.enterBuildMode(item);
      this.setFarmMode('build');
      this.updateGhostSprite();
    });
    this.events.on('livestock-pen-place', (item: LivestockPenPlaceItemDef) => {
      this.handleLivestockPenPlaceSelect(item);
    });
    this.events.on('shop-livestock-stock', (animalType: AnimalType) => {
      this.handleShopLivestockStock(animalType);
    });
    this.events.on('livestock-pen-upgrade', () => {
      this.buildSystem.exitBuildMode();
      this.livestockSystem.enterUpgradeMode();
      this.setFarmMode('livestock');
      this.updateGhostSprite();
      this.events.emit('mode-hint', {
        text: 'Chạm chuồng cấp 1 để nâng lên 4×4',
        prominent: true,
      });
    });
    this.events.on('menu-action', (action: string) => this.handleMenuAction(action));
    this.events.on('dismiss-farm-popups', () => this.dismissFarmPopups());
    this.events.on('plant-seed-selected', (seedId: string) => this.tryPlantFromUI(seedId));
    this.events.on('request-save', () => this.scheduleSave());
    this.events.on('upgrade-building', (building: BuildingData) => {
      this.upgradeBuilding(building);
    });
  }

  private handleMenuAction(action: string): void {
    switch (action) {
      case 'expand':
        this.setFarmMode(this.farmMode === 'expand' ? 'normal' : 'expand');
        break;
      case 'plant':
        this.setSelectedTool(FarmTool.SEED);
        {
          const seeds = this.inventory.getAvailableSeeds();
          if (seeds.length === 0) {
            this.showToast('No seeds — open shop');
            this.events.emit('open-shop');
          } else if (seeds.length === 1) {
            this.selectedSeedId = seeds[0].id;
          } else {
            this.events.emit('open-plant-picker', seeds);
          }
        }
        break;
      case 'build':
        break;
      default:
        if (this.farmMode !== 'normal') this.setFarmMode('normal');
    }
  }

  private showToast(msg: string, opts?: { prominent?: boolean }): void {
    const vw = this.scale.width;
    const vh = this.scale.height;
    const prominent = Boolean(opts?.prominent);
    const fontSize = prominent
      ? expandSelectHintToastFontSize(vw, vh)
      : '14px';
    const pad = prominent ? { x: 16, y: 10 } : { x: 10, y: 6 };
    const txt = this.add
      .text(vw / 2, prominent ? 96 : 80, msg, {
        fontSize,
        color: '#fff',
        backgroundColor: '#000000aa',
        padding: pad,
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12000);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      y: 60,
      duration: 1600,
      onComplete: () => txt.destroy(),
    });
  }

  private screenPointToGrid(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const cam = this.cameras.main;
    const world = cam.getWorldPoint(pointer.x, pointer.y);
    return this.grid.worldToGrid(world.x, world.y);
  }

  private updateGhostSprite(): void {
    const moveActive = this.objectEditSystem.active;
    const buildActive = this.buildSystem.active;
    const livestockActive = this.livestockSystem.active;
    const livestockUpgrade = this.livestockSystem.upgradeMode;
    if (!buildActive && !moveActive && !livestockActive && !livestockUpgrade) {
      this.ghostSprite?.setVisible(false);
      return;
    }
    if (livestockUpgrade) {
      this.ghostSprite?.setVisible(false);
      return;
    }

    const ghostX = moveActive
      ? this.objectEditSystem.ghostX
      : livestockActive
        ? this.livestockSystem.ghostX
        : this.buildSystem.ghostX;
    const ghostY = moveActive
      ? this.objectEditSystem.ghostY
      : livestockActive
        ? this.livestockSystem.ghostY
        : this.buildSystem.ghostY;
    const penMove = moveActive && this.objectEditSystem.isPenSession();
    const moveSession = this.objectEditSystem.getSession();
    const penMoveLevel =
      penMove && moveSession?.payload.kind === 'pen' ? (moveSession.payload.pen.level ?? 1) : 1;
    const penFootprintTiles_ =
      livestockActive || penMove
        ? penFootprintTiles(penMove ? penMoveLevel : 1)
        : null;
    const anchorGx = ghostX;
    const anchorGy = ghostY;
    const foot =
      penFootprintTiles_
        ? (() => {
            const b = this.grid.getRectFootprintScreenBounds(
              anchorGx,
              anchorGy,
              penFootprintTiles_.w,
              penFootprintTiles_.h
            );
            return { x: b.centerX, y: b.bottomY };
          })()
        : this.grid.gridToTileBottom(anchorGx, anchorGy);
    const key = moveActive
      ? this.objectEditSystem.ghostTextureKey()
      : livestockActive
        ? (this.livestockSystem.selectedItem?.textureKey ?? 'chicken_house')
        : (this.buildSystem.selectedItem?.textureKey ?? 'house_lv1');
    const canPlace = moveActive
      ? this.objectEditSystem.canPlaceAt(ghostX, ghostY)
      : livestockActive
        ? this.livestockSystem.canPlace(ghostX, ghostY)
        : this.buildSystem.canPlace(ghostX, ghostY);
    const isNatural = moveActive && this.objectEditSystem.isNaturalTexture(key);

    if (!this.ghostSprite) {
      this.ghostSprite = this.add.sprite(foot.x, foot.y, key);
      this.ghostSprite.setOrigin(0.5, 1);
    }
    this.ghostSprite.setTexture(key);
    if (isNatural) {
      const tree = key.startsWith('tree');
      fitSpriteDisplay(
        this.ghostSprite,
        DISPLAY_SIZE.tileW * (tree ? 1.2 : 0.9) * NATURE_DISPLAY_SCALE,
        (tree ? DISPLAY_SIZE.treeH : DISPLAY_SIZE.rockH) * NATURE_DISPLAY_SCALE
      );
      this.ghostSprite.setDepth(this.grid.getDepth(ghostX, ghostY, 'objects') + 50);
    } else if (penFootprintTiles_) {
      const level = penMove ? penMoveLevel : 1;
      const display = penHouseDisplaySize(level, DISPLAY_SIZE.tileW, DISPLAY_SIZE.tileH);
      fitSpriteToIsoFootprint(this.ghostSprite, display.width, display.height);
      this.ghostSprite.setDepth(this.grid.getDepth(ghostX, ghostY, 'buildings') + 50);
    } else {
      fitSpriteDisplay(
        this.ghostSprite,
        DISPLAY_SIZE.tileW * 1.4,
        DISPLAY_SIZE.buildingH
      );
      this.ghostSprite.setDepth(this.grid.getDepth(ghostX, ghostY, 'buildings') + 50);
    }
    this.ghostSprite.setPosition(foot.x, foot.y);
    this.ghostSprite.setAlpha(0.55);
    this.ghostSprite.setTint(canPlace ? 0x88ff88 : 0xff8888);
    this.ghostSprite.setVisible(true);

    if (this.buildPlacementConfirm?.isVisible()) {
      this.buildPlacementConfirm.refreshLayout();
      if (moveActive) {
        this.buildPlacementConfirm.setConfirmEnabled(canPlace);
      } else if (livestockActive) {
        const item = this.livestockSystem.selectedItem;
        if (item) {
          const canAfford = this.economy.getCoins() >= item.cost;
          this.buildPlacementConfirm.setConfirmEnabled(canPlace && canAfford);
        }
      } else {
        const item = this.buildSystem.selectedItem;
        if (item) {
          const canAfford = this.economy.getCoins() >= item.cost;
          const canPlaceBuild = this.buildSystem.canPlace(ghostX, ghostY);
          this.buildPlacementConfirm.setConfirmEnabled(canPlaceBuild && canAfford);
        }
      }
    }
  }

  shutdown(): void {
    this.flushSave();
    this.cameraDebugLabel?.destroy();
    this.cameraDebugLabel = undefined;
    this.teardownPersistenceHooks();
    this.farming.stopTick();
    this.toolBar?.destroy();
    this.scale.off('resize', this.handleResize, this);
    if (this.resizeLayoutTimer !== undefined) {
      clearTimeout(this.resizeLayoutTimer);
      this.resizeLayoutTimer = undefined;
    }
  }

  update(_time: number, delta: number): void {
    this.updateFarmCameraMotion(delta);
    this.ensureFarmSpawnTileWorldHardLock();
    if (this.cameraDebugLabel) this.refreshCameraDebugOverlay();
    if (this.farmCenterDebugMarkers) this.refreshFarmCenterDebugMarkers();
    if (this.farmViewportHudDebugContainer) this.refreshFarmDebugHudVoidHint();

    this.player.update(this.grid, delta);

    this.energyPassiveTimer += delta;
    if (this.energyPassiveTimer >= 1000) {
      this.energyPassiveTimer = 0;
      this.livestockSystem.tick(Date.now());
      const before = this.energySystem.getEnergy();
      if (this.isPlayerActive()) {
        this.energySystem.applyActiveDrain();
      } else {
        this.energySystem.applyRecovery();
      }
      if (this.energySystem.getEnergy() !== before) {
        this.emitHud();
        this.scheduleSave();
      }
    }

    if (this.saveTimer > 0) {
      this.saveTimer -= delta;
      if (this.saveTimer <= 0) {
        this.persist();
        this.saveTimer = 0;
      }
    }
  }

  private isPlayerActive(): boolean {
    return this.player.isMoving() || this.player.isBusyFarming();
  }

  private scheduleSave(): void {
    if (this.saveTimer <= 0) this.saveTimer = 2000;
  }

  /** Write save immediately (page hide / unload / scene shutdown). */
  flushSave(): void {
    this.saveTimer = 0;
    this.persist();
  }

  private persist(): void {
    this.saveSystem.save(
      {
        coins: this.economy.getCoins(),
        gems: this.gems,
        energy: this.energySystem.getEnergy(),
        energyUpdatedAt: this.energySystem.getUpdatedAt(),
        landPurchases: this.economy.getLandPurchases(),
        selectedSeed: this.selectedSeedId,
        selectedTool: this.selectedTool,
      },
      this.farming,
      this.buildSystem.getBuildings(),
      this.inventory,
      this.grid,
      this.livestockSystem.exportPens()
    );
  }

  private emitHud(): void {
    this.events.emit('update-hud', {
      coins: this.economy.getCoins(),
      gems: this.gems,
      energy: this.energySystem.getEnergy(),
    });
  }
}

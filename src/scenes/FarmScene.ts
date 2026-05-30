import Phaser from 'phaser';
import { applyViewportCoverBackground } from '../backgroundLayout';
import {
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
  FarmTool,
  isDebugMode,
  isFarmCameraDebug,
  isFarmGridDebug,
  isPersistentToolBarEnabled,
  LAND_EXPAND_STRINGS,
  PlayerFarmAction,
  SOIL_IDLE_STRINGS,
} from '../config/gameConfig';
import { CropSelectPopup } from '../ui/CropSelectPopup';
import { FarmActionPopup, type FarmPopupAction } from '../ui/FarmActionPopup';
import { ExpandLandDimOverlay } from '../ui/ExpandLandDimOverlay';
import { LandUnlockConfirm } from '../ui/LandUnlockConfirm';
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
  tileCenterFromTop,
} from '../utils/iso';
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
import type { BuildingData } from '../config/gameConfig';
import {
  bottomHudBandHeight,
  bottomHudBandTop,
  expandSelectHintToastFontSize,
  rightHudBandWidth,
  topHudBandHeight,
} from '../ui/hudLayout';
import { ToolBar } from '../ui/ToolBar';
import { exceedsDragThreshold } from '../utils/pointerGesture';
import {
  clampScrollToFarmPlayable,
  computeFarmCameraScrollLimits,
  type PlayableBandRect,
} from '../farmCameraScroll';

type FarmMode = 'normal' | 'build' | 'expand' | 'plant';

/** Farm camera zoom limits (wheel dy×0.001, pinch dist×0.005). Default / min zoom ~1.7. */
const MIN_CAMERA_ZOOM = 1.7;
const MAX_CAMERA_ZOOM = 3.0;
/** Padding inside playable HUD band when fitting the farm diamond. */
const FARM_FIT_PAD_X = 10;
const FARM_FIT_PAD_Y = 10;
/** Zoom past strict fit so FARM_SOIL_BOUNDS fills the viewport (less outer water at edges). */
const FARM_INITIAL_ZOOM_BOOST = 1.08;
/** Nudge camera to keep north path/soil apex inside the playable band. */
const FARM_CAMERA_NORTH_BIAS_PX = 44;
export class FarmScene extends Phaser.Scene {
  grid!: GridSystem;
  farming!: FarmingSystem;
  buildSystem!: BuildSystem;
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
  private pendingExpandTile?: { x: number; y: number };
  private toolBar?: ToolBar;

  private tileSprites: Phaser.GameObjects.Image[] = [];
  private tileDebugGraphics?: Phaser.GameObjects.Graphics;
  private clickPickGraphics?: Phaser.GameObjects.Graphics;
  private clickPickLabel?: Phaser.GameObjects.Text;
  private clickPickGx = -1;
  private clickPickGy = -1;
  private cameraDebugLabel?: Phaser.GameObjects.Text;
  private cropSprites = new Map<string, CropSprite>();
  private buildingSprites = new Map<string, BuildingSprite>();
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
  private lastPinchDist = 0;
  /** User panned/zoomed camera — skip auto-recenter on resize until explicit refocus. */
  private cameraScrollTouchedByUser = false;
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
      this.topHudBand(),
      this.bottomHudBand()
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

    syncCropSprites(this, this.grid, this.farming, this.cropSprites);
    renderBuildings(this, this.grid, this.buildSystem.getBuildings(), this.buildingSprites);
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
    });
  }

  /** Logical viewport for layout (scale manager; matches HUD). */
  private getLayoutViewportSize(): { width: number; height: number } {
    const w = this.scale.width;
    const h = this.scale.height;
    return { width: w > 0 ? w : 1, height: h > 0 ? h : 1 };
  }

  /** Keep main camera in sync with scale after hi-DPI resize (avoids stale cam.width). */
  private syncMainCameraViewport(): void {
    const { width, height } = this.getLayoutViewportSize();
    this.cameras.main.setSize(width, height);
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
        const pos = this.grid.gridToScreen(x, y);
        const tile = this.add.image(pos.x, pos.y, 'grass');
        this.tileSprites.push(tile);
        this.applyGroundTileAt(x, y, tile);
      }
    }

    this.renderTileDebugOutlines();
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

  private renderTileDebugOutlines(): void {
    this.tileDebugGraphics?.destroy();
    this.tileDebugGraphics = undefined;
    if (!isFarmGridDebug()) return;

    const g = this.add.graphics();
    const maxGx = this.grid.size - 1;
    const maxGy = this.grid.size - 1;
    g.setDepth(this.grid.getDepth(maxGx, maxGy, 'entities') - 1);
    for (let y = 0; y < this.grid.size; y++) {
      for (let x = 0; x < this.grid.size; x++) {
        const pos = this.grid.gridToScreen(x, y);
        drawIsoTileDebug(g, pos.x, pos.y, 0x00ff88, 0.9);
      }
    }
    this.tileDebugGraphics = g;
  }

  private showClickPickDebug(gx: number, gy: number): void {
    if (!isDebugMode()) return;
    this.clearClickPickDebug();
    this.clickPickGx = gx;
    this.clickPickGy = gy;

    const top = this.grid.gridToScreen(gx, gy);
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

    const topBand = this.topHudBand();
    this.cameraDebugLabel = this.add
      .text(8, topBand + 6, '', {
        fontSize: '11px',
        color: '#aaffcc',
        backgroundColor: '#001a0dcc',
        padding: { x: 6, y: 4 },
        fontFamily: 'monospace',
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(10002);
    this.refreshCameraDebugOverlay();
  }

  private refreshCameraDebugOverlay(): void {
    const label = this.cameraDebugLabel;
    if (!label) return;

    const cam = this.cameras.main;
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    label.setPosition(8, this.topHudBand() + 6);
    label.setText(
      [
        `zoom ${cam.zoom.toFixed(3)} (${MIN_CAMERA_ZOOM}–${MAX_CAMERA_ZOOM})`,
        `scroll ${cam.scrollX.toFixed(1)}, ${cam.scrollY.toFixed(1)}`,
        `view ${viewW}×${viewH}  userPan ${this.cameraScrollTouchedByUser ? 'yes' : 'no'}`,
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
    const top = this.grid.gridToScreen(gx, gy);
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
    this.player = new Player(this, this.grid, 10, 10);
  }

  private setupCamera(): void {
    this.cameraScrollTouchedByUser = false;
    this.focusCameraOnFarmSoil({ recenterCamera: true });
    this.time.delayedCall(0, () => this.focusCameraOnFarmSoil({ recenterCamera: true }));
  }

  /**
   * Re-layout grid + camera after HUD/safe-area/viewport are stable (first load, ui-ready, resize).
   */
  private focusCameraOnFarmSoil(options?: { recenterCamera?: boolean }): void {
    const { width: w, height: h } = this.getLayoutViewportSize();
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
    const anchorBefore = preserveView ? this.grid.getFarmSoilPatchCenterScreen() : null;
    const patchScreenBefore = preserveView
      ? {
          x: (anchorBefore!.x - cam.scrollX) * cam.zoom,
          y: (anchorBefore!.y - cam.scrollY) * cam.zoom,
        }
      : null;

    this.syncMainCameraViewport();
    this.grid.centerInViewport(w, h, this.topHudBand(), this.bottomHudBand());
    this.repositionWorld();

    if (preserveView && patchScreenBefore) {
      const anchorAfter = this.grid.getFarmSoilPatchCenterScreen();
      cam.scrollX = anchorAfter.x - patchScreenBefore.x / cam.zoom;
      cam.scrollY = anchorAfter.y - patchScreenBefore.y / cam.zoom;
      this.clampMainCameraScrollToPlayable();
    } else {
      this.centerCameraOnMap();
    }
    this.layoutBackground();
  }

  /**
   * Fit the full farm soil patch in the playable HUD band, centered on patch center.
   * screen = (world - scroll) * zoom  =>  scroll = world - screen / zoom
   */
  private centerCameraOnMap(): void {
    const cam = this.cameras.main;
    const farm = this.grid.getFarmFootprintScreenBounds();
    const anchor = this.grid.getFarmSoilPatchCenterScreen();
    cam.removeBounds();

    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    const playableLeft = FARM_FIT_PAD_X;
    const topBand = this.topHudBand();
    const bottomBand = this.bottomHudBand();
    const rightBand = this.rightHudBand();
    const playableTop = topBand + FARM_FIT_PAD_Y;
    const playableRight = viewW - rightBand - FARM_FIT_PAD_X;
    const playableBottom = viewH - bottomBand - FARM_FIT_PAD_Y;
    // Match GridSystem.centerInViewport: patch center at viewport center (not playable-band center).
    const targetCenterX = viewW / 2;
    const targetCenterY = (viewH + topBand - bottomBand) / 2;

    const farmW = farm.maxX - farm.minX;
    const farmH = farm.maxY - farm.minY;
    const map = this.grid.getMapScreenBounds();
    const mapW = map.maxX - map.minX;
    const mapH = map.maxY - map.minY;
    const playableW = playableRight - playableLeft;
    const playableH = playableBottom - playableTop;
    const fitZoom = Math.min(playableW / farmW, playableH / farmH);
    const mapCoverZoom = Math.min(playableW / mapW, playableH / mapH);
    const zoom = Phaser.Math.Clamp(
      Math.min(fitZoom * FARM_INITIAL_ZOOM_BOOST, mapCoverZoom),
      MIN_CAMERA_ZOOM,
      MAX_CAMERA_ZOOM
    );

    const idealScroll = (z: number): { x: number; y: number } => ({
      x: anchor.x - targetCenterX / z,
      y: anchor.y - targetCenterY / z,
    });

    cam.setZoom(zoom);
    const scroll = idealScroll(zoom);
    cam.scrollX = scroll.x;
    cam.scrollY = scroll.y;

    cam.scrollY -= FARM_CAMERA_NORTH_BIAS_PX / zoom;
    this.clampMainCameraScroll(farm, {
      playableLeft,
      playableTop,
      playableRight,
      playableBottom,
      zoom,
    });
  }

  private getMainCameraPlayableBand(viewW: number, viewH: number): PlayableBandRect {
    return {
      playableLeft: FARM_FIT_PAD_X,
      playableTop: this.topHudBand() + FARM_FIT_PAD_Y,
      playableRight: viewW - this.rightHudBand() - FARM_FIT_PAD_X,
      playableBottom: viewH - this.bottomHudBand() - FARM_FIT_PAD_Y,
    };
  }

  /** Keep farm footprint inside HUD playable band after layout, pan, or zoom. */
  private clampMainCameraScroll(
    farm: { minX: number; minY: number; maxX: number; maxY: number },
    playable: PlayableBandRect & { zoom: number }
  ): void {
    const cam = this.cameras.main;
    const limits = computeFarmCameraScrollLimits(farm, playable, playable.zoom);
    const next = clampScrollToFarmPlayable(cam.scrollX, cam.scrollY, limits);
    cam.scrollX = next.scrollX;
    cam.scrollY = next.scrollY;
  }

  private clampMainCameraScrollToPlayable(): void {
    const cam = this.cameras.main;
    const farm = this.grid.getFarmFootprintScreenBounds();
    const { width: viewW, height: viewH } = this.getLayoutViewportSize();
    this.clampMainCameraScroll(farm, {
      ...this.getMainCameraPlayableBand(viewW, viewH),
      zoom: cam.zoom,
    });
  }

  private setupToolBar(): void {
    const { width, height } = this.scale;
    this.toolBar = new ToolBar(this, width, height);
    this.toolBar.setSelected(this.selectedTool);
    this.toolBar.setOnChange((tool) => this.setSelectedTool(tool));
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.toolBar?.resize(gameSize.width, gameSize.height);
    this.landUnlockConfirm?.resize();
    this.syncMainCameraViewport();
    this.layoutBackground();
    if (this.resizeLayoutTimer !== undefined) {
      clearTimeout(this.resizeLayoutTimer);
    }
    this.resizeLayoutTimer = setTimeout(() => {
      this.resizeLayoutTimer = undefined;
      if (this.pointerGestureActive || this.isDragging) return;
      this.focusCameraOnFarmSoil();
    }, 100);
  }

  private repositionWorld(): void {
    this.layoutFarmIsland();
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
    this.renderTileDebugOutlines();
    this.refreshClickPickDebug();
    this.refreshCameraDebugOverlay();
    this.expandDimOverlay?.refresh();
  }

  private topHudBand(): number {
    return topHudBandHeight(this.scale.width, this.scale.height);
  }

  private bottomHudBand(): number {
    return bottomHudBandHeight(this.scale.width, this.scale.height);
  }

  private rightHudBand(): number {
    return rightHudBandWidth(this.scale.width, this.scale.height);
  }

  /** Screen Y at which the bottom HUD bar begins (leave taps for UIScene). */
  private bottomHudBandTopY(): number {
    return bottomHudBandTop(this.scale.width, this.scale.height);
  }

  private rightHudBandLeftX(): number {
    return this.scale.width - this.rightHudBand();
  }

  private isPointerInBottomHud(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= this.bottomHudBandTopY();
  }

  private isPointerInRightHud(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= this.rightHudBandLeftX();
  }

  private beginPointerGesture(pointer: Phaser.Input.Pointer): void {
    this.pointerGestureActive = true;
    this.pointerGestureDragged = false;
    this.pointerGestureCancelled = false;
    this.pointerGestureStartX = pointer.x;
    this.pointerGestureStartY = pointer.y;
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
    }
  }

  private panCameraWithPointer(pointer: Phaser.Input.Pointer): void {
    this.cameraScrollTouchedByUser = true;
    const cam = this.cameras.main;
    cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
    cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
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
      this.handleBuildPlace(x, y);
      return;
    }

    if (this.farmMode === 'expand') {
      if (!this.landUnlockConfirm.isVisible()) {
        this.handleExpandLand(x, y);
      }
      return;
    }

    const cell = this.grid.getCell(x, y);
    const building = this.buildSystem.findBuildingAt(x, y);

    if (building && this.farmMode === 'normal') {
      this.dismissFarmPopups();
      this.events.emit('open-upgrade', building);
      return;
    }

    if (this.farmMode === 'normal' && cell && this.isLockedFarmSoil(x, y)) {
      this.handleLockedFarmSoilTap(x, y);
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

      if (this.isPointerInBottomHud(pointer) || this.isPointerInRightHud(pointer)) {
        if (this.farmActionPopup.isVisible() || this.cropSelectPopup.isVisible()) {
          this.dismissFarmPopups();
        }
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

      if (this.handleFarmPopupPointer(pointer)) {
        return;
      }

      this.beginPointerGesture(pointer);
      this.cameraScrollTouchedByUser = true;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildSystem.active) {
        const { x, y } = this.screenPointToGrid(pointer);
        this.buildSystem.updateGhost(x, y);
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
        this.clampMainCameraScrollToPlayable();
      }
      if (wasTap) {
        this.handlePointerTap(pointer);
      }
    });

    this.input.on('pointerupoutside', () => {
      this.endPointerGesture();
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      this.cameraScrollTouchedByUser = true;
      const cam = this.cameras.main;
      cam.setZoom(
        Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM)
      );
      this.clampMainCameraScrollToPlayable();
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
        const cam = this.cameras.main;
        this.cameraScrollTouchedByUser = true;
        const delta = (dist - this.lastPinchDist) * 0.005;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM));
        this.clampMainCameraScrollToPlayable();
        this.lastPinchDist = dist;
      }
    });
  }

  private handleBuildPlace(gx: number, gy: number): void {
    if (!this.buildSystem.canPlace(gx, gy) || !this.buildSystem.selectedItem) return;
    const cost = this.buildSystem.selectedItem.cost;
    if (!this.economy.spend(cost)) {
      this.showToast(`Need ${cost} coins`);
      return;
    }
    const placed = this.buildSystem.place(gx, gy);
    if (placed) {
      this.emitHud();
      this.scheduleSave();
    } else {
      this.economy.earn(cost);
    }
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
    return this.getFarmCameraCenterMetricsForTest();
  }

  /** Dev/e2e: pan camera by screen pixels (same math as pointer drag). */
  panFarmCameraForTest(dxScreen: number, dyScreen: number): void {
    this.cameraScrollTouchedByUser = true;
    const cam = this.cameras.main;
    cam.scrollX -= dxScreen / cam.zoom;
    cam.scrollY -= dyScreen / cam.zoom;
    this.clampMainCameraScrollToPlayable();
  }

  /** Dev/e2e: set zoom keeping a screen anchor fixed (defaults to viewport center). */
  setFarmCameraZoomForTest(
    zoom: number,
    anchorScreenX?: number,
    anchorScreenY?: number
  ): void {
    this.cameraScrollTouchedByUser = true;
    const cam = this.cameras.main;
    const nextZoom = Phaser.Math.Clamp(zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const sx = anchorScreenX ?? viewW / 2;
    const sy = anchorScreenY ?? viewH / 2;
    const worldX = cam.scrollX + sx / cam.zoom;
    const worldY = cam.scrollY + sy / cam.zoom;
    cam.setZoom(nextZoom);
    cam.scrollX = worldX - sx / nextZoom;
    cam.scrollY = worldY - sy / nextZoom;
    this.clampMainCameraScrollToPlayable();
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
  } | null {
    if (!this.grid) return null;
    const cam = this.cameras.main;
    const anchor = this.grid.getFarmSoilPatchCenterScreen();
    const z = cam.zoom;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const topBand = this.topHudBand();
    const bottomBand = this.bottomHudBand();
    const targetCenterX = viewW / 2;
    const targetCenterY = (viewH + topBand - bottomBand) / 2;
    const patchScreenX = (anchor.x - cam.scrollX) * z;
    const patchScreenY = (anchor.y - cam.scrollY) * z;
    return {
      viewW,
      viewH,
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
      zoom: z,
      patchScreenX,
      patchScreenY,
      targetCenterX,
      targetCenterY,
      errorX: patchScreenX - targetCenterX,
      errorY: patchScreenY - targetCenterY,
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
    this.finishFarmInteraction();
  }

  /**
   * Consume pointer when a farm popup is open so the same tap does not walk/dig/open another tile.
   * Popup chrome is handled by its own listeners; backdrop/outside only dismisses.
   */
  /** Bottom bar + hint band — never steal clicks from UIScene HUD. */
  private isPointerOnHud(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= this.scale.height - 80;
  }

  private handleLandUnlockPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.landUnlockConfirm?.isVisible()) return false;
    return this.landUnlockConfirm.handlePointerDown(pointer);
  }

  private handleFarmPopupPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.farmActionPopup.isVisible() && !this.cropSelectPopup.isVisible()) {
      return false;
    }

    if (this.isPointerOnHud(pointer)) {
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

  private handleLockedFarmSoilTap(gx: number, gy: number): void {
    this.dismissFarmPopups();
    this.player.clearOnReach();
    this.pendingFarmTile = undefined;

    const walkTarget = this.findWalkTargetForFarmTile(gx, gy);
    if (!walkTarget) {
      this.showToast('Cannot reach this plot');
      return;
    }

    this.player.moveTo(walkTarget.x, walkTarget.y, this.grid);
    this.showToast('Buy land to unlock');
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

    if (
      this.selectedTool === FarmTool.SEED &&
      this.selectedSeedId &&
      !this.farming.isGrowing(gx, gy) &&
      this.farming.canPlant(gx, gy)
    ) {
      this.pendingFarmTile = { x: gx, y: gy };
      const player = this.player.getGridPosition();
      const runPlant = () => {
        if (!this.pendingFarmTile) return;
        this.tryPlant(this.pendingFarmTile.x, this.pendingFarmTile.y, this.selectedSeedId!);
      };
      if (this.isOnTile(player.x, player.y, gx, gy)) {
        runPlant();
        return;
      }
      const walkTarget = this.findWalkTargetForFarmTile(gx, gy);
      if (!walkTarget) {
        this.showToast('Cannot reach this plot');
        this.finishFarmInteraction();
        return;
      }
      this.player.moveTo(walkTarget.x, walkTarget.y, this.grid, runPlant);
      return;
    }

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
      this.buildSystem.exitBuildMode();
      this.ghostSprite?.setVisible(false);
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
      build: 'Tap to place building',
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
      }
    });
    this.events.on('build-select', (item: BuildItemDef) => {
      this.buildSystem.enterBuildMode(item);
      this.setFarmMode('build');
      this.updateGhostSprite();
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
    const { ghostX, ghostY } = this.buildSystem;
    const foot = this.grid.gridToTileBottom(ghostX, ghostY);
    const key = this.buildSystem.selectedItem?.textureKey ?? 'house_lv1';
    const canPlace = this.buildSystem.canPlace(ghostX, ghostY);

    if (!this.ghostSprite) {
      this.ghostSprite = this.add.sprite(foot.x, foot.y, key);
      this.ghostSprite.setOrigin(0.5, 1);
    }
    this.ghostSprite.setTexture(key);
    fitSpriteDisplay(this.ghostSprite, DISPLAY_SIZE.tileW * 1.4, DISPLAY_SIZE.buildingH);
    this.ghostSprite.setPosition(foot.x, foot.y);
    this.ghostSprite.setAlpha(0.55);
    this.ghostSprite.setTint(canPlace ? 0x88ff88 : 0xff8888);
    this.ghostSprite.setDepth(this.grid.getDepth(ghostX, ghostY, 'buildings') + 50);
    this.ghostSprite.setVisible(this.buildSystem.active);
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
    if (this.cameraDebugLabel) this.refreshCameraDebugOverlay();

    this.player.update(this.grid, delta);

    this.energyPassiveTimer += delta;
    if (this.energyPassiveTimer >= 1000) {
      this.energyPassiveTimer = 0;
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
      this.grid
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

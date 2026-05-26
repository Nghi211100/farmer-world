import Phaser from 'phaser';
import { getCropDef } from '../config/CropConfig';
import {
  DEFAULT_COINS,
  DEFAULT_ENERGY,
  DEFAULT_GEMS,
  FarmTool,
  isDebugMode,
  isFarmGridDebug,
  isPersistentToolBarEnabled,
  PlayerFarmAction,
} from '../config/gameConfig';
import { CropSelectPopup } from '../ui/CropSelectPopup';
import { FarmActionPopup, type FarmPopupAction } from '../ui/FarmActionPopup';
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
  applyIsoTileSprite,
  WATER_GROUND_DISPLAY_SCALE,
  DISPLAY_SIZE,
  drawIsoTileClickPick,
  drawIsoTileDebug,
  fitSpriteDisplay,
  tileCenterFromTop,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../utils/iso';
import { EnergySystem } from '../systems/EnergySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { LandSystem } from '../systems/LandSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type { BuildItemDef } from '../systems/BuildSystem';
import type { BuildingData } from '../config/gameConfig';
import { bottomHudBandHeight, bottomHudBandTop, topHudBandHeight } from '../ui/hudLayout';
import { ToolBar } from '../ui/ToolBar';

type FarmMode = 'normal' | 'build' | 'expand' | 'plant';

/** Farm camera zoom limits (wheel dy×0.001, pinch dist×0.005). */
const MIN_CAMERA_ZOOM = 1.3;
const MAX_CAMERA_ZOOM = 1.7;
/** Screen inset for farm soil bottom-right anchor (góc phải dưới). */
const FARM_ANCHOR_MARGIN_X = 16;
const FARM_ANCHOR_MARGIN_Y = 16;
/** Padding inside playable HUD band when fitting the farm diamond. */
const FARM_FIT_PAD_X = 20;
const FARM_FIT_PAD_Y = 20;
/** World padding around map AABB for background (matches camera bounds pad). */
const BG_WORLD_PAD = 80;

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
  private toolBar?: ToolBar;

  private tileSprites: Phaser.GameObjects.Image[] = [];
  private tileDebugGraphics?: Phaser.GameObjects.Graphics;
  private clickPickGraphics?: Phaser.GameObjects.Graphics;
  private clickPickLabel?: Phaser.GameObjects.Text;
  private clickPickGx = -1;
  private clickPickGy = -1;
  private cropSprites = new Map<string, CropSprite>();
  private buildingSprites = new Map<string, BuildingSprite>();
  private ghostSprite?: Phaser.GameObjects.Sprite;
  private expandHighlight?: Phaser.GameObjects.Rectangle;
  private decorations: ReturnType<typeof renderMapDecorations> = [];
  private backgroundImage?: Phaser.GameObjects.Image;
  private resizeLayoutTimer?: ReturnType<typeof setTimeout>;

  private isDragging = false;
  private lastPinchDist = 0;
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
      this.bottomHudBand(),
      FARM_ANCHOR_MARGIN_X,
      FARM_ANCHOR_MARGIN_Y
    );
    this.setupBackground();
    this.layoutBackground();
    this.renderMap();
    this.setupPlayer();
    this.setupCamera();
    this.layoutBackground();
    this.setupInput();
    this.setupFarmPopups();
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

  /** World-attached background (pans/zooms with farm tiles). */
  private setupBackground(): void {
    this.backgroundImage = this.add
      .image(0, 0, 'ui_background')
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setDepth(-10000);
  }

  /**
   * Size/position background in world space.
   * Baseline at MIN_CAMERA_ZOOM: cover viewport + full camera-bounds AABB (no gaps when zoomed out).
   * displaySize stays fixed in world units; camera zoom scales it on screen like ground tiles.
   */
  private layoutBackground(): void {
    const bg = this.backgroundImage;
    if (!bg) return;

    const viewW = this.scale.width;
    const viewH = this.scale.height;
    if (viewW <= 0 || viewH <= 0) return;

    const mapBounds = this.grid.getMapScreenBounds();
    const worldW = mapBounds.maxX - mapBounds.minX + BG_WORLD_PAD * 2;
    const worldH = mapBounds.maxY - mapBounds.minY + BG_WORLD_PAD * 2;
    const viewWorldW = viewW / MIN_CAMERA_ZOOM;
    const viewWorldH = viewH / MIN_CAMERA_ZOOM;
    const reqW = Math.max(viewWorldW, worldW);
    const reqH = Math.max(viewWorldH, worldH);

    const texW = bg.frame.realWidth || bg.frame.width;
    const texH = bg.frame.realHeight || bg.frame.height;
    if (texW <= 0 || texH <= 0) {
      bg.setDisplaySize(reqW, reqH);
    } else {
      const coverScale = Math.max(reqW / texW, reqH / texH);
      bg.setDisplaySize(texW * coverScale, texH * coverScale);
    }

    bg.setPosition(mapBounds.centerX, mapBounds.centerY);
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

  private applyGroundTileAt(gx: number, gy: number, spr: Phaser.GameObjects.Image): void {
    const cell = this.grid.getCell(gx, gy);
    if (!cell) return;
    if (this.farming.hidesGroundUnderCrop(gx, gy)) {
      spr.setVisible(false);
      return;
    }
    spr.setVisible(true);
    spr.setTexture(
      this.grid.getGroundTextureKey(gx, gy, {
        farmPlotGround: this.farming.showsFarmPlotGround(gx, gy),
        dug: this.farming.isDugEmptySoil(gx, gy),
      })
    );
    const top = this.grid.gridToScreen(gx, gy);
    spr.setPosition(top.x, top.y);
    applyIsoTileSprite(
      spr,
      cell.type === 'water' ? WATER_GROUND_DISPLAY_SCALE : 1
    );
    spr.setDepth(this.grid.getDepth(gx, gy, 'ground'));
  }

  private refreshTileAt(gx: number, gy: number): void {
    const idx = gy * this.grid.size + gx;
    const spr = this.tileSprites[idx];
    if (!spr) return;
    this.applyGroundTileAt(gx, gy, spr);
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
    this.centerCameraOnMap();
  }

  /**
   * Fit farm soil diamond in the playable HUD band with bottom-right anchored on screen.
   * screen = (world - scroll) * zoom  =>  scroll = world - screen / zoom
   */
  private centerCameraOnMap(): void {
    const cam = this.cameras.main;
    const mapBounds = this.grid.getMapScreenBounds();
    const farm = this.grid.getFarmSoilScreenBounds();
    const anchor = this.grid.getFarmSoilBottomRightAnchor();
    const pad = 80;
    cam.setBounds(
      mapBounds.minX - pad,
      mapBounds.minY - pad,
      mapBounds.maxX - mapBounds.minX + pad * 2,
      mapBounds.maxY - mapBounds.minY + pad * 2
    );

    const viewW = cam.width;
    const viewH = cam.height;
    const playableLeft = FARM_FIT_PAD_X;
    const topBand = this.topHudBand();
    const bottomBand = this.bottomHudBand();
    const playableTop = topBand + FARM_FIT_PAD_Y;
    const playableRight = viewW - FARM_FIT_PAD_X;
    const playableBottom = viewH - bottomBand - FARM_FIT_PAD_Y;
    const targetAnchorX = viewW - FARM_ANCHOR_MARGIN_X;
    const targetAnchorY = viewH - bottomBand - FARM_ANCHOR_MARGIN_Y;

    const farmW = farm.maxX - farm.minX;
    const farmH = farm.maxY - farm.minY;
    const fitZoom = Math.min(
      (playableRight - playableLeft) / farmW,
      (playableBottom - playableTop) / farmH
    );
    let zoom = Phaser.Math.Clamp(fitZoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);

    const applyAnchorScroll = (z: number): void => {
      cam.setZoom(z);
      cam.scrollX = anchor.x - targetAnchorX / z;
      cam.scrollY = anchor.y - targetAnchorY / z;
    };

    applyAnchorScroll(zoom);

    const farmScreenMinX = (farm.minX - cam.scrollX) * zoom;
    const farmScreenMinY = (farm.minY - cam.scrollY) * zoom;
    if (farmScreenMinX < playableLeft || farmScreenMinY < playableTop) {
      zoom = Phaser.Math.Clamp(Math.min(fitZoom, zoom), MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
      applyAnchorScroll(zoom);
      if ((farm.minX - cam.scrollX) * zoom < playableLeft) {
        cam.scrollX = farm.minX - playableLeft / zoom;
      }
      if ((farm.minY - cam.scrollY) * zoom < playableTop) {
        cam.scrollY = farm.minY - playableTop / zoom;
      }
    }
  }

  private setupToolBar(): void {
    const { width, height } = this.scale;
    this.toolBar = new ToolBar(this, width, height);
    this.toolBar.setSelected(this.selectedTool);
    this.toolBar.setOnChange((tool) => this.setSelectedTool(tool));
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.toolBar?.resize(gameSize.width, gameSize.height);
    if (this.resizeLayoutTimer !== undefined) {
      clearTimeout(this.resizeLayoutTimer);
    }
    this.resizeLayoutTimer = setTimeout(() => {
      this.resizeLayoutTimer = undefined;
      this.grid.centerInViewport(
        gameSize.width,
        gameSize.height,
        topHudBandHeight(gameSize.width, gameSize.height),
        bottomHudBandHeight(gameSize.width, gameSize.height),
        FARM_ANCHOR_MARGIN_X,
        FARM_ANCHOR_MARGIN_Y
      );
      this.repositionWorld();
      this.centerCameraOnMap();
      this.layoutBackground();
    }, 100);
  }

  private repositionWorld(): void {
    for (let i = 0; i < this.tileSprites.length; i++) {
      const gx = i % this.grid.size;
      const gy = Math.floor(i / this.grid.size);
      this.applyGroundTileAt(gx, gy, this.tileSprites[i]);
    }
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
  }

  private topHudBand(): number {
    return topHudBandHeight(this.scale.width, this.scale.height);
  }

  private bottomHudBand(): number {
    return bottomHudBandHeight(this.scale.width, this.scale.height);
  }

  /** Screen Y at which the bottom HUD bar begins (leave taps for UIScene). */
  private bottomHudBandTopY(): number {
    return bottomHudBandTop(this.scale.width, this.scale.height);
  }

  private isPointerInBottomHud(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= this.bottomHudBandTopY();
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      if (this.toolBar?.hitsPointer(pointer)) {
        return;
      }

      if (this.isPointerInBottomHud(pointer)) {
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
        return;
      }

      if (this.handleFarmPopupPointer(pointer)) {
        return;
      }

      const { x, y } = this.screenPointToGrid(pointer);
      if (isDebugMode()) {
        this.showClickPickDebug(x, y);
      }

      if (this.buildSystem.active && this.buildSystem.selectedItem) {
        this.handleBuildPlace(x, y);
        return;
      }

      if (this.farmMode === 'expand') {
        this.handleExpandLand(x, y);
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
      } else if (!this.buildSystem.active) {
        this.isDragging = true;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildSystem.active) {
        const { x, y } = this.screenPointToGrid(pointer);
        this.buildSystem.updateGhost(x, y);
        this.updateGhostSprite();
      }

      if (this.farmMode === 'expand') {
        const { x, y } = this.screenPointToGrid(pointer);
        this.updateExpandHighlight(x, y);
      }

      if (this.isDragging && pointer.isDown) {
        const cam = this.cameras.main;
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.expandHighlight?.setVisible(false);
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(
        Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM)
      );
    });

    this.input.addPointer(2);

    this.input.on('pointermove', () => {
      if (this.input.pointer1.isDown && this.input.pointer2?.isDown) {
        const dist = Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y
        );
        const cam = this.cameras.main;
        const delta = (dist - this.lastPinchDist) * 0.005;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM));
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

  private handleExpandLand(gx: number, gy: number): void {
    const canUnlock = this.landSystem.canUnlockSoilAt(this.grid, gx, gy);
    const canExpand = this.landSystem.canExpandAt(this.grid, gx, gy);
    const hasLocked = this.grid.getSoilTileCoords().some(({ x, y }) => this.grid.isLockedSoil(x, y));

    if (!canUnlock && !canExpand && !hasLocked) {
      this.showToast('Tap grass next to your farm');
      return;
    }
    if (!canUnlock && !canExpand && hasLocked) {
      this.showToast('Tap locked plot or grass next to farm');
      return;
    }

    const cost = this.economy.getLandCost();
    if (!this.economy.canAfford(cost)) {
      this.showToast(`Need ${cost} coins to buy land`);
      return;
    }
    const spent = this.economy.purchaseLand();
    if (spent === null) return;

    const beforeLocked = new Set(
      this.grid.getSoilTileCoords().filter(({ x, y }) => this.grid.isLockedSoil(x, y)).map(({ x, y }) => `${x},${y}`)
    );
    const result = this.landSystem.purchaseAt(this.grid, gx, gy);
    if (!result.ok) {
      this.economy.earn(spent);
      this.showToast('No land available to buy here');
      return;
    }

    if (result.kind === 'unlock') {
      for (const key of beforeLocked) {
        const [nx, ny] = key.split(',').map(Number);
        if (!this.grid.isLockedSoil(nx, ny)) {
          this.refreshTileAt(nx, ny);
          for (const [ax, ay] of [
            [nx + 1, ny],
            [nx - 1, ny],
            [nx, ny + 1],
            [nx, ny - 1],
          ]) {
            if (this.grid.inBounds(ax, ay)) this.refreshTileAt(ax, ay);
          }
        }
      }
      this.showToast(`Plot unlocked for ${spent} 🪙`);
    } else {
      this.refreshTileAt(gx, gy);
      this.showToast(`Land bought for ${spent} 🪙`);
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
    this.farmPopupsReady = true;
  }

  isFarmPopupsReadyForTest(): boolean {
    return this.farmPopupsReady;
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
    this.farmMode = mode;
    if (mode !== 'build') {
      this.buildSystem.exitBuildMode();
      this.ghostSprite?.setVisible(false);
    }
    const seedHint =
      this.selectedSeedId && this.inventory.cropKindFromSeedId(this.selectedSeedId)
        ? getCropDef(this.inventory.cropKindFromSeedId(this.selectedSeedId)!).name
        : 'a crop';
    const hints: Record<FarmMode, string> = {
      normal: 'Tap farm soil for actions — walk elsewhere',
      build: 'Tap to place building',
      expand: `Buy land (${this.economy.getLandCost()} 🪙) — tap locked plot or grass`,
      plant: this.selectedSeedId
        ? `Seed tool: tap dug soil to plant ${seedHint}`
        : 'Seed tool: pick seed in panel, dig soil, then plant',
    };
    this.events.emit('mode-hint', hints[mode]);
  }

  private setupUISync(): void {
    const ui = this.scene.get('UIScene');
    this.events.on('ui-ready', () => this.emitGameRefs());
    ui.events.on('build-select', (item: BuildItemDef) => {
      this.buildSystem.enterBuildMode(item);
      this.setFarmMode('build');
      this.updateGhostSprite();
    });
    ui.events.on('menu-action', (action: string) => this.handleMenuAction(action));
    ui.events.on('dismiss-farm-popups', () => this.dismissFarmPopups());
    ui.events.on('plant-seed-selected', (seedId: string) => this.tryPlantFromUI(seedId));
    ui.events.on('request-save', () => this.scheduleSave());
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

  private updateExpandHighlight(gx: number, gy: number): void {
    const can =
      this.landSystem.canUnlockSoilAt(this.grid, gx, gy) ||
      this.landSystem.canExpandAt(this.grid, gx, gy);
    const pos = this.grid.gridToTileCenter(gx, gy);
    if (!this.expandHighlight) {
      this.expandHighlight = this.add
        .rectangle(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT, 0x27ae60, 0.35)
        .setOrigin(0.5, 0.5)
        .setDepth(5000);
    }
    this.expandHighlight.setPosition(pos.x, pos.y);
    this.expandHighlight.setFillStyle(can ? 0x27ae60 : 0xe74c3c, 0.35);
    this.expandHighlight.setVisible(this.farmMode === 'expand');
  }

  private showToast(msg: string): void {
    const txt = this.add
      .text(this.scale.width / 2, 80, msg, {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 },
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

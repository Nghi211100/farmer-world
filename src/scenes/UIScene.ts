import Phaser from 'phaser';
import { BottomMenu, type MenuAction } from '../ui/BottomMenu';
import { LeftMenu } from '../ui/LeftMenu';
import { RightMenu } from '../ui/RightMenu';
import { BuildPanel } from '../ui/BuildPanel';
import { InventoryPanel } from '../ui/InventoryPanel';
import { PlantPanel } from '../ui/PlantPanel';
import { SellPanel } from '../ui/SellPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { sceneHitsInteractiveHud } from '../ui/hudPointer';
import { TopHUD } from '../ui/TopHUD';
import type { HUDResources } from '../ui/TopHUD';
import { UpgradePanel } from '../ui/UpgradePanel';
import type { EconomySystem } from '../systems/EconomySystem';
import type { EnergySystem } from '../systems/EnergySystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { BuildingData } from '../config/gameConfig';
import type { AnimalType } from '../config/LivestockConfig';

interface GameRefs {
  inventory: InventorySystem;
  economy: EconomySystem;
  energy: EnergySystem;
  getHud: () => HUDResources;
  canPurchaseLivestock?: (animalType: AnimalType) => { ok: boolean; message: string };
  getLivestockMaxBuyQuantity?: (animalType: AnimalType) => number;
}

export class UIScene extends Phaser.Scene {
  topHUD!: TopHUD;
  leftMenu!: LeftMenu;
  bottomMenu!: BottomMenu;
  rightMenu!: RightMenu;
  inventoryPanel!: InventoryPanel;
  buildPanel!: BuildPanel;
  shopPanel!: ShopPanel;
  sellPanel!: SellPanel;
  plantPanel!: PlantPanel;
  upgradePanel!: UpgradePanel;
  private gameRefs?: GameRefs;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.topHUD = new TopHUD(this, width, height);
    this.scale.on('resize', this.handleResize, this);
    this.leftMenu = new LeftMenu(this, width, height);
    this.bottomMenu = new BottomMenu(this, width, height);
    this.rightMenu = new RightMenu(this, width, height);
    this.inventoryPanel = new InventoryPanel(this, width, height);
    this.buildPanel = new BuildPanel(this, width, height);
    this.shopPanel = new ShopPanel(this, width, height);
    this.sellPanel = new SellPanel(this, width, height);
    this.plantPanel = new PlantPanel(this, width, height);
    this.upgradePanel = new UpgradePanel(this, width, height);

    const onMenu = (action: MenuAction) => this.handleMenu(action);
    this.leftMenu.setOnAction(onMenu);
    this.rightMenu.setOnAction(onMenu);
    this.events.on('test-menu', (action: MenuAction) => this.handleMenu(action));

    this.buildPanel.setOnSelect((item) => {
      const farm = this.scene.get('FarmScene');
      if ('placeTarget' in item) {
        farm.events.emit('livestock-pen-place', item);
      } else {
        farm.events.emit('build-select', item);
      }
      this.buildPanel.hide();
    });

    this.plantPanel.setOnSelect((seedId) => {
      this.scene.get('FarmScene').events.emit('plant-seed-selected', seedId);
    });

    const farm = this.scene.get('FarmScene');
    const refreshHud = () => {
      if (this.gameRefs) this.topHUD.update(this.gameRefs.getHud());
    };

    const requestSave = () => farm.events.emit('request-save');

    this.shopPanel.setOnBuy((result) => {
      if (result.livestockAnimal) {
        farm.events.emit(
          'shop-livestock-stock',
          result.livestockAnimal,
          result.livestockQty ?? 1
        );
      }
      refreshHud();
      requestSave();
    });
    this.sellPanel.setOnSell(() => {
      refreshHud();
      requestSave();
    });

    this.inventoryPanel.setCallbacks({
      onChanged: () => {
        refreshHud();
        requestSave();
      },
      onUseFood: () => {
        refreshHud();
        requestSave();
      },
    });

    this.upgradePanel.setOnUpgrade(() => {
      const building = this.upgradePanel.getBuilding();
      if (building) {
        this.scene.get('FarmScene').events.emit('upgrade-building', building);
        this.upgradePanel.hide();
      }
    });

    farm.events.on('update-hud', (res: HUDResources) => {
      this.topHUD.update(res);
    });
    farm.events.on('register-game', (refs: GameRefs) => {
      this.bindGameRefs(refs);
    });
    farm.events.on(
      'mode-hint',
      (hint: string | { text: string; prominent?: boolean }) => {
        const text = typeof hint === 'string' ? hint : hint.text;
        const prominent = typeof hint === 'string' ? false : Boolean(hint.prominent);
        this.bottomMenu.setModeHint(text, prominent);
      }
    );
    farm.events.on('open-shop', () => {
      if (this.gameRefs) {
        this.shopPanel.show(
          this.gameRefs.economy,
          this.gameRefs.inventory,
          this.gameRefs.getHud()
        );
        this.sellPanel.hide();
        this.inventoryPanel.hide();
      }
    });
    farm.events.on('open-sell', () => {
      if (this.gameRefs) {
        this.closePanels();
        this.inventoryPanel.show(
          this.gameRefs.inventory,
          this.gameRefs.economy,
          this.gameRefs.energy
        );
        this.inventoryPanel.focusSell();
      }
    });
    farm.events.on('open-plant-picker', (seeds: Parameters<PlantPanel['show']>[0]) => {
      this.plantPanel.show(seeds, 'Choose seed, then tap soil');
    });
    farm.events.on('open-upgrade', (building: BuildingData) => {
      if (this.gameRefs) this.upgradePanel.show(building, this.gameRefs.economy);
    });
    farm.events.on('cancel-build-mode', () => {
      this.buildPanel.hide();
    });

    // FarmScene emits register-game in create() before this scene's listeners exist.
    farm.events.emit('ui-ready');
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.topHUD.resize(gameSize.width, gameSize.height);
    this.leftMenu.resize(gameSize.width, gameSize.height);
    this.bottomMenu.resize(gameSize.width, gameSize.height);
    this.rightMenu.resize(gameSize.width, gameSize.height);
    this.inventoryPanel.resize(gameSize.width, gameSize.height);
    this.shopPanel.resize(gameSize.width, gameSize.height);
    this.buildPanel.resize(gameSize.width, gameSize.height);
  }

  /** Called when FarmScene (re)sends register-game after UIScene is listening. */
  bindGameRefs(refs: GameRefs): void {
    this.gameRefs = refs;
    if (refs.canPurchaseLivestock) {
      this.shopPanel.setLivestockPurchaseGate(refs.canPurchaseLivestock);
    }
    if (refs.getLivestockMaxBuyQuantity) {
      this.shopPanel.setLivestockMaxBuyQuantity(refs.getLivestockMaxBuyQuantity);
    }
    this.topHUD.update(refs.getHud());
  }

  isWarehouseModalOpen(): boolean {
    return this.inventoryPanel.isVisible();
  }

  isShopModalOpen(): boolean {
    return this.shopPanel.isVisible();
  }

  isBuildModalOpen(): boolean {
    return this.buildPanel.isVisible();
  }

  /** True when pointer is over a visible interactive HUD control or modal. */
  hitsInteractiveHud(pointer: Phaser.Input.Pointer): boolean {
    return sceneHitsInteractiveHud(this, pointer);
  }

  closeAllModals(): void {
    this.inventoryPanel.hide();
    this.shopPanel.hide();
    this.closePanels();
  }

  private closePanels(): void {
    this.shopPanel.hide();
    this.sellPanel.hide();
    this.plantPanel.hide();
  }

  private handleMenu(action: MenuAction): void {
    const farm = this.scene.get('FarmScene');
    farm.events.emit('dismiss-farm-popups');
    farm.events.emit('menu-action', action);

    if (!this.gameRefs) return;

    if (action === 'inventory') {
      this.closePanels();
      this.inventoryPanel.toggle(
        this.gameRefs.inventory,
        this.gameRefs.economy,
        this.gameRefs.energy
      );
    } else if (action === 'shop') {
      this.shopPanel.show(
        this.gameRefs.economy,
        this.gameRefs.inventory,
        this.gameRefs.getHud()
      );
      this.inventoryPanel.hide();
      this.sellPanel.hide();
      this.plantPanel.hide();
      this.buildPanel.hide();
    } else if (action === 'build') {
      this.buildPanel.toggle();
      this.closePanels();
      this.inventoryPanel.hide();
    } else if (action === 'plant') {
      const seeds = this.gameRefs.inventory.getAvailableSeeds();
      if (seeds.length > 1) {
        this.plantPanel.show(seeds, 'Select seed, then tap soil');
      }
      this.closePanels();
    } else if (action === 'expand') {
      this.closePanels();
    }
  }
}

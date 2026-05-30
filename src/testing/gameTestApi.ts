import type Phaser from 'phaser';
import { ITEM_IDS } from '../config/items';
import type { FarmScene } from '../scenes/FarmScene';
import type { UIScene } from '../scenes/UIScene';
import type {
  FarmActionPopupLayoutMetrics,
  FarmActionPopupVisualMetrics,
} from '../ui/FarmActionPopup';
import type {
  CropSelectPopupLayoutMetrics,
  CropSelectPopupVisualMetrics,
} from '../ui/CropSelectPopup';
import type { WarehouseGridLayoutMetrics, WarehouseTabId } from '../ui/InventoryPanel';
import type { ShopCategoryId, ShopGridLayoutMetrics, ShopLayoutMetrics } from '../ui/ShopPanel';
import { isWarehouseGridDebug, isShopGridDebug, setShopGridDebugForTest } from '../config/gameConfig';

export interface FarmerWorldTestApi {
  clickBag: () => void;
  clickShop: () => void;
  closeModals: () => void;
  openWarehouse: () => void;
  isWarehouseOpen: () => boolean;
  isShopOpen: () => boolean;
  getWarehouseTitle: () => string | null;
  getShopTitle: () => string | null;
  isShopPageLabelVisible: () => boolean | null;
  getShopGridLayout: () => ShopGridLayoutMetrics | null;
  getShopLayoutMetrics: () => ShopLayoutMetrics | null;
  getShopCurrencyBar: () => null;
  getShopDetailPriceBox: () => {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    texture: string;
    unitPriceAmount: string;
    visible: boolean;
  } | null;
  getShopActiveCategory: () => ShopCategoryId | null;
  getShopSelectedItemId: () => string | null;
  getShopVisibleGridCount: () => number | null;
  getShopGridSlot: (slotIndex: number) => { hasCardBg: boolean; hasIcon: boolean; itemId: string | null } | null;
  shopScrollBy: (deltaY: number) => void;
  setShopScroll: (offset: number) => void;
  getShopScrollOffset: () => number | null;
  getShopDetail: () => {
    title: string;
    priceLine: string;
    unitPriceAmount: string;
    buyQuantity: number;
    maxBuyQuantity: number;
    buyEnabled: boolean;
    pageLabel: string;
    pageCount: number;
    currentPage: number;
  } | null;
  getShopDetailStatBgs: () => {
    visible: boolean;
    texture: string;
    width: number;
    height: number;
  }[] | null;
  getShopBuyQuantity: () => number | null;
  clickShopMinus: () => void;
  clickShopPlus: () => void;
  clickShopQtyMinus: () => void;
  clickShopQtyPlus: () => void;
  clickShopQtyField: () => void;
  setShopBuyQuantityInput: (quantity: number) => void;
  getShopBuyQtyControls: () => {
    minus: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
    field: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
    plus: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
  } | null;
  getShopBuyControls: () => {
    buy: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
    minus: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
    field: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
    plus: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      clientCenterX: number;
      clientCenterY: number;
    };
  } | null;
  getShopBuyQtyIcons: () => {
    minus: { width: number; height: number };
    plus: { width: number; height: number; armThickness: number };
  } | null;
  getShopBuyQtyCanvasClick: (target: 'minus' | 'field' | 'plus') => { x: number; y: number } | null;
  getShopBuyQtyHitTest: (target: 'minus' | 'field' | 'plus') => {
    hitsBuyControl: boolean;
    topIsBuyControl: boolean;
    hitCount: number;
    topHitName: string;
  } | null;
  getShopBuyHitTest: (target: 'minus' | 'field' | 'plus' | 'buy') => {
    hitsBuyControl: boolean;
    topIsBuyControl: boolean;
    hitCount: number;
    topHitName: string;
  } | null;
  getShopBuyCanvasClick: (target: 'minus' | 'field' | 'plus' | 'buy') => { x: number; y: number } | null;
  getShopGridCanvasClick: (slotIndex: number) => { x: number; y: number } | null;
  tapShopBuyQtyOnCanvas: (target: 'minus' | 'field' | 'plus') => void;
  tapShopBuyOnCanvas: (target?: 'buy') => void;
  clickShopCategoryTab: (index: number) => void;
  selectShopItem: (itemId: string) => void;
  clickShopGridSlot: (slotIndex: number) => void;
  clickShopPage: (pageIndex: number) => void;
  padShopGridForTest: (extraCount: number) => void;
  clickShopBuy: () => void;
  clickShopClose: () => void;
  getPlayerCoins: () => number | null;
  getWarehouseGridLayout: () => WarehouseGridLayoutMetrics | null;
  getWarehouseUpgradeCost: () => { coins: number; wood: number; stone: number } | null;
  isWarehouseDebugGrid: () => boolean;
  setShopDebugGrid: (enabled: boolean) => void;
  isShopDebugGrid: () => boolean;
  seedWarehouseItems: (count: number) => void;
  setWarehouseScroll: (offset: number) => void;
  warehouseScrollBy: (deltaY: number) => void;
  setWarehouseMinScrollRows: (rows: number) => void;
  getWarehouseSellQuantity: () => number | null;
  setWarehouseSellQuantity: (quantity: number) => void;
  seedWarehouseSellable: (quantity: number) => void;
  clickWarehouseSellControl: (id: 'qtyMinus' | 'qtyPlus' | 'qtyField') => void;
  clickWarehouseClose: () => void;
  clickWarehouseTab: (tabId: WarehouseTabId) => void;
  getWarehouseActiveTab: () => WarehouseTabId | null;
  getWarehouseCapacityFillRatio: () => number | null;
  seedWarehouseItem: (itemId: string, quantity: number) => void;
  selectWarehouseItem: (itemId: string) => void;
  getWarehouseSellFooter: () => {
    name: string;
    owned: number;
    unitPrice: number;
    sellable: boolean;
    useVisible: boolean;
    useLabel: string | null;
  } | null;
  clickWarehouseSellUse: () => void;
  isFarmSceneReady: () => boolean;
  openFarmActionPopup: (gx?: number, gy?: number) => void;
  isFarmActionPopupOpen: () => boolean;
  getFarmActionPopupLayout: () => FarmActionPopupLayoutMetrics | null;
  getFarmActionPopupVisual: () => FarmActionPopupVisualMetrics | null;
  closeFarmActionPopup: () => void;
  openCropSelectPopup: (gx?: number, gy?: number) => void;
  isCropSelectPopupOpen: () => boolean;
  getCropSelectPopupLayout: () => CropSelectPopupLayoutMetrics | null;
  getCropSelectPopupVisual: () => CropSelectPopupVisualMetrics | null;
  closeCropSelectPopup: () => void;
  isToolBarVisible: () => boolean;
  refocusFarmCamera: () => {
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
  } | null;
  getFarmCameraCenterMetrics: () => {
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
  } | null;
  panFarmCamera: (dxScreen: number, dyScreen: number) => void;
  setFarmCameraZoom: (zoom: number, anchorScreenX?: number, anchorScreenY?: number) => void;
  simulateFarmCameraResizeLayout: () => void;
  getFarmViewportDebugMetrics: () => {
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
    mapBounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      centerX: number;
      centerY: number;
    };
    bg: { x: number; y: number; displayW: number; displayH: number } | null;
  } | null;
  /** Dev: force neglect-dry on a tilled plot (gx, gy) for soil moisture visuals. */
  forceSoilIdleDryAt: (gx: number, gy: number) => boolean;
}

declare global {
  interface Window {
    __FARMER_WORLD_TEST__?: FarmerWorldTestApi;
  }
}

function getUiScene(game: Phaser.Game): UIScene | null {
  const scene = game.scene.getScene('UIScene') as UIScene | undefined;
  if (!scene?.inventoryPanel) return null;
  return scene;
}

function getFarmScene(game: Phaser.Game): FarmScene | null {
  return (game.scene.getScene('FarmScene') as FarmScene | undefined) ?? null;
}

const WAREHOUSE_SEED_IDS = [
  ITEM_IDS.SEEDS_WHEAT,
  ITEM_IDS.SEEDS_CORN,
  ITEM_IDS.SEEDS_CARROT,
  ITEM_IDS.SEEDS_PUMPKIN,
  ITEM_IDS.SEEDS_TOMATO,
  ITEM_IDS.WHEAT,
  ITEM_IDS.CORN,
  ITEM_IDS.WOOD,
  ITEM_IDS.STONE,
];

export function installGameTestApi(game: Phaser.Game): void {
  if (!import.meta.env.DEV) return;

  // Playwright runs in dev; keep e2e off DEV auto-grid without affecting manual dev.
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    setShopGridDebugForTest(false);
  }

  window.__FARMER_WORLD_TEST__ = {
    clickBag: () => {
      const ui = getUiScene(game);
      ui?.events.emit('test-menu', 'inventory');
    },
    clickShop: () => {
      const ui = getUiScene(game);
      ui?.events.emit('test-menu', 'shop');
    },
    closeModals: () => getUiScene(game)?.closeAllModals(),
    openWarehouse: () => {
      const ui = getUiScene(game);
      if (!ui) return;
      if (!ui.isWarehouseModalOpen()) ui.events.emit('test-menu', 'inventory');
    },
    isWarehouseOpen: () => getUiScene(game)?.isWarehouseModalOpen() ?? false,
    isShopOpen: () => getUiScene(game)?.isShopModalOpen() ?? false,
    getWarehouseTitle: () =>
      getUiScene(game)?.inventoryPanel.isVisible() ? 'Warehouse' : null,
    getShopTitle: () => (getUiScene(game)?.shopPanel.isVisible() ? 'SHOP' : null),
    isShopPageLabelVisible: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.isPageLabelVisible();
    },
    getShopGridLayout: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getGridLayoutMetrics();
    },
    getShopLayoutMetrics: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getShopLayoutMetrics();
    },
    getShopCurrencyBar: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getCurrencyBarSnapshot();
    },
    getShopDetailPriceBox: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getDetailPriceBoxSnapshot();
    },
    getShopActiveCategory: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getActiveCategory();
    },
    getShopSelectedItemId: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getSelectedItemId();
    },
    getShopVisibleGridCount: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getVisibleGridCount();
    },
    getShopGridSlot: (slotIndex) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getGridSlotSnapshot(slotIndex);
    },
    shopScrollBy: (deltaY) => {
      getUiScene(game)?.shopPanel.scrollBy(deltaY);
    },
    setShopScroll: (offset) => {
      getUiScene(game)?.shopPanel.setScrollOffset(offset);
    },
    getShopScrollOffset: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getScrollOffset();
    },
    getShopDetail: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getDetailSnapshot();
    },
    getShopDetailStatBgs: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getDetailStatBgSnapshot();
    },
    getShopBuyQuantity: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyQuantity();
    },
    clickShopMinus: () => {
      getUiScene(game)?.shopPanel.simulateBuyMinusClick();
    },
    clickShopPlus: () => {
      getUiScene(game)?.shopPanel.simulateBuyPlusClick();
    },
    clickShopQtyMinus: () => {
      getUiScene(game)?.shopPanel.simulateBuyMinusClick();
    },
    clickShopQtyPlus: () => {
      getUiScene(game)?.shopPanel.simulateBuyPlusClick();
    },
    clickShopQtyField: () => {
      getUiScene(game)?.shopPanel.simulateBuyQtyFieldClick();
    },
    setShopBuyQuantityInput: (quantity: number) => {
      getUiScene(game)?.shopPanel.setBuyQuantityInputForTest(quantity);
    },
    getShopBuyQtyControls: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyQtyControlsSnapshot();
    },
    getShopBuyControls: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyControlsSnapshot();
    },
    getShopBuyQtyIcons: () => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyQtyIconDisplaySizes();
    },
    getShopBuyQtyCanvasClick: (target) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyQtyCanvasClickPosition(target);
    },
    getShopBuyQtyHitTest: (target) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyQtyHitTestAt(target);
    },
    getShopBuyHitTest: (target) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyHitTestAt(target);
    },
    getShopBuyCanvasClick: (target) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getBuyCanvasClickPosition(target);
    },
    getShopGridCanvasClick: (slotIndex) => {
      const ui = getUiScene(game);
      if (!ui?.shopPanel.isVisible()) return null;
      return ui.shopPanel.getGridSlotCanvasClickPosition(slotIndex);
    },
    tapShopBuyQtyOnCanvas: (target) => {
      getUiScene(game)?.shopPanel.dispatchCanvasPointerTap(target);
    },
    tapShopBuyOnCanvas: () => {
      getUiScene(game)?.shopPanel.dispatchCanvasPointerTap('buy');
    },
    clickShopCategoryTab: (index) => {
      getUiScene(game)?.shopPanel.simulateCategoryTabClick(index);
    },
    selectShopItem: (itemId) => {
      getUiScene(game)?.shopPanel.selectItemForTest(itemId);
    },
    clickShopGridSlot: (slotIndex) => {
      getUiScene(game)?.shopPanel.simulateGridSlotClick(slotIndex);
    },
    clickShopPage: (pageIndex) => {
      getUiScene(game)?.shopPanel.simulatePageClick(pageIndex);
    },
    padShopGridForTest: (extraCount) => {
      getUiScene(game)?.shopPanel.padGridForTest(extraCount);
    },
    clickShopBuy: () => {
      getUiScene(game)?.shopPanel.simulateBuyClick();
    },
    clickShopClose: () => {
      getUiScene(game)?.shopPanel.simulateCloseClick();
    },
    getPlayerCoins: () => getFarmScene(game)?.economy.getCoins() ?? null,
    getWarehouseGridLayout: () => {
      const ui = getUiScene(game);
      if (!ui?.inventoryPanel.isVisible()) return null;
      return ui.inventoryPanel.getGridLayoutMetrics();
    },
    getWarehouseUpgradeCost: () => {
      const farm = getFarmScene(game);
      return farm?.inventory.warehouse.getUpgradeCost() ?? null;
    },
    isWarehouseDebugGrid: () => isWarehouseGridDebug(),
    setShopDebugGrid: (enabled: boolean) => {
      setShopGridDebugForTest(enabled);
      getUiScene(game)?.shopPanel.refreshDebugGrid();
    },
    isShopDebugGrid: () => isShopGridDebug(),
    seedWarehouseItems: (count: number) => {
      const farm = getFarmScene(game);
      if (!farm) return;
      for (let i = 0; i < count; i++) {
        farm.inventory.add(WAREHOUSE_SEED_IDS[i % WAREHOUSE_SEED_IDS.length], 1);
      }
      const ui = getUiScene(game);
      if (ui?.inventoryPanel.isVisible()) ui.inventoryPanel.repaint();
    },
    setWarehouseScroll: (offset: number) => {
      getUiScene(game)?.inventoryPanel.setScrollOffset(offset);
    },
    warehouseScrollBy: (deltaY: number) => {
      getUiScene(game)?.inventoryPanel.scrollBy(deltaY);
    },
    setWarehouseMinScrollRows: (rows: number) => {
      getUiScene(game)?.inventoryPanel.setMinScrollRows(rows);
    },
    getWarehouseSellQuantity: () => {
      const ui = getUiScene(game);
      if (!ui?.inventoryPanel.isVisible()) return null;
      return ui.inventoryPanel.getSellQuantity();
    },
    setWarehouseSellQuantity: (quantity: number) => {
      getUiScene(game)?.inventoryPanel.setSellQuantityForTest(quantity);
    },
    seedWarehouseSellable: (quantity: number) => {
      const farm = getFarmScene(game);
      const ui = getUiScene(game);
      if (!farm || quantity <= 0) return;
      farm.inventory.add(ITEM_IDS.WHEAT, quantity);
      if (ui?.inventoryPanel.isVisible()) {
        ui.inventoryPanel.focusSell();
        ui.inventoryPanel.repaint();
      }
    },
    clickWarehouseSellControl: (id) => {
      getUiScene(game)?.inventoryPanel.simulateSellControlClick(id);
    },
    clickWarehouseClose: () => {
      getUiScene(game)?.inventoryPanel.simulateCloseClick();
    },
    clickWarehouseTab: (tabId) => {
      getUiScene(game)?.inventoryPanel.simulateTabClick(tabId);
    },
    getWarehouseActiveTab: () => {
      const ui = getUiScene(game);
      if (!ui?.inventoryPanel.isVisible()) return null;
      return ui.inventoryPanel.getActiveTab();
    },
    getWarehouseCapacityFillRatio: () => {
      const ui = getUiScene(game);
      if (!ui?.inventoryPanel.isVisible()) return null;
      return ui.inventoryPanel.getCapacityFillRatio();
    },
    seedWarehouseItem: (itemId: string, quantity: number) => {
      const farm = getFarmScene(game);
      const ui = getUiScene(game);
      if (!farm || quantity <= 0) return;
      farm.inventory.add(itemId, quantity);
      if (ui?.inventoryPanel.isVisible()) ui.inventoryPanel.repaint();
    },
    selectWarehouseItem: (itemId: string) => {
      getUiScene(game)?.inventoryPanel.selectSlotForTest(itemId);
    },
    getWarehouseSellFooter: () => {
      const ui = getUiScene(game);
      if (!ui?.inventoryPanel.isVisible()) return null;
      return ui.inventoryPanel.getSellFooterSnapshot();
    },
    clickWarehouseSellUse: () => {
      getUiScene(game)?.inventoryPanel.simulateSellUseClick();
    },
    isFarmSceneReady: () => getFarmScene(game)?.isFarmPopupsReadyForTest() ?? false,
    openFarmActionPopup: (gx = 7, gy = 9) => {
      getFarmScene(game)?.showFarmActionPopupForTest(gx, gy);
    },
    isFarmActionPopupOpen: () => getFarmScene(game)?.isFarmActionPopupVisible() ?? false,
    getFarmActionPopupLayout: () => getFarmScene(game)?.getFarmActionPopupLayoutForTest() ?? null,
    getFarmActionPopupVisual: () => getFarmScene(game)?.getFarmActionPopupVisualForTest() ?? null,
    closeFarmActionPopup: () => getFarmScene(game)?.closeFarmActionPopupForTest(),
    openCropSelectPopup: (gx = 7, gy = 9) => {
      getFarmScene(game)?.showCropSelectPopupForTest(gx, gy);
    },
    isCropSelectPopupOpen: () => getFarmScene(game)?.isCropSelectPopupVisible() ?? false,
    getCropSelectPopupLayout: () => getFarmScene(game)?.getCropSelectPopupLayoutForTest() ?? null,
    getCropSelectPopupVisual: () => getFarmScene(game)?.getCropSelectPopupVisualForTest() ?? null,
    closeCropSelectPopup: () => getFarmScene(game)?.closeCropSelectPopupForTest(),
    isToolBarVisible: () => getFarmScene(game)?.isToolBarVisibleForTest() ?? false,
    refocusFarmCamera: () => getFarmScene(game)?.refocusFarmCameraForTest() ?? null,
    getFarmCameraCenterMetrics: () =>
      getFarmScene(game)?.getFarmCameraCenterMetricsForTest() ?? null,
    panFarmCamera: (dxScreen, dyScreen) => {
      getFarmScene(game)?.panFarmCameraForTest(dxScreen, dyScreen);
    },
    setFarmCameraZoom: (zoom, anchorScreenX, anchorScreenY) => {
      getFarmScene(game)?.setFarmCameraZoomForTest(zoom, anchorScreenX, anchorScreenY);
    },
    simulateFarmCameraResizeLayout: () => {
      getFarmScene(game)?.simulateFarmCameraResizeLayoutForTest();
    },
    getFarmViewportDebugMetrics: () =>
      getFarmScene(game)?.getFarmViewportDebugMetricsForTest() ?? null,
    forceSoilIdleDryAt: (gx: number, gy: number) =>
      getFarmScene(game)?.forceSoilIdleDryForTest(gx, gy) ?? false,
  };
}

import Phaser from 'phaser';
import { isWarehouseGridDebug, WAREHOUSE, warehouseCapacityForLevel } from '../config/gameConfig';
import {
  FOOD_ENERGY_RECOVERY,
  isFoodItem,
  isSellableResource,
} from '../config/items';
import type { ItemCategory } from '../config/items';
import { HUD_MODAL_DEPTH } from './BottomMenu';
import {
  applyWarehouseTitleLikeSizing,
  warehouseTextStyle,
  warehouseTitleLikeTextStyle,
  warehouseStrokeForColor,
  WAREHOUSE_TITLE_FONT,
} from './warehouseTextStyle';
import type { EconomySystem } from '../systems/EconomySystem';
import type { EnergySystem } from '../systems/EnergySystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { InventorySlot } from '../systems/InventorySystem';
import { computeWarehouseModalPanelSize } from './modalPanelSize';
import { applyImageObjectCover, artPxToScreen, type ObjectCoverCrop } from './ShopPanel';
import {
  getModalTypographyScale,
  scaledFontSize,
  scaledFontSizePx,
} from './uiFontScale';

export type WarehouseTabId = 'all' | ItemCategory;
type TabId = WarehouseTabId;
type SortMode = 'name' | 'quantity';

/** Native size of `ui/warehouse.png` — layout fractions are tuned to this art. */
const WAREHOUSE_ART_W = 1536;
const WAREHOUSE_ART_H = 1024;
/** Screen-pixel nudge for art-aligned inner UI vs warehouse bg (negative = left/up). */
const WAREHOUSE_INNER_OFFSET_X_PX = -10;
const WAREHOUSE_INNER_OFFSET_Y_PX = -10;
/** Additional fraction-of-panel nudge (applied via fracX/fracY; panelBg/dimOverlay unchanged). */
const WAREHOUSE_INNER_OFFSET_X_FRAC = -0.025;
const WAREHOUSE_INNER_OFFSET_Y_FRAC = -0.01;
/** Visible item slots in warehouse grid (10×3 viewport). */
const GRID_COLS = 10;
const GRID_ROWS_VISIBLE = 3;

/** Normalized layout vs 1536×1024 warehouse art (fractions of panel W/H). */
/** Beige item inset on `ui/warehouse.png` (~x 88–1330, y 248–590 for 10×3 viewport). */
const GRID_LEFT_FRAC = 0.057;
const GRID_TOP_FRAC = 0.234;
const GRID_WIDTH_FRAC = 0.886;
/** Visible viewport only (3 rows) — not full scroll content height. */
const GRID_HEIGHT_FRAC = 0.338;
/** Extra art px height for beige grid inset (viewport / scroll mask), not per-item tiles. */
const GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX = 10;

/** Horizontal shrink of slot width vs pitch (art px, scaled at layout). */
const CELL_SLOT_SHRINK_W_ART_PX = 5;
/** Extra display height for `ui_warehouse_item` tiles vs row pitch (art px). */
const CELL_SLOT_HEIGHT_EXTRA_ART_PX = 2;
/** Nudge grid origin downward (art px, positive Y = lower). */
const GRID_TOP_OFFSET_ART_PX = 66;

/** Per-cell overlays vs `ui/warehouse-item.png` (110×110) slot art. */
const WAREHOUSE_ITEM_ART_W = 110;
const WAREHOUSE_ITEM_ART_H = 110;
/** Top band: item icon; bottom band: display name (`slot.label` / ITEM_LABELS). */
const SLOT_ICON_BAND_FRAC = 0.74;
const SLOT_NAME_BAND_FRAC = 0.26;
/** Scale vs baseline 47px max / 0.84 edge fraction (was 2×, now 1.5×). */
const SLOT_ICON_SCALE = 1.5;
/** Cap item icon display size in warehouse art px (scales with panel via `artSpanH`). */
const SLOT_ICON_MAX_ART_PX = Math.round(47 * SLOT_ICON_SCALE);
/** Icon fills most of the shorter slot edge at SLOT_ICON_SCALE. */
const SLOT_ICON_MIN_EDGE_FRAC = 0.84;
/** Nudge icon center downward in art px (positive Y = lower, scaled at layout). */
const SLOT_ICON_OFFSET_Y_ART_PX = 7;
const SLOT_NAME_FONT_BASE_PX = 10;
const DEBUG_LABEL_FONT_BASE_PX = 8;
/** Tan qty pill interior on `ui/warehouse-item.png` (measured art px). */
const SLOT_QTY_BADGE_X0_PX = 85;
const SLOT_QTY_BADGE_X1_PX = 106;
const SLOT_QTY_BADGE_Y0_PX = 70;
const SLOT_QTY_BADGE_Y1_PX = 81;
/** Default qty badge size (1–2 digits); shrinks for hundreds. */
const SLOT_QTY_FONT_BASE_PX = 10;
const SLOT_QTY_FONT_3DIGIT_BASE_PX = 8;

function slotQtyBadgeCenterFrac(): { x: number; y: number } {
  return {
    x: (SLOT_QTY_BADGE_X0_PX + SLOT_QTY_BADGE_X1_PX) / 2 / WAREHOUSE_ITEM_ART_W,
    y: (SLOT_QTY_BADGE_Y0_PX + SLOT_QTY_BADGE_Y1_PX) / 2 / WAREHOUSE_ITEM_ART_H,
  };
}

function slotQtyFontSizePx(count: number, scale: number): number {
  const base = count >= 100 ? SLOT_QTY_FONT_3DIGIT_BASE_PX : SLOT_QTY_FONT_BASE_PX;
  return scaledFontSize(base, scale);
}
const DEBUG_GRID_COLOR = 0xdfe963;
const DEBUG_GRID_ALPHA = 0.72;

/**
 * Sell-preview footer region (fractions vs 1536×1024 `ui_warehouse` art).
 * Horizontal: 40% preview | 60% right column (15px top/bottom, 20px right).
 * Vertical (right column, after 15px gaps): name : owned : sell price = 27 : 21 : 42 of
 * (inset height − 2×gap), normalized to fill the column (weights sum 90).
 */
interface SellFooterCellFrac {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Footer content area on warehouse art (cream sell-preview block). */
const SELL_FOOTER_REGION_X0 = 0.0872;
/** +75px vs prior right edge on 1536px warehouse art (widen sell-preview footer). */
const SELL_FOOTER_REGION_X1 = 0.3444 + 75 / WAREHOUSE_ART_W;
const SELL_FOOTER_REGION_Y0 = 0.669;
/** +70px vs prior 0.819 on 1024px art (expand downward; clear of upgrade panel on the right). */
const SELL_FOOTER_REGION_Y1 = 0.819 + 70 / WAREHOUSE_ART_H;
const SELL_FOOTER_PREVIEW_WIDTH_FRAC = 0.4;
const SELL_FOOTER_BAND_GAP_PX = 15;
/** Band heights as fractions of (right-column content height − 2×gap). */
/** Right-column band weights (normalized; 27 + 21 + 42 = 90). */
const SELL_FOOTER_BAND_WEIGHTS = { name: 0.27, owned: 0.21, price: 0.42 } as const;
const SELL_FOOTER_NAME_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.name;
const SELL_FOOTER_OWNED_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.owned;
const SELL_FOOTER_PRICE_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.price;
/** Right column inset (name / owned / sell price bands and debug overlay). */
const SELL_RIGHT_PAD_TOP = 15;
const SELL_RIGHT_PAD_BOTTOM = 15;
const SELL_RIGHT_PAD_RIGHT = 20;

function buildSellFooterCells(panelH: number, panelW: number): SellFooterCellFrac[] {
  const x0 = SELL_FOOTER_REGION_X0;
  const x1 = SELL_FOOTER_REGION_X1;
  const y0 = SELL_FOOTER_REGION_Y0;
  const y1 = SELL_FOOTER_REGION_Y1;
  const regionW = x1 - x0;
  const splitX = x0 + regionW * SELL_FOOTER_PREVIEW_WIDTH_FRAC;

  const padTopFrac = SELL_RIGHT_PAD_TOP / panelH;
  const padBottomFrac = SELL_RIGHT_PAD_BOTTOM / panelH;
  const padRightFrac = SELL_RIGHT_PAD_RIGHT / panelW;
  const colX0 = splitX;
  const colX1 = x1 - padRightFrac;
  const colY0 = y0 + padTopFrac;
  const colY1 = y1 - padBottomFrac;

  const gapFrac = SELL_FOOTER_BAND_GAP_PX / panelH;
  const regionHFrac = colY1 - colY0;
  const contentHFrac = regionHFrac - 2 * gapFrac;
  const bandWeightSum =
    SELL_FOOTER_NAME_BAND_FRAC + SELL_FOOTER_OWNED_BAND_FRAC + SELL_FOOTER_PRICE_BAND_FRAC;
  const nameHFrac = (contentHFrac * SELL_FOOTER_NAME_BAND_FRAC) / bandWeightSum;
  const ownedHFrac = (contentHFrac * SELL_FOOTER_OWNED_BAND_FRAC) / bandWeightSum;
  const priceHFrac = (contentHFrac * SELL_FOOTER_PRICE_BAND_FRAC) / bandWeightSum;

  const nameY1 = colY0 + nameHFrac;
  const ownedY0 = nameY1 + gapFrac;
  const ownedY1 = ownedY0 + ownedHFrac;
  const priceY0 = ownedY1 + gapFrac;
  const priceY1 = priceY0 + priceHFrac;
  const ownedMidX = colX0 + (colX1 - colX0) / 2;
  const priceMidX = colX0 + (colX1 - colX0) * SELL_PRICE_LEFT_HALF_FRAC;

  return [
    { id: 'preview', x0, y0, x1: splitX, y1 },
    { id: 'name', x0: colX0, y0: colY0, x1: colX1, y1: nameY1 },
    { id: 'ownedLabel', x0: colX0, y0: ownedY0, x1: ownedMidX, y1: ownedY1 },
    { id: 'ownedCount', x0: ownedMidX, y0: ownedY0, x1: colX1, y1: ownedY1 },
    { id: 'sellPrice', x0: colX0, y0: priceY0, x1: colX1, y1: priceY1 },
    { id: 'sellPriceLeft', x0: colX0, y0: priceY0, x1: priceMidX, y1: priceY1 },
    { id: 'sellPriceUse', x0: priceMidX, y0: priceY0, x1: colX1, y1: priceY1 },
  ];
}

const SELL_NAME_FONT_BASE_PX = 14;
const SELL_OWNED_LABEL_FONT_BASE_PX = 14;
const SELL_OWNED_COUNT_FONT_BASE_PX = 16;
const SELL_OWNED_LABEL_OFFSET_ART_PX = 11;
const SELL_PRICE_LABEL_FONT_BASE_PX = 12;
const SELL_PRICE_VALUE_FONT_BASE_PX = 14;
/** Icon fits inside preview frame (fraction of shorter cell edge). */
const SELL_ICON_EDGE_FRAC = 0.68;
/** Max sell-preview icon size in warehouse art px (scales with panel via `artSpanH`). */
const SELL_PREVIEW_ICON_MAX_ART_PX = Math.round(47 * SLOT_ICON_SCALE);
/** Coin icon target size in warehouse art px (1.5× 22px reference). */
const SELL_COIN_ICON_SIZE_ART_PX = Math.round(22 * 1.5);
/** Sell-price band split: label row on top, coin + value below. */
const SELL_PRICE_LABEL_ROW_FRAC = 0.4;
const SELL_PRICE_COIN_ROW_FRAC = 0.6;
const SELL_PRICE_VALUE_PAD_ART_PX = 6;
/** Left inset for sell-price label and coin row (art px). */
const SELL_PRICE_LEFT_PAD_ART_PX = 16;
/** Sell-price band: left half = price label/coin; right half = USE (food). */
const SELL_PRICE_LEFT_HALF_FRAC = 0.5;
const SELL_USE_BTN_FONT_BASE_PX = 14;
/** Inset inside `sellPriceUse` cell when fitting `ui_button` (px). */
const SELL_USE_BTN_INSET_PX = 4;
/** Registered in `assets.ts` as `ui/button.png` (150×78). */
const UI_BUTTON_TEXTURE_KEY = 'ui_button';
/** Registered in `assets.ts` as `ui/coin.png`. */
const COIN_TEXTURE_KEY = 'coin';

/**
 * Center-bottom sell controls (fractions vs 1536×1024 `ui_warehouse` art).
 * `qtyPlus` bounds from orange button pixels in `src/assets/ui/warehouse.png`.
 * `qtyMinus` uses the same W/H as `qtyPlus` (left edge at minus art x0).
 * `qtyField` fills the recessed gap between minus.x1 and plus.x0.
 */
const SELL_QTY_ROW_Y0 = 0.7031;
const SELL_QTY_ROW_Y1 = 0.7656;
const SELL_QTY_MINUS_X0 = 0.3893;
const SELL_QTY_PLUS_X0 = 0.5827;
const SELL_QTY_PLUS_X1 = 0.6257;
const SELL_QTY_BTN_W_FRAC = SELL_QTY_PLUS_X1 - SELL_QTY_PLUS_X0;
const SELL_QTY_MINUS_X1 = SELL_QTY_MINUS_X0 + SELL_QTY_BTN_W_FRAC;
/** Narrow recessed qty gap before + (right edge inset; + bounds unchanged). */
const SELL_QTY_FIELD_WIDTH_SHRINK_PX = 50;
const SELL_QTY_FIELD_X1 = SELL_QTY_PLUS_X0 - SELL_QTY_FIELD_WIDTH_SHRINK_PX / WAREHOUSE_ART_W;
/** Art-pixel nudge for − button center and hit area (qtyField / + unchanged). */
const SELL_QTY_MINUS_OFFSET_ART_PX = 47;
/** Art-pixel nudge for qty field center (recessed gap text). */
const SELL_QTY_FIELD_OFFSET_ART_PX = 50;
/** Shrink SELL / SELL ALL hit areas from bottom (art px). */
const SELL_ACTION_BTN_HEIGHT_SHRINK_ART_PX = 20;
/** Nudge SELL / SELL ALL centers and hit rects downward (art px). */
const SELL_ACTION_BTN_OFFSET_ART_PX = 15;

const SELL_CONTROLS_CELLS: SellFooterCellFrac[] = [
  { id: 'qtyMinus', x0: SELL_QTY_MINUS_X0, y0: SELL_QTY_ROW_Y0, x1: SELL_QTY_MINUS_X1, y1: SELL_QTY_ROW_Y1 },
  {
    id: 'qtyField',
    x0: SELL_QTY_MINUS_X1,
    y0: SELL_QTY_ROW_Y0,
    x1: SELL_QTY_FIELD_X1,
    y1: SELL_QTY_ROW_Y1,
  },
  { id: 'qtyPlus', x0: SELL_QTY_PLUS_X0, y0: SELL_QTY_ROW_Y0, x1: SELL_QTY_PLUS_X1, y1: SELL_QTY_ROW_Y1 },
  { id: 'sellBtn', x0: 0.4108, y0: 0.7598, x1: 0.5202, y1: 0.9004 },
  { id: 'sellAllBtn', x0: 0.5202, y0: 0.7598, x1: 0.6341, y1: 0.9004 },
];

/** Min px for sell qty display + HTML overlay (fraction of field height). */
const SELL_QTY_FIELD_FONT_MIN_PX = 12;
const SELL_QTY_FIELD_FONT_HEIGHT_FRAC = 0.55;
const SELL_ACTION_BTN_FONT_BASE_PX = 17;
const CAPACITY_TEXT_FONT_BASE_PX = 13;
const HEADER_ICON_FONT_BASE_PX = 14;
const SELL_STATUS_FONT_BASE_PX = 11;

function sellQtyFieldFontSizePx(fieldHeightPx: number): number {
  return Math.max(
    SELL_QTY_FIELD_FONT_MIN_PX,
    Math.round(fieldHeightPx * SELL_QTY_FIELD_FONT_HEIGHT_FRAC)
  );
}

/**
 * Right-bottom warehouse upgrade panel (fractions vs 1536×1024 `ui_warehouse` art).
 * Measured from recessed input boxes in `src/assets/ui/warehouse.png`.
 */
const UPGRADE_HIT_REGION = { x0: 0.638, y0: 0.668, x1: 0.924, y1: 0.888 };
const UPGRADE_PANEL_CELLS: SellFooterCellFrac[] = [
  { id: 'upgradeIcon', x0: 0.662, y0: 0.688, x1: 0.748, y1: 0.818 },
  { id: 'levelBox', x0: 0.7572, y0: 0.6924, x1: 0.8932, y1: 0.7295 },
  { id: 'capacityBox', x0: 0.7572, y0: 0.7432, x1: 0.8932, y1: 0.7813 },
  /** Dark-pill text areas (right of icon), measured from `warehouse.png` recessed boxes. */
  { id: 'coinSlot', x0: 0.7044, y0: 0.8223, x1: 0.735, y1: 0.8584 },
  { id: 'woodSlot', x0: 0.776, y0: 0.8223, x1: 0.8118, y1: 0.8584 },
  { id: 'stoneSlot', x0: 0.8542, y0: 0.8233, x1: 0.89, y1: 0.8584 },
];
/** Widen coin cost pill leftward for wider number display (art px). */
const UPGRADE_COIN_SLOT_EXPAND_LEFT_ART_PX = 5;
const UPGRADE_LEVEL_FONT_BASE_PX = 17;
const UPGRADE_CAPACITY_FONT_BASE_PX = 17;
const UPGRADE_COST_FONT_BASE_PX = 15;
const UPGRADE_DEBUG_COLOR = 0x9c27b0;
const UPGRADE_DEBUG_HIT_COLOR = 0x00bcd4;

/**
 * Red X close button on `ui/warehouse.png` (1536×1024), measured from art pixels.
 * Base center ≈ (1405, 120) on art; nudged by CLOSE_BTN_OFFSET_*; radius ~56px scaled to panel width.
 */
/** Extra nudge on warehouse art X (negative = left); ~30px left vs prior +10. */
const CLOSE_BTN_OFFSET_X_PX = -20;
/** Additional close X nudge as fraction of panel width (negative = left). */
const CLOSE_BTN_OFFSET_X_PANEL_FRAC = 0.05;
const CLOSE_BTN_OFFSET_Y_PX = 40;
const CLOSE_BTN_CENTER_X_FRAC = (1405 + CLOSE_BTN_OFFSET_X_PX) / WAREHOUSE_ART_W;
const CLOSE_BTN_CENTER_Y_FRAC = (120 + CLOSE_BTN_OFFSET_Y_PX) / WAREHOUSE_ART_H;
const CLOSE_BTN_RADIUS_ART_PX = 56;

/** Capacity bar on `ui/warehouse.png` — display height is half the art slot, centered vertically. */
const CAPACITY_TRACK_SLOT_Y0_FRAC = 125 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_SLOT_H_FRAC = 134 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_X0_FRAC = 355 / WAREHOUSE_ART_W;
/** Nudge capacity track (`process-empty`) as fraction of panel width (negative = left). */
const CAPACITY_TRACK_OFFSET_X_PANEL_FRAC = -0.01;
const CAPACITY_TRACK_W_FRAC = 668 / WAREHOUSE_ART_W;
const CAPACITY_TRACK_H_FRAC = CAPACITY_TRACK_SLOT_H_FRAC * 0.5;
const CAPACITY_TRACK_Y0_FRAC =
  CAPACITY_TRACK_SLOT_Y0_FRAC + (CAPACITY_TRACK_SLOT_H_FRAC - CAPACITY_TRACK_H_FRAC) / 2;
/** Min vertical gap between capacity track bottom and tab row top (art px). */
const CAPACITY_TAB_MIN_GAP_ART_PX = 8;
/** Green fill art width at 100% vs empty track width. */
const CAPACITY_FILL_MAX_W_FRAC = 398 / WAREHOUSE_ART_W;
/** Fill max width as fraction of track display width (398 / 668 art ratio). */
const CAPACITY_FILL_MAX_TRACK_W_FRAC = CAPACITY_FILL_MAX_W_FRAC / CAPACITY_TRACK_W_FRAC;
/** Horizontal inset of green fill vs `process-empty` track left (art px). */
const CAPACITY_FILL_OFFSET_ART_PX = 42;
/** Extra green fill nudge as fraction of panel width (independent of track offset). */
const CAPACITY_FILL_OFFSET_X_PANEL_FRAC = 0.0075;
/** Extra green fill nudge as fraction of panel height (negative = up). */
const CAPACITY_FILL_OFFSET_Y_PANEL_FRAC = -0.0025;
const CAPACITY_FILL_NUDGE_ART_Y = -2;
const CAPACITY_FILL_H_FRAC = (82 / WAREHOUSE_ART_H) * 0.5;
/** Right pill text anchor along track (fraction of track width from left). */
const CAPACITY_TEXT_TRACK_X_FRAC = 0.84;
/** Nudge capacity count text as fraction of panel width (negative = left). */
const CAPACITY_TEXT_OFFSET_X_PANEL_FRAC = -0.055;
/** Nudge capacity count text as fraction of panel height (negative = up). */
const CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC = -0.0015;
/** Extra width for capacity count pill vs art fraction (art px). */
const CAPACITY_TEXT_PILL_WIDTH_EXTRA_ART_PX = 80;
/** Shift capacity text pill left (art px, negative = left). */
const CAPACITY_TEXT_PILL_OFFSET_ART_PX = -72;
/** Capacity text is centered in pill (origin 0.5, 0.5 at pill center). */
const CAPACITY_TEXT_OFFSET_ART_PX = 4;

/** Category tab row: half art size + extras; row band centered on panel, justify-between inside. */
const TAB_DISPLAY_SCALE = 0.5;
const TAB_EXTRA_W_ART_PX = 68;
const TAB_EXTRA_H_ART_PX = 13;
/** Tab row band on art (first/last tab outer edges); width scaled to modal via `TAB_ROW_SCALE`. */
const TAB_ROW_LEFT_ART_PX = 473 - 266 / 2;
const TAB_ROW_RIGHT_ART_PX = 1352.5 + 263 / 2;
const TAB_ROW_LEFT_FRAC = TAB_ROW_LEFT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_RIGHT_FRAC = TAB_ROW_RIGHT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_SCALE = 0.874;
/** Nudge tab row vertically as fraction of panel height (negative = up). */
const TAB_ROW_OFFSET_Y_PANEL_FRAC = -0.01;

/** Debug overlay depth inside warehouse container. */
const WAREHOUSE_DEBUG_GRID_DEPTH = 10000;
/** Close hit sits on the scene above the modal container so it is never masked/buried. */
const WAREHOUSE_CLOSE_DEPTH = HUD_MODAL_DEPTH + 50;

/** Tab sprites measured from `ui/warehouse.png` (1536×1024); X from row justify-between. */
const WAREHOUSE_TAB_LAYOUT: {
  id: TabId;
  inactiveKey: string;
  activeKey: string;
  centerYFrac: number;
  artW: number;
  artH: number;
}[] = [
  {
    id: 'all',
    inactiveKey: 'ui_tab_all',
    activeKey: 'ui_tab_all_active',
    centerYFrac: 156 / WAREHOUSE_ART_H,
    artW: 266,
    artH: 136,
  },
  {
    id: 'resources',
    inactiveKey: 'ui_tab_resources',
    activeKey: 'ui_tab_resources_active',
    centerYFrac: 169 / WAREHOUSE_ART_H,
    artW: 260,
    artH: 136,
  },
  {
    id: 'seeds',
    inactiveKey: 'ui_tab_seeds',
    activeKey: 'ui_tab_seeds_active',
    centerYFrac: 168 / WAREHOUSE_ART_H,
    artW: 260,
    artH: 136,
  },
  {
    id: 'food',
    inactiveKey: 'ui_tab_food',
    activeKey: 'ui_tab_food_active',
    centerYFrac: 156 / WAREHOUSE_ART_H,
    artW: 260,
    artH: 136,
  },
  {
    id: 'materials',
    inactiveKey: 'ui_tab_materials',
    activeKey: 'ui_tab_materials_active',
    centerYFrac: 157 / WAREHOUSE_ART_H,
    artW: 263,
    artH: 136,
  },
];

/** Shared tab-row baseline Y on warehouse art (mean of tab center Y pixels). */
const TAB_ROW_CENTER_Y_FRAC =
  WAREHOUSE_TAB_LAYOUT.reduce((sum, tab) => sum + tab.centerYFrac, 0) / WAREHOUSE_TAB_LAYOUT.length;

const HEADER_TAB_CELL_ID: Record<TabId, string> = {
  all: 'tabAll',
  resources: 'tabResources',
  seeds: 'tabSeeds',
  food: 'tabFood',
  materials: 'tabMaterials',
  tools: 'tabTools',
};

/** Right pill on `process-empty` track (measured vs 1536×1024 art). */
const CAPACITY_TEXT_PILL_W_FRAC = 84 / WAREHOUSE_ART_W;
const HEADER_DEBUG_TAB_COLOR = 0xff9800;

type CapacityHeaderRectPx = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

/** Base art slot for `process-empty` (fractions → px at layout time). */
function capacityTrackBaseRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  const left = panelLeft + panelW * CAPACITY_TRACK_X0_FRAC + panelW * CAPACITY_TRACK_OFFSET_X_PANEL_FRAC;
  const top = panelTop + panelH * CAPACITY_TRACK_Y0_FRAC;
  const width = panelW * CAPACITY_TRACK_W_FRAC;
  const height = panelH * CAPACITY_TRACK_H_FRAC;
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

/** Display rect: single track aligned to art slot (no extra shrink/offset frames). */
function capacityTrackRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  return capacityTrackBaseRectPx(panelW, panelH, panelLeft, panelTop);
}

function capacityFillRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop);
  const fillHeight = panelH * CAPACITY_FILL_H_FRAC;
  const fillCenterY =
    track.centerY +
    panelH * CAPACITY_FILL_OFFSET_Y_PANEL_FRAC +
    CAPACITY_FILL_NUDGE_ART_Y * (panelH / WAREHOUSE_ART_H);
  const fillTop = fillCenterY - fillHeight / 2;
  const fillMaxWidth = Math.max(
    0,
    track.width * CAPACITY_FILL_MAX_TRACK_W_FRAC -
      CAPACITY_FILL_OFFSET_ART_PX * (panelW / WAREHOUSE_ART_W)
  );
  const fillLeft =
    track.left +
    CAPACITY_FILL_OFFSET_ART_PX * (panelW / WAREHOUSE_ART_W) +
    panelW * CAPACITY_FILL_OFFSET_X_PANEL_FRAC;
  return {
    left: fillLeft,
    top: fillTop,
    width: fillMaxWidth,
    height: fillHeight,
    centerX: fillLeft + fillMaxWidth / 2,
    centerY: fillCenterY,
  };
}

function capacityTextPillRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop);
  const pillWidth =
    panelW * CAPACITY_TEXT_PILL_W_FRAC +
    CAPACITY_TEXT_PILL_WIDTH_EXTRA_ART_PX * (panelW / WAREHOUSE_ART_W);
  const centerX =
    track.left +
    track.width * CAPACITY_TEXT_TRACK_X_FRAC +
    CAPACITY_TEXT_PILL_OFFSET_ART_PX * (panelW / WAREHOUSE_ART_W) +
    panelW * CAPACITY_TEXT_OFFSET_X_PANEL_FRAC;
  const top = track.top;
  const height = track.height;
  return {
    left: centerX - pillWidth / 2,
    top,
    width: pillWidth,
    height,
    centerX,
    centerY: top + height / 2,
  };
}

/** Progress bar + category tab hit areas (`?debugWarehouse=1`). */
function buildWarehouseHeaderCells(): SellFooterCellFrac[] {
  const panelW = WAREHOUSE_ART_W;
  const panelH = WAREHOUSE_ART_H;
  const track = capacityTrackRectPx(panelW, panelH, 0, 0);
  const fill = capacityFillRectPx(panelW, panelH, 0, 0);
  const pill = capacityTextPillRectPx(panelW, panelH, 0, 0);

  return [
    {
      id: 'capacityTrack',
      x0: track.left / panelW,
      y0: track.top / panelH,
      x1: (track.left + track.width) / panelW,
      y1: (track.top + track.height) / panelH,
    },
    {
      id: 'capacityFill',
      x0: fill.left / panelW,
      y0: fill.top / panelH,
      x1: (fill.left + fill.width) / panelW,
      y1: (fill.top + fill.height) / panelH,
    },
    {
      id: 'capacityTextPill',
      x0: pill.left / panelW,
      y0: pill.top / panelH,
      x1: (pill.left + pill.width) / panelW,
      y1: (pill.top + pill.height) / panelH,
    },
  ];
}

const WAREHOUSE_HEADER_CELLS = buildWarehouseHeaderCells();

/** Layout metrics exposed for Playwright / dev tools (screen pixels). */
export interface WarehouseGridLayoutMetrics {
  panelW: number;
  panelH: number;
  panelLeft: number;
  panelTop: number;
  gridLeft: number;
  gridTop: number;
  gridViewportW: number;
  gridViewportH: number;
  gridContentOffsetX: number;
  gridContentW: number;
  cellW: number;
  cellH: number;
  cols: number;
  visibleRows: number;
  scrollOffset: number;
  maxScrollOffset: number;
  slotCount: number;
  debugGrid: boolean;
  sellFooterCells: { id: string; left: number; top: number; width: number; height: number }[];
  sellControlsCells: { id: string; left: number; top: number; width: number; height: number }[];
  upgradePanelCells: { id: string; left: number; top: number; width: number; height: number }[];
  headerCells: { id: string; left: number; top: number; width: number; height: number }[];
  activeTab: WarehouseTabId;
  capacityFillRatio: number;
  capacityText: { x: number; y: number; originX: number; originY: number };
  tabSprites: {
    id: WarehouseTabId;
    cellId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    textureKey: string;
    active: boolean;
  }[];
  closeHit: { centerX: number; centerY: number; radius: number };
  upgradeCostTexts: {
    id: 'coin' | 'wood' | 'stone';
    slotId: string;
    x: number;
    y: number;
    text: string;
  }[];
}

export interface InventoryPanelCallbacks {
  onChanged?: () => void;
  onUseFood?: (itemId: string, energyGained: number) => void;
  /** @deprecated Use inline sell in panel; kept for compatibility */
  onOpenSell?: () => void;
}

export class InventoryPanel {
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private scrollViewport: Phaser.GameObjects.Container;
  private scrollContent: Phaser.GameObjects.Container;
  private itemsBgContainer: Phaser.GameObjects.Container;
  private listContainer: Phaser.GameObjects.Container;
  private scrollMaskGraphics?: Phaser.GameObjects.Graphics;
  private scrollGeometryMask?: Phaser.Display.Masks.GeometryMask;
  private scrollOffset = 0;
  private gridViewportW: number;
  private gridViewportH: number;
  private readonly sceneRef: Phaser.Scene;
  private readonly boundWheel: (
    pointer: Phaser.Input.Pointer,
    _over: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
    _dz: number,
    event?: Event
  ) => void;
  private scrollDragActive = false;
  private scrollDragStartY = 0;
  private scrollDragStartOffset = 0;
  private capacityTrack!: Phaser.GameObjects.Image;
  private capacityFill!: Phaser.GameObjects.Image;
  private capacityText!: Phaser.GameObjects.Text;
  private capacityFillRatio = 0;
  private searchInput = '';
  private activeTab: TabId = 'all';
  private sortMode: SortMode = 'name';
  private inventory?: InventorySystem;
  private economy?: EconomySystem;
  private energy?: EnergySystem;
  private callbacks: InventoryPanelCallbacks = {};
  private tabButtons: {
    id: TabId;
    inactiveKey: string;
    activeKey: string;
    image: Phaser.GameObjects.Image;
  }[] = [];
  private searchLabel!: Phaser.GameObjects.Text;
  private sortLabel!: Phaser.GameObjects.Text;
  private upgradeHit!: Phaser.GameObjects.Rectangle;
  private sellItemIcon!: Phaser.GameObjects.Image;
  private sellItemName!: Phaser.GameObjects.Text;
  private sellOwnedText!: Phaser.GameObjects.Text;
  private sellOwnedCountText!: Phaser.GameObjects.Text;
  private sellPriceLabelText!: Phaser.GameObjects.Text;
  private sellCoinIcon!: Phaser.GameObjects.Image;
  private sellPriceValueText!: Phaser.GameObjects.Text;
  private sellUseBtnImg!: Phaser.GameObjects.Image;
  private sellUseBtn!: Phaser.GameObjects.Text;
  private sellUseZone!: Phaser.GameObjects.Rectangle;
  private sellQtyText!: Phaser.GameObjects.Text;
  private sellMinusZone!: Phaser.GameObjects.Rectangle;
  private sellQtyZone!: Phaser.GameObjects.Rectangle;
  private sellPlusZone!: Phaser.GameObjects.Rectangle;
  /** DOM overlay for mobile/desktop numeric keyboard on qty field tap. */
  private sellQtyInputEl: HTMLInputElement | null = null;
  private sellBtn!: Phaser.GameObjects.Text;
  private sellAllBtn!: Phaser.GameObjects.Text;
  private sellStatusText!: Phaser.GameObjects.Text;
  private upgradeLevelText!: Phaser.GameObjects.Text;
  private upgradeCapacityText!: Phaser.GameObjects.Text;
  private upgradeCoinText!: Phaser.GameObjects.Text;
  private upgradeWoodText!: Phaser.GameObjects.Text;
  private upgradeStoneText!: Phaser.GameObjects.Text;
  private selectedSellId: string | null = null;
  private sellQuantity = 1;
  private viewportW = 0;
  private viewportH = 0;
  private panelW = 0;
  private panelH = 0;
  private panelLeft = 0;
  private panelTop = 0;
  private cx = 0;
  private cy = 0;
  private panelBg!: Phaser.GameObjects.Image;
  private dimOverlay!: Phaser.GameObjects.Rectangle;
  private warehouseCoverCrop: ObjectCoverCrop = {
    texW: WAREHOUSE_ART_W,
    texH: WAREHOUSE_ART_H,
    cropX: 0,
    cropY: 0,
    cropW: WAREHOUSE_ART_W,
    cropH: WAREHOUSE_ART_H,
    scale: 1,
  };
  private scrollHit!: Phaser.GameObjects.Rectangle;
  private gridLeft: number;
  private gridTop: number;
  private gridContentOffsetX = 0;
  private gridContentW: number;
  private cellW: number;
  private cellH: number;
  /** Vertical step between grid rows (viewport / visible rows). */
  private pitchCellH: number;
  private debugGridContainer?: Phaser.GameObjects.Container;
  private sellFooterDebugContainer?: Phaser.GameObjects.Container;
  private upgradePanelDebugContainer?: Phaser.GameObjects.Container;
  private headerDebugContainer?: Phaser.GameObjects.Container;
  private closeHit!: Phaser.GameObjects.Arc;
  private sellFooterCells: SellFooterCellFrac[] = [];
  private readonly sellControlsCells: SellFooterCellFrac[] = SELL_CONTROLS_CELLS;
  private readonly upgradePanelCells: SellFooterCellFrac[] = UPGRADE_PANEL_CELLS;
  private readonly warehouseHeaderCells: SellFooterCellFrac[] = WAREHOUSE_HEADER_CELLS;
  /** Combined viewport tier × panel artSpanH ratio (see `uiFontScale.ts`). */
  private typographyScale = 1;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.sceneRef = scene;
    this.viewportW = width;
    this.viewportH = height;
    this.boundWheel = (pointer, _over, _dx, dy, _dz, event) => {
      if (!this.visible) return;
      if (!this.isPointerInGrid(pointer)) return;
      event?.stopPropagation();
      this.scrollBy(dy);
    };

    this.gridLeft = 0;
    this.gridTop = 0;
    this.gridViewportW = 0;
    this.gridViewportH = 0;
    this.gridContentW = 0;
    this.cellW = 0;
    this.cellH = 0;
    this.pitchCellH = 0;

    this.updatePanelGeometry();

    this.dimOverlay = scene.add.rectangle(this.cx, this.cy, width, height, 0x000000, 0.001);
    this.dimOverlay.setScrollFactor(0);
    this.dimOverlay.setInteractive();

    this.panelBg = scene.add.image(this.cx, this.cy, 'ui_warehouse');
    this.panelBg.setScrollFactor(0);
    this.warehouseCoverCrop = applyImageObjectCover(this.panelBg, this.panelW, this.panelH);
    this.panelBg.setInteractive();

    this.capacityTrack = scene.add
      .image(0, 0, 'ui_process_empty')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.capacityFill = scene.add
      .image(0, 0, 'ui_process_fill')
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.capacityText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', { fontSize: '13px', align: 'center' })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    WAREHOUSE_TAB_LAYOUT.forEach((tab) => {
      const tex = scene.textures.exists(tab.inactiveKey) ? tab.inactiveKey : tab.inactiveKey;
      const img = scene.add
        .image(0, 0, tex)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
        this.setActiveTab(tab.id);
      });
      this.tabButtons.push({
        id: tab.id,
        inactiveKey: tab.inactiveKey,
        activeKey: tab.activeKey,
        image: img,
      });
    });
    this.syncTabSprites();

    this.searchLabel = scene.add
      .text(
        this.fracX(0.06),
        this.fracY(0.138),
        '🔍',
        warehouseTextStyle({ color: '#8b6914', fontSize: '14px', shadow: false })
      )
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.searchLabel.on('pointerdown', () => this.cycleSearch());

    this.sortLabel = scene.add
      .text(
        this.fracX(0.94),
        this.fracY(0.138),
        '⇅',
        warehouseTextStyle({ color: '#8b6914', fontSize: '14px', shadow: false })
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.sortLabel.on('pointerdown', () => {
      this.sortMode = this.sortMode === 'name' ? 'quantity' : 'name';
      this.renderList();
    });

    this.sellItemIcon = scene.add
      .image(0, 0, 'seed')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.sellItemName = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('dark', {
          fontSize: scaledFontSizePx(SELL_NAME_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.sellOwnedText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('dark', {
          fontSize: scaledFontSizePx(SELL_OWNED_LABEL_FONT_BASE_PX, this.typographyScale),
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.sellOwnedCountText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('dark', {
          fontSize: scaledFontSizePx(SELL_OWNED_COUNT_FONT_BASE_PX, this.typographyScale),
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.sellPriceLabelText = scene.add
      .text(
        0,
        0,
        'Sell price:',
        warehouseTitleLikeTextStyle('dark', {
          fontSize: scaledFontSizePx(SELL_PRICE_LABEL_FONT_BASE_PX, this.typographyScale),
        })
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.sellCoinIcon = scene.add
      .image(0, 0, COIN_TEXTURE_KEY)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDisplaySize(
        Math.round(this.artSpanW(SELL_COIN_ICON_SIZE_ART_PX)),
        Math.round(this.artSpanW(SELL_COIN_ICON_SIZE_ART_PX))
      )
      .setVisible(false);

    this.sellPriceValueText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('dark', {
          fontSize: scaledFontSizePx(SELL_PRICE_VALUE_FONT_BASE_PX, this.typographyScale),
        })
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    const useBtnTex = scene.textures.exists(UI_BUTTON_TEXTURE_KEY)
      ? UI_BUTTON_TEXTURE_KEY
      : 'seed';
    this.sellUseBtnImg = scene.add
      .image(0, 0, useBtnTex)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.sellUseBtn = scene.add
      .text(
        0,
        0,
        'USE',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(SELL_USE_BTN_FONT_BASE_PX, this.typographyScale),
          color: '#ffffff',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.sellUseZone = scene.add
      .rectangle(0, 0, 1, 1, 0xff9800, 0.001)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.sellUseZone.on('pointerdown', () => {
      if (this.selectedSellId) this.useFood(this.selectedSellId);
    });

    this.layoutSellFooterElements();

    this.sellQtyText = scene.add
      .text(
        0,
        0,
        '1',
        warehouseTitleLikeTextStyle('dark', { fontSize: `${SELL_QTY_FIELD_FONT_MIN_PX}px` })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.sellMinusZone = this.createSellQtyHitZone(scene, () => this.adjustSellQty(-1));
    this.sellQtyZone = this.createSellQtyHitZone(scene, () => this.openSellQtyInput());
    this.sellPlusZone = this.createSellQtyHitZone(scene, () => this.adjustSellQty(1));

    this.sellBtn = this.makeSellBtn(scene, 'SELL', () => this.sellSelected(this.sellQuantity));
    this.sellAllBtn = this.makeSellBtn(scene, 'SELL ALL', () =>
      this.sellSelected(this.maxSellable())
    );
    this.layoutSellControls();

    this.sellStatusText = scene.add
      .text(
        this.cx,
        this.fracY(0.94),
        '',
        warehouseTextStyle({ color: '#a8e6cf', fontSize: '11px', shadow: false })
      )
      .setOrigin(0.5)
      .setScrollFactor(0);

    const upgradeHitRect = this.sellCellRectPx({
      id: 'upgradeHit',
      ...UPGRADE_HIT_REGION,
    });
    this.upgradeHit = scene.add
      .rectangle(
        upgradeHitRect.centerX,
        upgradeHitRect.centerY,
        upgradeHitRect.width,
        upgradeHitRect.height,
        0x000000,
        0.001
      )
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.upgradeHit.on('pointerdown', () => this.tryUpgrade());

    this.upgradeLevelText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(UPGRADE_LEVEL_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.upgradeCapacityText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(UPGRADE_CAPACITY_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.upgradeCoinText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(UPGRADE_COST_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.upgradeWoodText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(UPGRADE_COST_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.upgradeStoneText = scene.add
      .text(
        0,
        0,
        '',
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(UPGRADE_COST_FONT_BASE_PX, this.typographyScale),
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.scrollViewport = scene.add.container(this.gridLeft, this.gridTop);
    this.scrollViewport.setScrollFactor(0);

    this.scrollContent = scene.add.container(0, 0);
    this.itemsBgContainer = scene.add.container(this.gridContentOffsetX, 0);
    this.listContainer = scene.add.container(this.gridContentOffsetX, 0);
    this.scrollContent.add([this.itemsBgContainer, this.listContainer]);
    this.scrollViewport.add(this.scrollContent);

    // Geometry masks require the graphics object to stay visible (alpha 0 is fine).
    this.scrollMaskGraphics = scene.add.graphics({
      x: this.gridLeft,
      y: this.gridTop,
    });
    this.scrollMaskGraphics.setScrollFactor(0);
    this.scrollMaskGraphics.fillStyle(0xffffff);
    this.scrollMaskGraphics.fillRect(0, 0, this.gridViewportW, this.gridViewportH);
    this.scrollMaskGraphics.setAlpha(0.001);
    this.scrollGeometryMask = this.scrollMaskGraphics.createGeometryMask();
    this.scrollViewport.setMask(this.scrollGeometryMask);

    this.scrollHit = scene.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    this.scrollHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.scrollDragActive = true;
      this.scrollDragStartY = pointer.y;
      this.scrollDragStartOffset = this.scrollOffset;
    });
    this.scrollHit.on('pointerup', () => {
      this.scrollDragActive = false;
    });
    this.scrollHit.on('pointerupoutside', () => {
      this.scrollDragActive = false;
    });
    this.scrollHit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.scrollDragActive) return;
      this.setScrollOffset(this.scrollDragStartOffset - (pointer.y - this.scrollDragStartY));
    });

    scene.input.on('wheel', this.boundWheel);

    const stopHudLeak = (event?: Phaser.Types.Input.EventData) => event?.stopPropagation();

    this.panelBg.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => stopHudLeak(event)
    );
    this.dimOverlay.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => stopHudLeak(event)
    );

    const panelChildren: Phaser.GameObjects.GameObject[] = [
      this.dimOverlay,
      this.panelBg,
      this.capacityTrack,
      this.capacityFill,
      this.capacityText,
      ...this.tabButtons.map((t) => t.image),
      this.searchLabel,
      this.sortLabel,
      this.scrollHit,
      this.scrollViewport,
      this.scrollMaskGraphics,
    ];
    if (this.debugGridContainer) panelChildren.push(this.debugGridContainer);
    if (this.headerDebugContainer) panelChildren.push(this.headerDebugContainer);
    if (this.sellFooterDebugContainer) panelChildren.push(this.sellFooterDebugContainer);
    if (this.upgradePanelDebugContainer) panelChildren.push(this.upgradePanelDebugContainer);
    panelChildren.push(
      this.sellItemIcon,
      this.sellItemName,
      this.sellOwnedText,
      this.sellOwnedCountText,
      this.sellPriceLabelText,
      this.sellCoinIcon,
      this.sellPriceValueText,
      this.sellUseBtnImg,
      this.sellUseBtn,
      this.sellUseZone,
      this.sellQtyText,
      this.sellMinusZone,
      this.sellQtyZone,
      this.sellPlusZone,
      this.sellBtn,
      this.sellAllBtn,
      this.sellStatusText,
      this.upgradeHit,
      this.upgradeLevelText,
      this.upgradeCapacityText,
      this.upgradeCoinText,
      this.upgradeWoodText,
      this.upgradeStoneText
    );
    this.container = scene.add.container(0, 0, panelChildren);
    this.container.setDepth(HUD_MODAL_DEPTH);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    this.closeHit = scene.add
      .circle(0, 0, 1, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(WAREHOUSE_CLOSE_DEPTH)
      .setVisible(false);

    const onClosePointer = (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event?: Phaser.Types.Input.EventData
    ) => {
      stopHudLeak(event);
      this.hide();
    };

    this.closeHit.on('pointerdown', onClosePointer);
    this.closeHit.on('pointerup', onClosePointer);

    this.syncSellFooterDebugGrid();
    this.syncUpgradePanelDebugGrid();
    this.syncHeaderDebugGrid();

    this.layoutWarehousePanel();
  }

  /** Recompute panel geometry and all regions after viewport resize (same pattern as shop). */
  resize(viewportW: number, viewportH: number): void {
    this.viewportW = viewportW;
    this.viewportH = viewportH;
    this.updatePanelGeometry();
    this.layoutWarehousePanel();
    if (this.visible && this.inventory && this.economy && this.energy) {
      this.updateCapacity();
      this.renderList();
      this.refreshSellFooter();
      this.refreshUpgradePanel();
      this.syncSellFooterDebugGrid();
      this.syncUpgradePanelDebugGrid();
      this.syncHeaderDebugGrid();
      this.bringModalHitsToTop();
    }
  }

  private layoutScaleZoom(): number {
    return this.sceneRef.scale.zoom;
  }

  private updatePanelGeometry(): void {
    const zoom = this.layoutScaleZoom();
    ({ panelW: this.panelW, panelH: this.panelH } = computeWarehouseModalPanelSize(
      this.viewportW,
      this.viewportH,
      WAREHOUSE_ART_W,
      WAREHOUSE_ART_H,
      zoom
    ));
    this.cx = this.viewportW / 2;
    this.cy = this.viewportH / 2;
    this.panelLeft = this.cx - this.panelW / 2;
    this.panelTop = this.cy - this.panelH / 2;
    this.sellFooterCells = buildSellFooterCells(this.panelH, this.panelW);
    if (this.panelBg) {
      this.panelBg.setPosition(this.cx, this.cy);
      this.warehouseCoverCrop = applyImageObjectCover(this.panelBg, this.panelW, this.panelH);
    }
    if (this.dimOverlay) {
      this.dimOverlay.setPosition(this.cx, this.cy);
      this.dimOverlay.setSize(this.viewportW, this.viewportH);
    }
  }

  /** Re-layout grid, footer thirds, sell controls, upgrade panel, header, and close. */
  private layoutWarehousePanel(): void {
    const zoom = this.layoutScaleZoom();
    const warehouseModalSize = (w: number, h: number, aw: number, ah: number) =>
      computeWarehouseModalPanelSize(w, h, aw, ah, zoom);
    this.typographyScale = getModalTypographyScale(
      this.viewportW,
      this.viewportH,
      (artPx) => this.artSpanH(artPx),
      WAREHOUSE_ART_W,
      WAREHOUSE_ART_H,
      warehouseModalSize,
      undefined,
      undefined,
      zoom
    );
    this.layoutWarehouseGrid();
    this.layoutWarehouseHeader();
    this.layoutSellFooterElements();
    this.layoutSellControls();
    this.layoutUpgradePanel();
    this.layoutCloseButton();
    this.layoutWarehouseTypography();
    this.sellStatusText.setPosition(this.cx, this.fracY(0.94));
    this.searchLabel.setPosition(this.fracX(0.06), this.fracY(0.138));
    this.sortLabel.setPosition(this.fracX(0.94), this.fracY(0.138));
  }

  private scaleFont(basePx: number): number {
    return scaledFontSize(basePx, this.typographyScale);
  }

  /** Apply responsive font sizes to all warehouse modal labels. */
  private layoutWarehouseTypography(): void {
    applyWarehouseTitleLikeSizing(
      this.capacityText,
      'light',
      this.scaleFont(CAPACITY_TEXT_FONT_BASE_PX)
    );
    this.searchLabel.setFontSize(scaledFontSizePx(HEADER_ICON_FONT_BASE_PX, this.typographyScale));
    this.sortLabel.setFontSize(scaledFontSizePx(HEADER_ICON_FONT_BASE_PX, this.typographyScale));

    applyWarehouseTitleLikeSizing(this.sellItemName, 'dark', this.scaleFont(SELL_NAME_FONT_BASE_PX));
    applyWarehouseTitleLikeSizing(
      this.sellOwnedText,
      'dark',
      this.scaleFont(SELL_OWNED_LABEL_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.sellOwnedCountText,
      'dark',
      this.scaleFont(SELL_OWNED_COUNT_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.sellPriceLabelText,
      'dark',
      this.scaleFont(SELL_PRICE_LABEL_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.sellPriceValueText,
      'dark',
      this.scaleFont(SELL_PRICE_VALUE_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(this.sellUseBtn, 'dark', this.scaleFont(SELL_USE_BTN_FONT_BASE_PX));
    applyWarehouseTitleLikeSizing(
      this.sellBtn,
      'light',
      this.scaleFont(SELL_ACTION_BTN_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.sellAllBtn,
      'light',
      this.scaleFont(SELL_ACTION_BTN_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.upgradeLevelText,
      'light',
      this.scaleFont(UPGRADE_LEVEL_FONT_BASE_PX)
    );
    applyWarehouseTitleLikeSizing(
      this.upgradeCapacityText,
      'light',
      this.scaleFont(UPGRADE_CAPACITY_FONT_BASE_PX)
    );
    const upgradeCostPx = this.scaleFont(UPGRADE_COST_FONT_BASE_PX);
    applyWarehouseTitleLikeSizing(this.upgradeCoinText, 'light', upgradeCostPx);
    applyWarehouseTitleLikeSizing(this.upgradeWoodText, 'light', upgradeCostPx);
    applyWarehouseTitleLikeSizing(this.upgradeStoneText, 'light', upgradeCostPx);
    this.sellStatusText.setFontSize(scaledFontSizePx(SELL_STATUS_FONT_BASE_PX, this.typographyScale));
  }

  private layoutWarehouseGrid(): void {
    const grid = this.rectFromFrac(
      GRID_LEFT_FRAC,
      GRID_LEFT_FRAC + GRID_WIDTH_FRAC,
      GRID_TOP_FRAC,
      GRID_TOP_FRAC + GRID_HEIGHT_FRAC
    );
    this.gridLeft = grid.left;
    this.gridTop = grid.top + this.artSpanH(GRID_TOP_OFFSET_ART_PX);
    this.gridViewportW = grid.width;
    this.gridViewportH = grid.height + this.artSpanH(GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX);
    this.gridContentW = this.gridViewportW;
    const pitchCellW = this.gridContentW / GRID_COLS;
    const pitchCellH = this.gridViewportH / GRID_ROWS_VISIBLE;
    this.pitchCellH = pitchCellH;
    this.cellW = pitchCellW - this.artSpanW(CELL_SLOT_SHRINK_W_ART_PX);
    this.cellH = pitchCellH + this.artSpanH(CELL_SLOT_HEIGHT_EXTRA_ART_PX);
    const totalGridWidth = GRID_COLS * this.cellW;
    this.gridContentOffsetX = (this.gridViewportW - totalGridWidth) / 2;

    this.scrollViewport.setPosition(this.gridLeft, this.gridTop);
    this.itemsBgContainer.setPosition(this.gridContentOffsetX, 0);
    this.listContainer.setPosition(this.gridContentOffsetX, 0);
    this.scrollMaskGraphics?.clear();
    this.scrollMaskGraphics?.fillStyle(0xffffff);
    this.scrollMaskGraphics?.fillRect(0, 0, this.gridViewportW, this.gridViewportH);
    this.scrollMaskGraphics?.setPosition(this.gridLeft, this.gridTop);
    this.scrollHit.setPosition(
      this.gridLeft + this.gridViewportW / 2,
      this.gridTop + this.gridViewportH / 2
    );
    this.scrollHit.setSize(this.gridViewportW, this.gridViewportH);
    this.setScrollOffset(this.scrollOffset);
  }

  private layoutCloseButton(): void {
    const closeX =
      this.fracX(CLOSE_BTN_CENTER_X_FRAC) + this.panelW * CLOSE_BTN_OFFSET_X_PANEL_FRAC;
    const closeY = this.fracY(CLOSE_BTN_CENTER_Y_FRAC);
    const closeRadius = this.spanW(CLOSE_BTN_RADIUS_ART_PX / WAREHOUSE_ART_W);
    this.closeHit.setPosition(closeX, closeY);
    this.closeHit.setRadius(closeRadius);
    this.closeHit.setDepth(WAREHOUSE_CLOSE_DEPTH);
    const hitCircle = new Phaser.Geom.Circle(0, 0, closeRadius);
    if (!this.closeHit.input) {
      this.closeHit.setInteractive({ useHandCursor: true });
    }
    const closeInput = this.closeHit.input;
    if (closeInput) {
      closeInput.hitArea = hitCircle;
      closeInput.hitAreaCallback = Phaser.Geom.Circle.Contains;
    }
  }

  /** Keep tab hits above panel bg/masks; close lives on the scene above the container. */
  private bringModalHitsToTop(): void {
    for (const tab of this.tabButtons) {
      this.container.bringToTop(tab.image);
    }
    const viewportIdx = this.container.getIndex(this.scrollViewport);
    const scrollHitIdx = this.container.getIndex(this.scrollHit);
    if (viewportIdx >= 0 && scrollHitIdx >= 0 && scrollHitIdx >= viewportIdx) {
      this.container.moveTo(this.scrollHit, viewportIdx);
    }
    this.closeHit.setDepth(WAREHOUSE_CLOSE_DEPTH);
    this.sceneRef.children.bringToTop(this.closeHit);
  }

  private upgradeCostTextPosition(
    slotId: 'coinSlot' | 'woodSlot' | 'stoneSlot'
  ): { x: number; y: number } {
    const cell = this.upgradePanelCellRectPx(this.getUpgradePanelCell(slotId));
    return { x: cell.centerX, y: cell.centerY };
  }

  private artToScreen(artX: number, artY: number): { x: number; y: number } {
    return artPxToScreen(
      artX,
      artY,
      this.warehouseCoverCrop,
      this.panelLeft,
      this.panelTop,
      this.panelW,
      this.panelH
    );
  }

  /** Art fraction (0–1 of 1536×1024) → screen X through object-cover crop. */
  private fracX(f: number): number {
    return (
      this.artToScreen(f * WAREHOUSE_ART_W, 0).x +
      WAREHOUSE_INNER_OFFSET_X_PX +
      WAREHOUSE_INNER_OFFSET_X_FRAC * this.panelW
    );
  }

  /** Art fraction (0–1 of 1536×1024) → screen Y through object-cover crop. */
  private fracY(f: number): number {
    return (
      this.artToScreen(0, f * WAREHOUSE_ART_H).y +
      WAREHOUSE_INNER_OFFSET_Y_PX +
      WAREHOUSE_INNER_OFFSET_Y_FRAC * this.panelH
    );
  }

  private spanW(fracW: number): number {
    return Math.abs(this.fracX(fracW) - this.fracX(0));
  }

  private spanH(fracH: number): number {
    return Math.abs(this.fracY(fracH) - this.fracY(0));
  }

  private artSpanW(artPx: number): number {
    return this.spanW(artPx / WAREHOUSE_ART_W);
  }

  private artSpanH(artPx: number): number {
    return this.spanH(artPx / WAREHOUSE_ART_H);
  }

  private rectFromFrac(
    x0: number,
    x1: number,
    y0: number,
    y1: number
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const left = this.fracX(x0);
    const top = this.fracY(y0);
    const width = this.fracX(x1) - left;
    const height = this.fracY(y1) - top;
    return { left, top, width, height, centerX: left + width / 2, centerY: top + height / 2 };
  }

  private sellCellRectPx(cell: SellFooterCellFrac): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const left = this.fracX(cell.x0);
    const top = this.fracY(cell.y0);
    const width = this.fracX(cell.x1) - left;
    const height = this.fracY(cell.y1) - top;
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  private upgradePanelCellRectPx(cell: SellFooterCellFrac): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const rect = this.sellCellRectPx(cell);
    if (cell.id !== 'coinSlot') return rect;
    const expand = this.artSpanW(UPGRADE_COIN_SLOT_EXPAND_LEFT_ART_PX);
    const left = rect.left - expand;
    const width = rect.width + expand;
    return {
      ...rect,
      left,
      width,
      centerX: left + width / 2,
    };
  }

  private getSellFooterCell(id: string): SellFooterCellFrac {
    const cell = this.sellFooterCells.find((c) => c.id === id);
    if (!cell) throw new Error(`Unknown sell footer cell: ${id}`);
    return cell;
  }

  private getSellControlsCell(id: string): SellFooterCellFrac {
    const cell = this.sellControlsCells.find((c) => c.id === id);
    if (!cell) throw new Error(`Unknown sell controls cell: ${id}`);
    return cell;
  }

  private sellQtyMinusRectPx(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellCellRectPx(this.getSellControlsCell('qtyMinus'));
    return {
      ...base,
      left: base.left + this.artSpanW(SELL_QTY_MINUS_OFFSET_ART_PX),
      centerX: base.centerX + this.artSpanW(SELL_QTY_MINUS_OFFSET_ART_PX),
    };
  }

  private sellQtyFieldRectPx(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellCellRectPx(this.getSellControlsCell('qtyField'));
    return {
      ...base,
      left: base.left + this.artSpanW(SELL_QTY_FIELD_OFFSET_ART_PX),
      centerX: base.centerX + this.artSpanW(SELL_QTY_FIELD_OFFSET_ART_PX),
    };
  }

  private sellActionBtnRectPx(id: 'sellBtn' | 'sellAllBtn'): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellCellRectPx(this.getSellControlsCell(id));
    const height = Math.max(1, base.height - this.artSpanH(SELL_ACTION_BTN_HEIGHT_SHRINK_ART_PX));
    const top = base.top + this.artSpanH(SELL_ACTION_BTN_OFFSET_ART_PX);
    return {
      left: base.left,
      top,
      width: base.width,
      height,
      centerX: base.centerX,
      centerY: top + height / 2,
    };
  }

  private getUpgradePanelCell(id: string): SellFooterCellFrac {
    const cell = this.upgradePanelCells.find((c) => c.id === id);
    if (!cell) throw new Error(`Unknown upgrade panel cell: ${id}`);
    return cell;
  }

  private getWarehouseHeaderCell(id: string): SellFooterCellFrac {
    const cell = this.warehouseHeaderCells.find((c) => c.id === id);
    if (!cell) throw new Error(`Unknown warehouse header cell: ${id}`);
    return cell;
  }

  private layoutCapacityTrackRectPx(): CapacityHeaderRectPx {
    const base = this.rectFromFrac(
      CAPACITY_TRACK_X0_FRAC,
      CAPACITY_TRACK_X0_FRAC + CAPACITY_TRACK_W_FRAC,
      CAPACITY_TRACK_Y0_FRAC,
      CAPACITY_TRACK_Y0_FRAC + CAPACITY_TRACK_H_FRAC
    );
    const trackOffsetX = this.panelW * CAPACITY_TRACK_OFFSET_X_PANEL_FRAC;
    return {
      left: base.left + trackOffsetX,
      top: base.top,
      width: base.width,
      height: base.height,
      centerX: base.centerX + trackOffsetX,
      centerY: base.centerY,
    };
  }

  private layoutCapacityFillRectPx(): CapacityHeaderRectPx {
    const track = this.layoutCapacityTrackRectPx();
    const fillHeight = this.artSpanH(82) * 0.5;
    const fillCenterY =
      track.centerY +
      this.artSpanH(CAPACITY_FILL_NUDGE_ART_Y) +
      this.panelH * CAPACITY_FILL_OFFSET_Y_PANEL_FRAC;
    const fillTop = fillCenterY - fillHeight / 2;
    const fillMaxWidth = Math.max(
      0,
      track.width * CAPACITY_FILL_MAX_TRACK_W_FRAC - this.artSpanW(CAPACITY_FILL_OFFSET_ART_PX)
    );
    const fillLeft =
      track.left + this.artSpanW(CAPACITY_FILL_OFFSET_ART_PX) + this.panelW * CAPACITY_FILL_OFFSET_X_PANEL_FRAC;
    return {
      left: fillLeft,
      top: fillTop,
      width: fillMaxWidth,
      height: fillHeight,
      centerX: fillLeft + fillMaxWidth / 2,
      centerY: fillCenterY,
    };
  }

  private layoutCapacityTextPillRectPx(): CapacityHeaderRectPx {
    const track = this.layoutCapacityTrackRectPx();
    const pillWidth =
      this.artSpanW(CAPACITY_TEXT_PILL_W_FRAC * WAREHOUSE_ART_W) +
      this.artSpanW(CAPACITY_TEXT_PILL_WIDTH_EXTRA_ART_PX);
    const centerX =
      track.left +
      track.width * CAPACITY_TEXT_TRACK_X_FRAC +
      this.artSpanW(CAPACITY_TEXT_PILL_OFFSET_ART_PX) +
      this.panelW * CAPACITY_TEXT_OFFSET_X_PANEL_FRAC;
    const top = track.top;
    const height = track.height;
    return {
      left: centerX - pillWidth / 2,
      top,
      width: pillWidth,
      height,
      centerX,
      centerY: top + height / 2,
    };
  }

  private warehouseHeaderCellRectPx(id: string): CapacityHeaderRectPx {
    if (id === 'capacityTrack') return this.layoutCapacityTrackRectPx();
    if (id === 'capacityFill') return this.layoutCapacityFillRectPx();
    if (id === 'capacityTextPill') return this.layoutCapacityTextPillRectPx();
    return this.sellCellRectPx(this.getWarehouseHeaderCell(id));
  }

  /**
   * Tab display size: panelW × (artW/1536) × scale, panelH × (artH/1024) × scale.
   */
  private tabDisplaySizePx(tab: (typeof WAREHOUSE_TAB_LAYOUT)[number]): { w: number; h: number } {
    return {
      w: this.artSpanW(tab.artW) * TAB_DISPLAY_SCALE + this.artSpanW(TAB_EXTRA_W_ART_PX),
      h: this.artSpanH(tab.artH) * TAB_DISPLAY_SCALE + this.artSpanH(TAB_EXTRA_H_ART_PX),
    };
  }

  /** Tab row band: art band width × scale, centered on panel; justify-between inside. */
  private layoutTabRowBandPx(): { rowLeft: number; rowWidth: number } {
    const rowLeftBase = this.fracX(TAB_ROW_LEFT_FRAC);
    const rowRightBase = this.fracX(TAB_ROW_RIGHT_FRAC);
    const fullWidth = rowRightBase - rowLeftBase;
    const rowWidth = fullWidth * TAB_ROW_SCALE;
    const panelCenterX = this.fracX(0.5);
    const rowLeft = panelCenterX - rowWidth / 2;
    return { rowLeft, rowWidth };
  }

  private tabRowCenterYPx(tabH: number): number {
    const track = this.layoutCapacityTrackRectPx();
    const minCenterY =
      track.top + track.height + this.artSpanH(CAPACITY_TAB_MIN_GAP_ART_PX) + tabH / 2;
    return (
      Math.max(this.fracY(TAB_ROW_CENTER_Y_FRAC), minCenterY) +
      this.panelH * TAB_ROW_OFFSET_Y_PANEL_FRAC
    );
  }

  /** Tab row: justify-between across scaled row band; shared baseline Y below capacity. */
  private tabSpriteRectPx(index: number, tab: (typeof WAREHOUSE_TAB_LAYOUT)[number]): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const size = this.tabDisplaySizePx(tab);
    const { rowLeft, rowWidth } = this.layoutTabRowBandPx();
    const n = WAREHOUSE_TAB_LAYOUT.length;
    const left =
      n <= 1
        ? rowLeft + (rowWidth - size.w) / 2
        : rowLeft + (index * (rowWidth - size.w)) / (n - 1);
    const sharedCenterY = this.tabRowCenterYPx(size.h);
    const centerX = left + size.w / 2;
    return {
      left,
      top: sharedCenterY - size.h / 2,
      width: size.w,
      height: size.h,
      centerX,
      centerY: sharedCenterY,
    };
  }

  /** Align capacity track/fill/pill and tab sprites to header layout. */
  private layoutWarehouseHeader(): void {
    const trackCell = this.layoutCapacityTrackRectPx();
    this.capacityTrack.setPosition(trackCell.centerX, trackCell.centerY);
    this.capacityTrack.setDisplaySize(trackCell.width, trackCell.height);

    const fillCell = this.layoutCapacityFillRectPx();
    const fillW = fillCell.width * this.capacityFillRatio;
    this.capacityFill.setPosition(fillCell.left, fillCell.centerY);
    this.capacityFill.setDisplaySize(fillW, fillCell.height);
    this.capacityFill.setVisible(fillW > 0.5);

    const pill = this.layoutCapacityTextPillRectPx();
    this.capacityText
      .setOrigin(0.5, 0.5)
      .setPosition(
        pill.centerX + this.artSpanW(CAPACITY_TEXT_OFFSET_ART_PX),
        pill.centerY + this.panelH * CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC
      );

    WAREHOUSE_TAB_LAYOUT.forEach((layout, index) => {
      const tab = this.tabButtons.find((t) => t.id === layout.id);
      if (!tab) return;
      const rect = this.tabSpriteRectPx(index, layout);
      tab.image.setPosition(rect.centerX, rect.centerY);
      tab.image.setDisplaySize(rect.width, rect.height);
    });
  }

  private setActiveTab(tabId: TabId): void {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    this.syncTabSprites();
    this.renderList();
  }

  /** Right-bottom upgrade labels centered in recessed art slots. */
  private layoutUpgradePanel(): void {
    const level = this.sellCellRectPx(this.getUpgradePanelCell('levelBox'));
    const capacity = this.sellCellRectPx(this.getUpgradePanelCell('capacityBox'));
    this.upgradeLevelText.setPosition(level.centerX, level.centerY);
    this.upgradeLevelText.setWordWrapWidth(level.width * 0.94);

    this.upgradeCapacityText.setPosition(capacity.centerX, capacity.centerY);
    this.upgradeCapacityText.setWordWrapWidth(capacity.width * 0.94);

    const coinPos = this.upgradeCostTextPosition('coinSlot');
    const woodPos = this.upgradeCostTextPosition('woodSlot');
    const stonePos = this.upgradeCostTextPosition('stoneSlot');
    this.upgradeCoinText.setPosition(coinPos.x, coinPos.y);
    this.upgradeWoodText.setPosition(woodPos.x, woodPos.y);
    this.upgradeStoneText.setPosition(stonePos.x, stonePos.y);

    const hit = this.sellCellRectPx({ id: 'upgradeHit', ...UPGRADE_HIT_REGION });
    this.upgradeHit.setPosition(hit.centerX, hit.centerY);
    this.upgradeHit.setSize(hit.width, hit.height);
  }

  /** Center-bottom qty / sell buttons aligned to baked art placeholders. */
  private layoutSellControls(): void {
    const minus = this.sellQtyMinusRectPx();
    const field = this.sellQtyFieldRectPx();
    const plus = this.sellCellRectPx(this.getSellControlsCell('qtyPlus'));
    const sell = this.sellActionBtnRectPx('sellBtn');
    const sellAll = this.sellActionBtnRectPx('sellAllBtn');

    // qtyMinus / qtyPlus hit zones only (art shows −/+); qty centered in qtyField.
    const qtyFontPx = sellQtyFieldFontSizePx(field.height);
    applyWarehouseTitleLikeSizing(this.sellQtyText, 'dark', qtyFontPx);
    this.sellQtyText.setOrigin(0.5, 0.5).setPosition(field.centerX, field.centerY);
    this.sellBtn.setPosition(sell.centerX, sell.centerY);
    this.sellAllBtn.setPosition(sellAll.centerX, sellAll.centerY);

    this.layoutSellQtyHitZone(this.sellMinusZone, minus);
    this.layoutSellQtyHitZone(this.sellQtyZone, field);
    this.layoutSellQtyHitZone(this.sellPlusZone, plus);
    this.setSellControlHitArea(this.sellBtn, sell);
    this.setSellControlHitArea(this.sellAllBtn, sellAll);
  }

  private createSellQtyHitZone(
    scene: Phaser.Scene,
    onPointerDown: () => void
  ): Phaser.GameObjects.Rectangle {
    const zone = scene.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onPointerDown);
    return zone;
  }

  private layoutSellQtyHitZone(
    zone: Phaser.GameObjects.Rectangle,
    cell: { width: number; height: number; centerX: number; centerY: number }
  ): void {
    zone.setPosition(cell.centerX, cell.centerY);
    zone.setSize(cell.width, cell.height);
  }

  private setSellControlHitArea(
    target: Phaser.GameObjects.Text,
    cell: { width: number; height: number }
  ): void {
    if (!target.input) return;
    const hit = new Phaser.Geom.Rectangle(
      -cell.width / 2,
      -cell.height / 2,
      cell.width,
      cell.height
    );
    target.input.hitArea = hit;
    target.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
  }

  private setSellFooterSellControlsEnabled(enabled: boolean): void {
    const zones = [this.sellMinusZone, this.sellQtyZone, this.sellPlusZone];
    for (const zone of zones) {
      if (zone.input) zone.input.enabled = enabled;
    }
    for (const btn of [this.sellBtn, this.sellAllBtn]) {
      if (btn.input) btn.input.enabled = enabled;
    }
  }

  private setSellUseControlEnabled(enabled: boolean): void {
    if (this.sellUseZone.input) this.sellUseZone.input.enabled = enabled;
    if (this.sellUseBtn.input) this.sellUseBtn.input.enabled = enabled;
  }

  /** Position sell-preview footer widgets to computed band cells. */
  private layoutSellFooterElements(): void {
    const preview = this.sellCellRectPx(this.getSellFooterCell('preview'));
    const name = this.sellCellRectPx(this.getSellFooterCell('name'));
    const ownedLabel = this.sellCellRectPx(this.getSellFooterCell('ownedLabel'));
    const ownedCount = this.sellCellRectPx(this.getSellFooterCell('ownedCount'));
    const priceLeft = this.sellCellRectPx(this.getSellFooterCell('sellPriceLeft'));
    const priceUse = this.sellCellRectPx(this.getSellFooterCell('sellPriceUse'));

    const iconSize = this.computeSellPreviewIconSize();
    this.sellItemIcon.setPosition(preview.centerX, preview.centerY);
    this.sellItemIcon.setDisplaySize(iconSize, iconSize);

    this.sellItemName.setPosition(name.centerX, name.centerY);
    this.sellItemName.setWordWrapWidth(name.width * 0.92);

    this.sellOwnedText.setPosition(
      ownedLabel.centerX + this.artSpanW(SELL_OWNED_LABEL_OFFSET_ART_PX),
      ownedLabel.centerY
    );
    this.sellOwnedCountText.setPosition(ownedCount.centerX, ownedCount.centerY);

    const labelBandH = priceLeft.height * SELL_PRICE_LABEL_ROW_FRAC;
    const coinBandH = priceLeft.height * SELL_PRICE_COIN_ROW_FRAC;
    const sellPriceLabelRowY = priceLeft.top + labelBandH / 2;
    const sellPriceCoinRowY = priceLeft.top + labelBandH + coinBandH / 2;
    const sellPriceContentLeft = priceLeft.left + this.artSpanW(SELL_PRICE_LEFT_PAD_ART_PX);

    this.sellPriceLabelText.setPosition(sellPriceContentLeft, sellPriceLabelRowY);

    const coinSize = Math.round(this.artSpanW(SELL_COIN_ICON_SIZE_ART_PX));
    this.sellCoinIcon.setDisplaySize(coinSize, coinSize);
    this.sellCoinIcon.setPosition(sellPriceContentLeft + coinSize / 2, sellPriceCoinRowY);
    this.sellPriceValueText.setPosition(
      sellPriceContentLeft + coinSize + this.artSpanW(SELL_PRICE_VALUE_PAD_ART_PX),
      sellPriceCoinRowY
    );

    this.layoutSellUseButton(priceUse);
  }

  /** Scale `ui_button` to fit `sellPriceUse` (right half of price row), centered. */
  private layoutSellUseButton(cell: {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }): void {
    const maxW = Math.max(1, cell.width - SELL_USE_BTN_INSET_PX * 2);
    const maxH = Math.max(1, cell.height - SELL_USE_BTN_INSET_PX * 2);
    const frame = this.sellUseBtnImg.frame;
    const fw = frame.realWidth || frame.width;
    const fh = frame.realHeight || frame.height;
    const scale = fw > 0 && fh > 0 ? Math.min(maxW / fw, maxH / fh) : 1;
    const dw = Math.round(fw * scale);
    const dh = Math.round(fh * scale);
    this.sellUseBtnImg.setDisplaySize(dw, dh);
    this.sellUseBtnImg.setPosition(cell.centerX, cell.centerY);
    this.sellUseBtn.setPosition(cell.centerX, cell.centerY);
    this.sellUseZone.setPosition(cell.centerX, cell.centerY);
    this.sellUseZone.setSize(cell.width, cell.height);
  }

  private computeSellPreviewIconSize(): number {
    const { width, height } = this.sellCellRectPx(this.getSellFooterCell('preview'));
    const edge = Math.min(width, height) * SELL_ICON_EDGE_FRAC;
    return Math.round(Math.min(edge, this.artSpanH(SELL_PREVIEW_ICON_MAX_ART_PX)));
  }

  /** Icon band height and vertical centers for a grid cell. */
  private slotCellLayout(cellTop: number): {
    iconBandH: number;
    nameBandH: number;
    iconCenterY: number;
    nameCenterY: number;
  } {
    const iconBandH = this.cellH * SLOT_ICON_BAND_FRAC;
    const nameBandH = this.cellH * SLOT_NAME_BAND_FRAC;
    return {
      iconBandH,
      nameBandH,
      iconCenterY: cellTop + iconBandH / 2 + this.artSpanH(SLOT_ICON_OFFSET_Y_ART_PX),
      nameCenterY: cellTop + iconBandH + nameBandH / 2,
    };
  }

  private computeSlotIconSize(cellW: number, cellH: number): number {
    const iconBandH = cellH * SLOT_ICON_BAND_FRAC;
    const iconEdge = Math.min(cellW, iconBandH);
    return Math.round(
      Math.min(
        this.artSpanH(SLOT_ICON_MAX_ART_PX),
        iconEdge * SLOT_ICON_MIN_EDGE_FRAC * SLOT_ICON_SCALE
      )
    );
  }

  private createSlotNameText(
    x: number,
    y: number,
    label: string,
    wrapWidth: number
  ): Phaser.GameObjects.Text {
    return this.container.scene.add
      .text(
        x,
        y,
        label.toUpperCase(),
        warehouseTitleLikeTextStyle('small', {
          fontSize: scaledFontSizePx(SLOT_NAME_FONT_BASE_PX, this.typographyScale),
          align: 'center',
          wordWrap: { width: wrapWidth },
        })
      )
      .setOrigin(0.5, 0.5);
  }

  private createSlotQtyText(x: number, y: number, count: number): Phaser.GameObjects.Text {
    const fontSizePx = slotQtyFontSizePx(count, this.typographyScale);
    return this.container.scene.add
      .text(
        x,
        y,
        `${count}`,
        warehouseTitleLikeTextStyle('small', {
          fontSize: `${fontSizePx}px`,
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5);
  }

  /** Scroll API: move inventory list by pixel delta (positive = scroll down). */
  scrollBy(deltaY: number): void {
    this.setScrollOffset(this.scrollOffset + deltaY * 0.35);
  }

  /** Scroll API: set scroll position in pixels (0 = top). */
  setScrollOffset(offset: number): void {
    this.scrollOffset = Phaser.Math.Clamp(offset, 0, this.getMaxScrollOffset());
    this.scrollContent.setY(-this.scrollOffset);
  }

  getScrollOffset(): number {
    return this.scrollOffset;
  }

  getMaxScrollOffset(): number {
    return Math.max(0, this.getScrollContentHeight(this.lastRenderedSlotCount) - this.gridViewportH);
  }

  private lastRenderedSlotCount = 0;
  /** Dev/e2e: extend scrollable row count beyond real slots. */
  private minScrollRows = 0;

  private isPointerInGrid(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.gridLeft &&
      pointer.x <= this.gridLeft + this.gridViewportW &&
      pointer.y >= this.gridTop &&
      pointer.y <= this.gridTop + this.gridViewportH
    );
  }

  private getScrollContentHeight(slotCount: number): number {
    const rows = Math.max(
      GRID_ROWS_VISIBLE,
      Math.ceil(slotCount / GRID_COLS),
      this.minScrollRows
    );
    return rows * this.pitchCellH;
  }

  /** Dev/e2e: force extra scrollable rows (e.g. 8 rows when catalog has fewer item types). */
  setMinScrollRows(rows: number): void {
    this.minScrollRows = Math.max(GRID_ROWS_VISIBLE, rows);
    this.repaint();
  }

  private rebuildItemsBackground(contentHeight: number): void {
    this.itemsBgContainer.removeAll(true);
    const totalRows = Math.max(GRID_ROWS_VISIBLE, Math.ceil(contentHeight / this.pitchCellH));
    const tex = this.sceneRef.textures.exists('ui_warehouse_item')
      ? 'ui_warehouse_item'
      : 'ui_warehouse';
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = col * this.cellW + this.cellW / 2;
        const y = row * this.pitchCellH + this.cellH / 2;
        const img = this.sceneRef.add.image(x, y, tex);
        if (tex === 'ui_warehouse_item') {
          img.setDisplaySize(this.cellW, this.cellH);
        } else {
          img.setDisplaySize(this.cellW, this.cellH);
          img.setAlpha(0.35);
        }
        this.itemsBgContainer.add(img);
      }
    }
  }

  /** 10×3 viewport + extended rows for scroll tuning (debug only). */
  private buildDebugGridOverlay(scene: Phaser.Scene, totalRows: number): Phaser.GameObjects.Container {
    const ox = this.gridContentOffsetX;
    const gridW = GRID_COLS * this.cellW;
    const contentH = Math.max(this.gridViewportH, totalRows * this.pitchCellH);
    const g = scene.add.graphics();
    g.lineStyle(1, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA * 0.55);
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = ox + c * this.cellW;
      g.strokeLineShape(new Phaser.Geom.Line(x, 0, x, contentH));
    }
    for (let r = 0; r <= totalRows; r++) {
      const y = r * this.pitchCellH;
      g.strokeLineShape(new Phaser.Geom.Line(ox, y, ox + gridW, y));
    }
    g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
    g.strokeRect(0, 0, this.gridViewportW, this.gridViewportH);
    if (totalRows > GRID_ROWS_VISIBLE) {
      g.lineStyle(1, DEBUG_GRID_COLOR, 0.45);
      g.strokeLineShape(
        new Phaser.Geom.Line(0, this.gridViewportH, this.gridViewportW, this.gridViewportH)
      );
    }

    const labels: Phaser.GameObjects.Text[] = [];
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        labels.push(
          scene.add
            .text(
              ox + col * this.cellW + this.cellW / 2,
              row * this.pitchCellH + this.cellH / 2,
              `${col},${row}\n${idx}`,
              {
                fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
                color: row < GRID_ROWS_VISIBLE ? '#dfe963' : '#b8c94e',
                fontFamily: 'Arial',
                align: 'center',
              }
            )
            .setOrigin(0.5)
            .setAlpha(row < GRID_ROWS_VISIBLE ? 0.85 : 0.55)
        );
      }
    }

    return scene.add.container(0, 0, [g, ...labels]);
  }

  private syncDebugGrid(totalRows: number): void {
    if (!isWarehouseGridDebug()) return;
    this.debugGridContainer?.destroy();
    this.debugGridContainer = this.buildDebugGridOverlay(this.sceneRef, totalRows);
    this.scrollContent.addAt(this.debugGridContainer, 1);
  }

  /** Left-bottom sell preview placeholders (tune with `?debugWarehouse=1`). */
  private buildSellFooterDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
    const labels: Phaser.GameObjects.Text[] = [];

    const footerRegion = this.sellCellRectPx({
      id: 'footerRegion',
      x0: SELL_FOOTER_REGION_X0,
      y0: SELL_FOOTER_REGION_Y0,
      x1: SELL_FOOTER_REGION_X1,
      y1: SELL_FOOTER_REGION_Y1,
    });
    g.lineStyle(1, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA * 0.45);
    g.strokeRect(footerRegion.left, footerRegion.top, footerRegion.width, footerRegion.height);

    const nameCell = this.getSellFooterCell('name');
    const priceCell = this.getSellFooterCell('sellPrice');
    const rightColInset = this.sellCellRectPx({
      id: 'rightColInset',
      x0: nameCell.x0,
      y0: nameCell.y0,
      x1: nameCell.x1,
      y1: priceCell.y1,
    });
    g.lineStyle(1, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA * 0.65);
    g.strokeRect(
      rightColInset.left,
      rightColInset.top,
      rightColInset.width,
      rightColInset.height
    );

    g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
    for (const cell of this.sellFooterCells) {
      const { left, top, width, height, centerX, centerY } = this.sellCellRectPx(cell);
      g.strokeRect(left, top, width, height);
      const fracLabel = `${cell.x0.toFixed(3)}–${cell.x1.toFixed(3)}\n${cell.y0.toFixed(3)}–${cell.y1.toFixed(3)}`;
      labels.push(
        scene.add
          .text(centerX, centerY, `${cell.id}\n${fracLabel}`, {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#dfe963',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setAlpha(0.9)
      );
    }

    g.lineStyle(2, 0xff9800, DEBUG_GRID_ALPHA);
    for (const cell of this.sellControlsCells) {
      const rect =
        cell.id === 'qtyMinus'
          ? this.sellQtyMinusRectPx()
          : cell.id === 'qtyField'
            ? this.sellQtyFieldRectPx()
            : cell.id === 'sellBtn' || cell.id === 'sellAllBtn'
              ? this.sellActionBtnRectPx(cell.id)
              : this.sellCellRectPx(cell);
      const { left, top, width, height, centerX, centerY } = rect;
      g.strokeRect(left, top, width, height);
      const fracLabel = `${cell.x0.toFixed(3)}–${cell.x1.toFixed(3)}\n${cell.y0.toFixed(3)}–${cell.y1.toFixed(3)}`;
      labels.push(
        scene.add
          .text(centerX, centerY, `${cell.id}\n${fracLabel}`, {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#ffb74d',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setAlpha(0.9)
      );
    }

    labels.push(
      scene.add
        .text(
          footerRegion.left + 4,
          footerRegion.top + 4,
          `gap=${SELL_FOOTER_BAND_GAP_PX}px padTB=${SELL_RIGHT_PAD_TOP}px padR=${SELL_RIGHT_PAD_RIGHT}px`,
          {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#dfe963',
            fontFamily: 'Arial',
            align: 'left',
          }
        )
        .setOrigin(0, 0)
        .setAlpha(0.9)
    );

    return scene.add.container(0, 0, [g, ...labels]);
  }

  private syncSellFooterDebugGrid(): void {
    if (!isWarehouseGridDebug()) return;
    this.sellFooterDebugContainer?.destroy();
    this.sellFooterDebugContainer = this.buildSellFooterDebugOverlay(this.sceneRef);
  }

  /** Top progress bar + category tabs (`?debugWarehouse=1`). */
  private buildHeaderDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];

    for (const cell of this.warehouseHeaderCells) {
      const { left, top, width, height, centerX, centerY } = this.warehouseHeaderCellRectPx(cell.id);
      g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
      g.strokeRect(left, top, width, height);
      const fracLabel = `${cell.x0.toFixed(3)}–${cell.x1.toFixed(3)}\n${cell.y0.toFixed(3)}–${cell.y1.toFixed(3)}`;
      labels.push(
        scene.add
          .text(centerX, centerY, `${cell.id}\n${fracLabel}`, {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#dfe963',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setAlpha(0.9)
      );
    }

    WAREHOUSE_TAB_LAYOUT.forEach((layout, index) => {
      const { left, top, width, height, centerX, centerY } = this.tabSpriteRectPx(index, layout);
      g.lineStyle(2, HEADER_DEBUG_TAB_COLOR, DEBUG_GRID_ALPHA);
      g.strokeRect(left, top, width, height);
      const cellId = HEADER_TAB_CELL_ID[layout.id];
      labels.push(
        scene.add
          .text(
            centerX,
            centerY,
            `${cellId}\nscale=${TAB_DISPLAY_SCALE} row=${TAB_ROW_SCALE} y=${TAB_ROW_CENTER_Y_FRAC.toFixed(4)}`,
            {
              fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
              color: '#ffb74d',
              fontFamily: 'Arial',
              align: 'center',
            }
          )
          .setOrigin(0.5)
          .setAlpha(0.9)
      );
    });

    const track = this.layoutCapacityTrackRectPx();
    labels.push(
      scene.add
        .text(
          track.left + 4,
          track.top + 4,
          `process-empty / process_percent`,
          {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#dfe963',
            fontFamily: 'Arial',
            align: 'left',
          }
        )
        .setOrigin(0, 0)
        .setAlpha(0.9)
    );

    return scene.add.container(0, 0, [g, ...labels]);
  }

  private syncHeaderDebugGrid(): void {
    if (!isWarehouseGridDebug()) return;
    this.headerDebugContainer?.destroy();
    this.headerDebugContainer = this.buildHeaderDebugOverlay(this.sceneRef);
    this.headerDebugContainer.setDepth(WAREHOUSE_DEBUG_GRID_DEPTH);
    this.container.add(this.headerDebugContainer);
    if (this.visible) this.bringModalHitsToTop();
  }

  /** Right-bottom upgrade panel placeholders (tune with `?debugWarehouse=1`). */
  private buildUpgradePanelDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];

    const hit = this.sellCellRectPx({ id: 'upgradeHit', ...UPGRADE_HIT_REGION });
    g.lineStyle(2, UPGRADE_DEBUG_HIT_COLOR, DEBUG_GRID_ALPHA);
    g.strokeRect(hit.left, hit.top, hit.width, hit.height);
    labels.push(
      scene.add
        .text(hit.centerX, hit.top + 4, `upgradeHit\n${UPGRADE_HIT_REGION.x0.toFixed(3)}–${UPGRADE_HIT_REGION.x1.toFixed(3)}`, {
          fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
          color: '#80deea',
          fontFamily: 'Arial',
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.9)
    );

    g.lineStyle(2, UPGRADE_DEBUG_COLOR, DEBUG_GRID_ALPHA);
    for (const cell of this.upgradePanelCells) {
      const { left, top, width, height, centerX, centerY } = this.upgradePanelCellRectPx(cell);
      g.strokeRect(left, top, width, height);
      const fracLabel = `${cell.x0.toFixed(3)}–${cell.x1.toFixed(3)}\n${cell.y0.toFixed(3)}–${cell.y1.toFixed(3)}`;
      labels.push(
        scene.add
          .text(centerX, centerY, `${cell.id}\n${fracLabel}`, {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#e1bee7',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setAlpha(0.9)
      );
    }

    return scene.add.container(0, 0, [g, ...labels]);
  }

  private syncUpgradePanelDebugGrid(): void {
    if (!isWarehouseGridDebug()) return;
    this.upgradePanelDebugContainer?.destroy();
    this.upgradePanelDebugContainer = this.buildUpgradePanelDebugOverlay(this.sceneRef);
  }

  private makeSellBtn(scene: Phaser.Scene, label: string, fn: () => void): Phaser.GameObjects.Text {
    const btn = scene.add
      .text(
        0,
        0,
        label,
        warehouseTitleLikeTextStyle('light', {
          fontSize: scaledFontSizePx(SELL_ACTION_BTN_FONT_BASE_PX, this.typographyScale),
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', fn);
    return btn;
  }

  setCallbacks(cb: InventoryPanelCallbacks): void {
    this.callbacks = cb;
  }

  /** Open warehouse on Resources tab with first sellable crop selected. */
  focusSell(): void {
    this.activeTab = 'resources';
    this.pickDefaultSellTarget();
    this.renderList();
    this.refreshSellFooter();
  }

  private cycleSearch(): void {
    const filters = ['', 'wheat', 'corn', 'seed', 'wood'];
    const idx = filters.indexOf(this.searchInput);
    this.searchInput = filters[(idx + 1) % filters.length];
    this.searchLabel.setColor(this.searchInput ? '#d35400' : '#8b6914');
    this.renderList();
  }

  show(inventory: InventorySystem, economy: EconomySystem, energy: EnergySystem): void {
    this.inventory = inventory;
    this.economy = economy;
    this.energy = energy;
    this.scrollOffset = 0;
    this.scrollContent.setY(0);
    if (!this.selectedSellId) this.pickDefaultSellTarget();
    this.layoutWarehousePanel();
    this.updateCapacity();
    this.renderList();
    this.refreshSellFooter();
    this.refreshUpgradePanel();
    this.container.setDepth(HUD_MODAL_DEPTH);
    this.container.setVisible(true);
    this.container.setAlpha(1);
    this.closeHit.setVisible(true);
    this.layoutCloseButton();
    this.container.scene.children.bringToTop(this.container);
    this.bringModalHitsToTop();
    this.visible = true;
  }

  private pickDefaultSellTarget(): void {
    if (!this.inventory) {
      this.selectedSellId = null;
      return;
    }
    const slots = this.inventory.getDisplaySlots('resources');
    const owned = slots.find((s) => s.count > 0);
    this.selectedSellId = owned?.id ?? null;
    this.sellQuantity = 1;
  }

  private syncTabSprites(): void {
    WAREHOUSE_TAB_LAYOUT.forEach((layout, index) => {
      const tab = this.tabButtons.find((t) => t.id === layout.id);
      if (!tab) return;
      const active = tab.id === this.activeTab;
      const key = active ? tab.activeKey : tab.inactiveKey;
      if (this.sceneRef.textures.exists(key)) {
        tab.image.setTexture(key);
      }
      const rect = this.tabSpriteRectPx(index, layout);
      tab.image.setPosition(rect.centerX, rect.centerY);
      tab.image.setDisplaySize(rect.width, rect.height);
    });
    if (this.visible) this.bringModalHitsToTop();
  }

  private updateCapacity(): void {
    const wh = this.inventory?.warehouse;
    if (!wh) return;
    const used = wh.getUsedCapacity();
    const max = wh.getCapacity();
    const ratio = max > 0 ? Math.min(1, used / max) : 0;
    this.capacityFillRatio = ratio;
    const fillCell = this.layoutCapacityFillRectPx();
    const fillW = fillCell.width * ratio;
    this.capacityFill.setPosition(fillCell.left, fillCell.centerY);
    this.capacityFill.setDisplaySize(fillW, fillCell.height);
    this.capacityFill.setVisible(fillW > 0.5);
    this.capacityText.setText(`${used} / ${max}`);
  }

  private tryUpgrade(): void {
    const wh = this.inventory?.warehouse;
    const eco = this.economy;
    if (!wh || !eco) return;
    const cost = wh.getUpgradeCost();
    if (!cost) {
      this.sellStatusText.setText('Warehouse max level');
      return;
    }
    const ok = wh.upgradeWarehouse(eco.getCoins(), (amt) => eco.spend(amt));
    if (ok) {
      this.updateCapacity();
      this.refreshUpgradePanel();
      this.sellStatusText.setText(`Upgraded to Lv${wh.getLevel()}`);
      this.callbacks.onChanged?.();
    } else {
      this.sellStatusText.setText(
        `Need ${cost.coins}🪙 ${cost.wood}🪵 ${cost.stone}🪨`
      );
    }
  }

  private refreshUpgradePanel(): void {
    const wh = this.inventory?.warehouse;
    if (!wh) return;
    const level = wh.getLevel();
    const cost = wh.getUpgradeCost();
    const cap = wh.getCapacity();
    if (!cost || level >= WAREHOUSE.maxLevel) {
      this.upgradeLevelText.setText(`Level ${level} (MAX)`);
      this.upgradeCapacityText.setText(`${cap} (MAX)`);
      this.upgradeCoinText.setText('—');
      this.upgradeWoodText.setText('—');
      this.upgradeStoneText.setText('—');
      this.layoutUpgradePanel();
      return;
    }
    const nextLevel = level + 1;
    const nextCap = warehouseCapacityForLevel(nextLevel);
    this.upgradeLevelText.setText(`Level ${level} → Level ${nextLevel}`);
    this.upgradeCapacityText.setText(`${cap} → ${nextCap}`);
    this.upgradeCoinText.setText(String(cost.coins));
    this.upgradeWoodText.setText(String(cost.wood));
    this.upgradeStoneText.setText(String(cost.stone));
    this.layoutUpgradePanel();
  }

  private getFilteredSlots(): InventorySlot[] {
    if (!this.inventory) return [];
    const cat = this.activeTab === 'all' ? undefined : this.activeTab;
    let slots = this.inventory.getDisplaySlots(cat);
    if (this.searchInput) {
      const q = this.searchInput.toLowerCase();
      slots = slots.filter(
        (s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
      );
    }
    slots.sort((a, b) => {
      if (this.sortMode === 'quantity') return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
    return slots;
  }

  private selectSlot(id: string): void {
    if (!this.inventory || this.inventory.getCount(id) <= 0) return;
    this.selectedSellId = id;
    this.sellQuantity = 1;
    this.renderList();
    this.refreshSellFooter();
  }

  /** Dev/e2e: select a warehouse slot by item id. */
  selectSlotForTest(id: string): void {
    this.selectSlot(id);
  }

  /** Dev/e2e: sell-preview footer text for the selected item. */
  getSellFooterSnapshot(): {
    name: string;
    owned: number;
    unitPrice: number;
    sellable: boolean;
    useVisible: boolean;
    useLabel: string | null;
  } | null {
    if (!this.selectedSellId || !this.inventory || !this.economy) return null;
    const slot = this.getFilteredSlots().find((s) => s.id === this.selectedSellId);
    const label = slot?.label ?? this.selectedSellId;
    const isFood = isFoodItem(this.selectedSellId);
    return {
      name: this.sellItemName.text || label.toUpperCase(),
      owned: this.inventory.getCount(this.selectedSellId),
      unitPrice: this.economy.getSellPrice(this.selectedSellId),
      sellable: isSellableResource(this.selectedSellId),
      useVisible: isFood && this.sellUseBtnImg.visible,
      useLabel: isFood && this.sellUseBtn.visible ? this.sellUseBtn.text : null,
    };
  }

  private maxSellable(): number {
    if (!this.selectedSellId || !this.inventory) return 0;
    return this.inventory.getCount(this.selectedSellId);
  }

  private adjustSellQty(delta: number): void {
    const max = this.maxSellable();
    this.sellQuantity = Math.max(1, Math.min(max || 1, this.sellQuantity + delta));
    this.refreshSellFooter();
  }

  private gameRectToClient(
    left: number,
    top: number,
    width: number,
    height: number
  ): { left: number; top: number; width: number; height: number } {
    const canvas = this.sceneRef.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = bounds.width / this.sceneRef.scale.width;
    const scaleY = bounds.height / this.sceneRef.scale.height;
    return {
      left: bounds.left + left * scaleX,
      top: bounds.top + top * scaleY,
      width: width * scaleX,
      height: height * scaleY,
    };
  }

  private ensureSellQtyInput(): HTMLInputElement {
    if (this.sellQtyInputEl) return this.sellQtyInputEl;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Sell quantity');
    Object.assign(input.style, {
      position: 'fixed',
      zIndex: '10000',
      margin: '0',
      padding: '0',
      border: 'none',
      outline: 'none',
      background: 'rgba(255, 248, 225, 0.92)',
      textAlign: 'center',
      fontFamily: WAREHOUSE_TITLE_FONT,
      fontWeight: 'bold',
      color: '#5d4037',
      WebkitTextStroke: `2px ${warehouseStrokeForColor('#5d4037')}`,
      display: 'none',
      boxSizing: 'border-box',
      borderRadius: '4px',
    });
    input.addEventListener('blur', () => this.commitSellQtyInput());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    document.body.appendChild(input);
    this.sellQtyInputEl = input;
    return input;
  }

  /** Tap qty field: focus hidden number input (native keyboard). */
  private openSellQtyInput(): void {
    if (!this.visible || !this.selectedSellId) return;
    const field = this.sellQtyFieldRectPx();
    const client = this.gameRectToClient(field.left, field.top, field.width, field.height);
    const input = this.ensureSellQtyInput();
    const max = Math.max(1, this.maxSellable());
    input.min = '1';
    input.max = String(max);
    input.value = String(this.sellQuantity);
    input.style.left = `${client.left}px`;
    input.style.top = `${client.top}px`;
    input.style.width = `${client.width}px`;
    input.style.height = `${client.height}px`;
    input.style.fontSize = `${sellQtyFieldFontSizePx(client.height)}px`;
    input.style.display = 'block';
    input.focus({ preventScroll: true });
    input.select();
  }

  private commitSellQtyInput(): void {
    if (!this.sellQtyInputEl || this.sellQtyInputEl.style.display === 'none') return;
    const raw = this.sellQtyInputEl.value.trim();
    this.hideSellQtyInput();
    if (raw === '') return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) this.setSellQuantity(parsed);
  }

  private hideSellQtyInput(): void {
    if (!this.sellQtyInputEl) return;
    this.sellQtyInputEl.style.display = 'none';
    if (document.activeElement === this.sellQtyInputEl) {
      this.sellQtyInputEl.blur();
    }
  }

  private setSellQuantity(qty: number): void {
    const max = Math.max(1, this.maxSellable());
    this.sellQuantity = Phaser.Math.Clamp(Math.floor(qty), 1, max);
    this.sellQtyText.setText(String(this.sellQuantity));
  }

  /** Dev/e2e: current sell quantity when footer is active. */
  getSellQuantity(): number {
    return this.sellQuantity;
  }

  /** Dev/e2e: set sell quantity (clamped to owned). */
  setSellQuantityForTest(qty: number): void {
    this.setSellQuantity(qty);
  }

  /** Dev/e2e: close-button hit zone in screen space. */
  getCloseHitMetrics(): { centerX: number; centerY: number; radius: number } {
    return {
      centerX: this.closeHit.x,
      centerY: this.closeHit.y,
      radius: this.closeHit.radius,
    };
  }

  /** Dev/e2e: fire pointerdown on the close hit zone. */
  simulateCloseClick(): void {
    this.closeHit.emit('pointerdown');
  }

  getActiveTab(): TabId {
    return this.activeTab;
  }

  getCapacityFillRatio(): number {
    return this.capacityFillRatio;
  }

  /** Dev/e2e: fire pointerdown on a category tab sprite. */
  simulateTabClick(tabId: TabId): void {
    const tab = this.tabButtons.find((t) => t.id === tabId);
    tab?.image.emit('pointerdown');
  }

  /** Dev/e2e: fire pointerdown on a sell qty hit zone (validates zone wiring). */
  simulateSellControlClick(id: 'qtyMinus' | 'qtyPlus' | 'qtyField'): void {
    const zone =
      id === 'qtyMinus'
        ? this.sellMinusZone
        : id === 'qtyPlus'
          ? this.sellPlusZone
          : this.sellQtyZone;
    zone.emit('pointerdown');
  }

  /** Dev/e2e: fire pointerdown on food USE hit zone. */
  simulateSellUseClick(): void {
    this.sellUseZone.emit('pointerdown');
  }

  private useFood(itemId: string): void {
    if (!this.inventory || !this.energy) return;
    if (!isFoodItem(itemId)) return;
    const owned = this.inventory.getCount(itemId);
    if (owned <= 0) {
      this.sellStatusText.setText('Nothing to use');
      return;
    }
    const recovery = FOOD_ENERGY_RECOVERY[itemId] ?? 0;
    if (!this.inventory.remove(itemId, 1)) {
      this.sellStatusText.setText('Could not use item');
      return;
    }
    this.energy.add(recovery);
    this.sellStatusText.setText(`+${recovery} energy`);
    this.callbacks.onUseFood?.(itemId, recovery);
    this.sellQuantity = 1;
    this.updateCapacity();
    if (this.inventory.getCount(itemId) <= 0) {
      this.pickDefaultSellTarget();
    }
    this.renderList();
    this.refreshSellFooter();
    this.callbacks.onChanged?.();
  }

  private refreshSellFooter(): void {
    if (!this.selectedSellId || !this.economy || !this.inventory) {
      this.sellItemIcon.setVisible(false);
      this.sellItemName.setText('');
      this.sellOwnedText.setText('');
      this.sellOwnedCountText.setText('');
      this.sellPriceLabelText.setVisible(false);
      this.sellCoinIcon.setVisible(false);
      this.sellPriceValueText.setText('');
      this.sellUseBtnImg.setVisible(false);
      this.sellUseBtn.setVisible(false);
      this.sellUseZone.setVisible(false);
      this.setSellUseControlEnabled(false);
      this.setSellFooterSellControlsEnabled(true);
      this.sellQtyText.setText('1');
      this.sellBtn.setAlpha(1);
      this.sellAllBtn.setAlpha(1);
      this.sellQtyText.setAlpha(1);
      return;
    }
    const owned = this.inventory.getCount(this.selectedSellId);
    const unit = this.economy.getSellPrice(this.selectedSellId);
    const slot = this.getFilteredSlots().find((s) => s.id === this.selectedSellId);
    const label = slot?.label ?? this.selectedSellId;
    const iconKey =
      slot && this.container.scene.textures.exists(slot.iconKey) ? slot.iconKey : 'seed';
    const isFood = isFoodItem(this.selectedSellId);

    this.sellItemIcon.setTexture(iconKey);
    this.sellItemIcon.setVisible(true);
    this.sellItemName.setText(label.toUpperCase());
    this.sellOwnedText.setText('Owned');
    this.sellOwnedCountText.setText(String(owned));
    const sellable = isSellableResource(this.selectedSellId);
    this.sellPriceLabelText.setVisible(true);
    this.sellCoinIcon.setVisible(
      sellable && unit > 0 && this.sceneRef.textures.exists(COIN_TEXTURE_KEY)
    );
    this.sellPriceValueText.setText(sellable && unit > 0 ? String(unit) : '—');

    const showUse = isFood;
    this.sellUseBtnImg.setVisible(showUse);
    this.sellUseBtn.setVisible(showUse);
    this.sellUseZone.setVisible(showUse);
    const useAlpha = showUse && owned > 0 ? 1 : 0.35;
    this.sellUseBtnImg.setAlpha(useAlpha);
    this.sellUseBtn.setAlpha(useAlpha);
    this.sellUseZone.setAlpha(useAlpha);
    this.setSellUseControlEnabled(showUse && owned > 0);

    const sellControlsActive = sellable && owned > 0 && unit > 0;
    const sellControlsAlpha = sellControlsActive ? 1 : 0.35;
    this.sellBtn.setAlpha(sellControlsAlpha);
    this.sellAllBtn.setAlpha(sellControlsAlpha);
    this.sellQtyText.setAlpha(sellControlsAlpha);
    this.setSellFooterSellControlsEnabled(sellControlsActive && !isFood);

    this.layoutSellFooterElements();
    this.layoutSellControls();
    this.sellQuantity = Math.min(this.sellQuantity, Math.max(1, owned));
    if (owned === 0) this.sellQuantity = 1;
    this.sellQtyText.setText(String(this.sellQuantity));
  }

  private sellSelected(amount: number): void {
    if (!this.economy || !this.inventory || !this.selectedSellId) {
      this.sellStatusText.setText('Select an item first');
      return;
    }
    if (!isSellableResource(this.selectedSellId)) {
      this.sellStatusText.setText('This item cannot be sold');
      return;
    }
    const owned = this.inventory.getCount(this.selectedSellId);
    const qty = Math.min(amount, owned);
    if (qty <= 0) {
      this.sellStatusText.setText('Nothing to sell');
      return;
    }
    const unit = this.economy.getSellPrice(this.selectedSellId);
    const total = unit * qty;
    if (!this.inventory.remove(this.selectedSellId, qty)) {
      this.sellStatusText.setText('Could not remove items');
      return;
    }
    this.economy.earn(total);
    this.sellStatusText.setText(`Sold ${qty} for ${total} 🪙`);
    this.sellQuantity = 1;
    this.updateCapacity();
    this.pickDefaultSellTarget();
    this.renderList();
    this.refreshSellFooter();
    this.callbacks.onChanged?.();
  }

  private renderList(): void {
    this.listContainer.removeAll(true);
    this.syncTabSprites();

    const slots = this.getFilteredSlots();
    this.lastRenderedSlotCount = slots.length;
    const totalRows = Math.max(
      GRID_ROWS_VISIBLE,
      Math.ceil(slots.length / GRID_COLS) || GRID_ROWS_VISIBLE,
      this.minScrollRows
    );
    const contentHeight = this.getScrollContentHeight(slots.length);

    this.rebuildItemsBackground(contentHeight);
    this.syncDebugGrid(totalRows);
    this.setScrollOffset(this.scrollOffset);

    if (slots.length === 0) {
      return;
    }

    const iconSize = this.computeSlotIconSize(this.cellW, this.cellH);
    const nameWrapW = this.cellW * 0.92;

    slots.forEach((slot, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cellLeft = col * this.cellW;
      const cellTop = row * this.pitchCellH;
      const { iconCenterY, nameCenterY } = this.slotCellLayout(cellTop);
      const iconX = cellLeft + this.cellW / 2;
      const tex = this.container.scene.textures.exists(slot.iconKey) ? slot.iconKey : 'seed';
      const icon = this.container.scene.add.image(iconX, iconCenterY, tex);
      icon.setOrigin(0.5, 0.5);
      icon.setDisplaySize(iconSize, iconSize);

      const nameText = this.createSlotNameText(
        iconX,
        nameCenterY,
        slot.label,
        nameWrapW
      );

      const isSelected = slot.id === this.selectedSellId;
      if (isSelected) {
        const ring = this.container.scene.add.rectangle(
          cellLeft + this.cellW / 2,
          cellTop + this.cellH / 2,
          this.cellW * 0.94,
          this.cellH * 0.94,
          0xffd700,
          0.22
        );
        this.listContainer.add(ring);
      }

      const qtyBadge = slotQtyBadgeCenterFrac();
      const qty = this.createSlotQtyText(
        cellLeft + this.cellW * qtyBadge.x,
        cellTop + this.cellH * qtyBadge.y,
        slot.count
      );

      this.listContainer.add([icon, nameText, qty]);

      const hit = this.container.scene.add
        .rectangle(
          cellLeft + this.cellW / 2,
          cellTop + this.cellH / 2,
          this.cellW * 0.94,
          this.cellH * 0.94,
          0x000000,
          0.001
        )
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (slot.count > 0) this.selectSlot(slot.id);
      });
      this.listContainer.add(hit);
    });
  }

  hide(): void {
    this.hideSellQtyInput();
    this.container.setVisible(false);
    this.closeHit.setVisible(false);
    this.visible = false;
    this.sellStatusText.setText('');
  }

  /** Re-render list without resetting scroll (dev / e2e). */
  repaint(): void {
    if (!this.visible || !this.inventory || !this.economy || !this.energy) return;
    this.layoutWarehousePanel();
    this.updateCapacity();
    this.renderList();
    this.refreshSellFooter();
    this.refreshUpgradePanel();
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Dev/e2e: grid viewport and cell geometry in screen space. */
  getGridLayoutMetrics(): WarehouseGridLayoutMetrics {
    const sellFooterCells = this.sellFooterCells.map((cell) => {
      const { left, top, width, height } = this.sellCellRectPx(cell);
      return { id: cell.id, left, top, width, height };
    });
    const sellControlsCells = this.sellControlsCells.map((cell) => {
      const { left, top, width, height } =
        cell.id === 'qtyMinus'
          ? this.sellQtyMinusRectPx()
          : cell.id === 'qtyField'
            ? this.sellQtyFieldRectPx()
            : cell.id === 'sellBtn' || cell.id === 'sellAllBtn'
              ? this.sellActionBtnRectPx(cell.id)
              : this.sellCellRectPx(cell);
      return { id: cell.id, left, top, width, height };
    });
    const upgradePanelCells = this.upgradePanelCells.map((cell) => {
      const { left, top, width, height } = this.upgradePanelCellRectPx(cell);
      return { id: cell.id, left, top, width, height };
    });
    const capacityHeaderCells = this.warehouseHeaderCells.map((cell) => {
      const { left, top, width, height } = this.warehouseHeaderCellRectPx(cell.id);
      return { id: cell.id, left, top, width, height };
    });
    const tabHeaderCells = WAREHOUSE_TAB_LAYOUT.map((layout, index) => {
      const { left, top, width, height } = this.tabSpriteRectPx(index, layout);
      return { id: HEADER_TAB_CELL_ID[layout.id], left, top, width, height };
    });
    const headerCells = [...capacityHeaderCells, ...tabHeaderCells];
    const tabSprites = WAREHOUSE_TAB_LAYOUT.map((layout, index) => {
      const tab = this.tabButtons.find((t) => t.id === layout.id)!;
      const rect = this.tabSpriteRectPx(index, layout);
      return {
        id: tab.id,
        cellId: HEADER_TAB_CELL_ID[layout.id],
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        textureKey: tab.image.texture.key,
        active: tab.id === this.activeTab,
      };
    });
    const upgradeCostTexts = [
      {
        id: 'coin' as const,
        slotId: 'coinSlot',
        x: this.upgradeCoinText.x,
        y: this.upgradeCoinText.y,
        text: this.upgradeCoinText.text,
      },
      {
        id: 'wood' as const,
        slotId: 'woodSlot',
        x: this.upgradeWoodText.x,
        y: this.upgradeWoodText.y,
        text: this.upgradeWoodText.text,
      },
      {
        id: 'stone' as const,
        slotId: 'stoneSlot',
        x: this.upgradeStoneText.x,
        y: this.upgradeStoneText.y,
        text: this.upgradeStoneText.text,
      },
    ];
    return {
      panelW: this.panelW,
      panelH: this.panelH,
      panelLeft: this.panelLeft,
      panelTop: this.panelTop,
      gridLeft: this.gridLeft,
      gridTop: this.gridTop,
      gridViewportW: this.gridViewportW,
      gridViewportH: this.gridViewportH,
      gridContentOffsetX: this.gridContentOffsetX,
      gridContentW: this.gridContentW,
      cellW: this.cellW,
      cellH: this.cellH,
      cols: GRID_COLS,
      visibleRows: GRID_ROWS_VISIBLE,
      scrollOffset: this.scrollOffset,
      maxScrollOffset: this.getMaxScrollOffset(),
      slotCount: this.lastRenderedSlotCount,
      debugGrid: isWarehouseGridDebug(),
      sellFooterCells,
      sellControlsCells,
      upgradePanelCells,
      headerCells,
      activeTab: this.activeTab,
      capacityFillRatio: this.capacityFillRatio,
      capacityText: {
        x: this.capacityText.x,
        y: this.capacityText.y,
        originX: this.capacityText.originX,
        originY: this.capacityText.originY,
      },
      tabSprites,
      upgradeCostTexts,
      closeHit: this.getCloseHitMetrics(),
    };
  }

  toggle(inventory: InventorySystem, economy: EconomySystem, energy: EnergySystem): void {
    if (this.visible) this.hide();
    else this.show(inventory, economy, energy);
  }

  destroy(): void {
    this.hideSellQtyInput();
    this.sellQtyInputEl?.remove();
    this.sellQtyInputEl = null;
    this.sceneRef.input.off('wheel', this.boundWheel);
    this.scrollViewport.clearMask(true);
    this.scrollGeometryMask?.destroy();
    this.scrollMaskGraphics?.destroy();
    this.closeHit.destroy();
    this.container.destroy();
  }
}

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
  WAREHOUSE_TITLE_STROKE_DARK,
} from './warehouseTextStyle';
import type { EconomySystem } from '../systems/EconomySystem';
import type { EnergySystem } from '../systems/EnergySystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { InventorySlot } from '../systems/InventorySystem';
import { computeWarehouseModalPanelSize } from './modalPanelSize';
import {
  artPxToScreen,
  computeObjectCoverCrop,
  type ObjectCoverCrop,
} from './ShopPanel';
import {
  getModalTypographyScale,
  scaledFontSize,
  scaledFontSizePx,
} from './uiFontScale';
import {
  beginScrollDrag,
  clearScrollDrag,
  createScrollDragSession,
  endScrollDrag,
  handleScrollDragMove,
} from './scrollDragGesture';

export type WarehouseTabId = 'all' | ItemCategory;
type TabId = WarehouseTabId;
type SortMode = 'name' | 'quantity';

/** Native size of `ui/warehouse.png` — layout fractions are tuned to this art. */
const WAREHOUSE_ART_W = 1536;
const WAREHOUSE_ART_H = 1024;
/** Vertical section spacing in modal (% of modal/panel height). */
const TOP_INSET_FRAC = 0.11;
const BOTTOM_INSET_FRAC = 0.112;
const HEADER_SECTION_HEIGHT_FRAC = 0.145;
const BOTTOM_SECTION_HEIGHT_FRAC = 0.22;
const GRID_SECTION_HEIGHT_FRAC = 0.33124;
/** Screen-pixel nudge for art-aligned inner UI vs warehouse bg (negative = left/up). */
const WAREHOUSE_INNER_OFFSET_X_PX = 0;
const WAREHOUSE_INNER_OFFSET_Y_PX = -10;
/** Additional fraction-of-panel nudge (applied via fracX/fracY; panelBg/dimOverlay unchanged). */
const WAREHOUSE_INNER_OFFSET_X_FRAC = 0;
const WAREHOUSE_INNER_OFFSET_Y_FRAC = -0.01;
/** Visible item slots in warehouse grid (6×2 viewport = 12 per page). */
const WAREHOUSE_GRID_COLS = 6;
const WAREHOUSE_GRID_ROWS = 2;

/**
 * Modal panel vertical layout — fractions of panel height from `panelTop` (0–1).
 * Positions the process bar, tab row, and items grid on the visible modal rect,
 * not warehouse art texture coordinates (see `fracY` / cover-crop mapping).
 * Tuned at 1280×720 to match the prior art-mapped layout.
 */
const PROCESS_ROW_TOP_PANEL_FRAC = 0.141875; // 0.142875 - 0.001 — down 0.1%
const PROCESS_ROW_HEIGHT_PANEL_FRAC = (134 / WAREHOUSE_ART_H) * 0.5;
/** Outer process bg / capacity track height scale (`capacityProcessBg`). */
const PROCESS_ROW_HEIGHT_SCALE = 1.1357955; // 1.08171 × 1.05
const TAB_ROW_TOP_PANEL_FRAC = 0.213097;
const ITEMS_LIST_TOP_PANEL_FRAC = 0.299458;
const ITEMS_LIST_HEIGHT_PANEL_FRAC = GRID_SECTION_HEIGHT_FRAC;
/** Viewport / beige-bg height scale (slot pitch follows viewport H). */
const ITEMS_LIST_HEIGHT_SCALE = 1.06555;

/** Normalized layout vs 1536×1024 warehouse art (fractions of panel W/H). */
/** Beige item inset on `ui/warehouse.png` (x 88–1330, y 248–590 for 6×2 viewport). */
const GRID_INSET_LEFT_FRAC = 88 / WAREHOUSE_ART_W;
const GRID_INSET_RIGHT_FRAC = 1330 / WAREHOUSE_ART_W;
const HEADER_SECTION_TOP_FRAC = TOP_INSET_FRAC;
const HEADER_SECTION_BOTTOM_FRAC = HEADER_SECTION_TOP_FRAC + HEADER_SECTION_HEIGHT_FRAC;
/** Item grid viewport width — matches beige inset on warehouse art. */
const GRID_WIDTH_FRAC = GRID_INSET_RIGHT_FRAC - GRID_INSET_LEFT_FRAC;
const GRID_LEFT_FRAC = GRID_INSET_LEFT_FRAC;
/** Widen list-bg / scroll mask vs art inset; slot pitch still uses `GRID_WIDTH_FRAC`. */
const ITEMS_LIST_WIDTH_SCALE = 1.029169; // 1.034341 × 0.995 — items list container width −0.5%
/** Panel-relative nudge for items list viewport, mask, beige bg, and slot band (horizontal only). */
const ITEMS_LIST_OFFSET_X_PANEL_FRAC = -0.005;
const WAREHOUSE_ITEMS_LIST_BG_KEY = 'ui_warehouse_items_list_bg';
const WAREHOUSE_TABLIST_BG_KEY = 'ui_warehouse_tablist_bg';
const WAREHOUSE_PROCESS_BG_KEY = 'ui_warehouse_process_bg';
/** Visible viewport only (2 rows) — not full scroll content height. */
const GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX = 10;

/** Horizontal shrink of slot width vs pitch (art px, scaled at layout). */
const CELL_SLOT_SHRINK_W_ART_PX = 5;
/** Extra display height for `ui_warehouse_item` tiles vs row pitch (art px). */
const CELL_SLOT_HEIGHT_EXTRA_ART_PX = 2;
/** Per-slot card width vs layout `cellW` (renderList only; grid viewport unchanged). */
const ITEM_SLOT_WIDTH_SCALE = 1.086585; // 1.083336 × 1.003 — slot card width +0.3%
/** Horizontal / vertical step between slot origins in renderList (+1% inter-item gap). */
const ITEM_SLOT_GAP_SCALE = 1.01;
/** Grid slot item name vertical nudge (fraction of `cellH`; negative = up). */
const ITEM_SLOT_NAME_Y_OFFSET_FRAC = -0.03;

/** Per-cell overlays vs `ui/warehouse-item.png` (128×120) slot art. */
const WAREHOUSE_ITEM_ART_W = 128;
const WAREHOUSE_ITEM_ART_H = 120;
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
const SLOT_NAME_FONT_BASE_PX = 17.55; // 19.5 × 0.90 — grid item name (CAKE, CARROT)
const DEBUG_LABEL_FONT_BASE_PX = 8;
/** Tan qty pill gold fill on `ui/warehouse-item.png` (128×120 art px). */
const SLOT_QTY_BADGE_X0_PX = 100;
const SLOT_QTY_BADGE_X1_PX = 116;
const SLOT_QTY_BADGE_Y0_PX = 76;
const SLOT_QTY_BADGE_Y1_PX = 82;
/** Default qty badge size (1–2 digits); shrinks for hundreds. */
const SLOT_QTY_FONT_BASE_PX = 17.55; // 19.5 × 0.90 — grid qty badge (6, 8, 36)
const SLOT_QTY_FONT_3DIGIT_BASE_PX = 13.5; // 15 × 0.90 — hundreds on badge

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
const DEBUG_LAYOUT_GRID_COLOR = 0x00e5ff;
const DEBUG_GRID_ALPHA = 0.72;

/**
 * Sell-preview detail panel (fractions vs modal panel W/H).
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

const BOTTOM_SECTION_BOTTOM_FRAC = 1 - BOTTOM_INSET_FRAC;
const BOTTOM_SECTION_TOP_FRAC = BOTTOM_SECTION_BOTTOM_FRAC - BOTTOM_SECTION_HEIGHT_FRAC;
/** Unified sell footer row — 90% modal width, centered; three columns inside. */
const SELL_FOOTER_ROW_WIDTH_FRAC = 0.9;
const SELL_FOOTER_ROW_LEFT_FRAC = (1 - SELL_FOOTER_ROW_WIDTH_FRAC) / 2;
const SELL_FOOTER_COL1_FRAC = 0.375;
const SELL_FOOTER_COL2_FRAC = 0.3;
const SELL_FOOTER_COL3_FRAC = 0.325;

/** Footer col1 — shift all cells up (fraction of col1 height). */
const COL1_COLUMN_Y_OFFSET_FRAC = -0.05;
/** Footer col1 — extra shift for name only (fraction of col1 height). */
const COL1_NAME_Y_OFFSET_FRAC = -0.02;
/** Footer col1 — extra shift for name / owned only (0 = column offset only). */
const COL1_NAME_OWNED_Y_OFFSET_FRAC = 0;
/** Footer col1 — preview frame, owned bar, sell-price bar width scale (re-centered). */
const COL1_DETAIL_CELL_WIDTH_SCALE = 0.92;
/** Footer col2 — qty row (−, count, +) down. */
const COL2_QTY_ROW_Y_OFFSET_FRAC = 0.06;
/** Footer col2 — SELL / SELL ALL height vs cell (0.6 × 0.9). */
const COL2_SELL_BTN_HEIGHT_SCALE = 0.54;
/** Footer col3 — level / capacity labels up. */
const COL3_LEVEL_TEXT_Y_OFFSET_FRAC = -0.08;
/** Footer col3 — coin / wood / stone cost numbers up. */
const COL3_COST_TEXT_Y_OFFSET_FRAC = -0.02;
/** Footer col3 — coin cost display width scale. */
const COL3_COIN_TEXT_WIDTH_SCALE = 1.01;
/** Footer col3 — coin cost number shift left. */
const COL3_COIN_TEXT_X_OFFSET_FRAC = -0.03;

/** Item detail footer vertical band — fractions of modal panel height. */
const DETAIL_BOTTOM_FRAC = 0.07;
const DETAIL_HEIGHT_FRAC =
  BOTTOM_SECTION_BOTTOM_FRAC - 0.001 - (BOTTOM_SECTION_TOP_FRAC + 0.005);
const SELL_FOOTER_ROW_Y1 = 1 - DETAIL_BOTTOM_FRAC;
const SELL_FOOTER_ROW_Y0 = SELL_FOOTER_ROW_Y1 - DETAIL_HEIGHT_FRAC;
/** Col1 width as panel fraction (for inset → col-local conversion). */
const SELL_FOOTER_COL1_PANEL_W_FRAC = SELL_FOOTER_ROW_WIDTH_FRAC * SELL_FOOTER_COL1_FRAC;
const SELL_FOOTER_PREVIEW_WIDTH_FRAC = 0.4;
const SELL_FOOTER_BAND_GAP_FRAC = 15 / WAREHOUSE_ART_H;
/** Band heights as fractions of (right-column content height − 2×gap). */
/** Right-column band weights (normalized; 27 + 21 + 42 = 90). */
const SELL_FOOTER_BAND_WEIGHTS = { name: 0.27, owned: 0.21, price: 0.42 } as const;
const SELL_FOOTER_NAME_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.name;
const SELL_FOOTER_OWNED_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.owned;
const SELL_FOOTER_PRICE_BAND_FRAC = SELL_FOOTER_BAND_WEIGHTS.price;
/** Right column inset (name / owned / sell price bands and debug overlay). */
const SELL_RIGHT_PAD_TOP_FRAC = 15 / WAREHOUSE_ART_H;
const SELL_RIGHT_PAD_BOTTOM_FRAC = 15 / WAREHOUSE_ART_H;
const SELL_RIGHT_PAD_RIGHT_FRAC = 20 / WAREHOUSE_ART_W;

function buildSellFooterCells(): SellFooterCellFrac[] {
  const x0 = 0;
  const x1 = 1;
  const y0 = 0;
  const y1 = 1;
  const regionW = x1 - x0;
  const splitX = x0 + regionW * SELL_FOOTER_PREVIEW_WIDTH_FRAC;

  const padTopLocal = SELL_RIGHT_PAD_TOP_FRAC / DETAIL_HEIGHT_FRAC;
  const padBottomLocal = SELL_RIGHT_PAD_BOTTOM_FRAC / DETAIL_HEIGHT_FRAC;
  const padRightLocal = SELL_RIGHT_PAD_RIGHT_FRAC / SELL_FOOTER_COL1_PANEL_W_FRAC;
  const colX0 = splitX;
  const colX1 = x1 - padRightLocal;
  const colY0 = y0 + padTopLocal;
  const colY1 = y1 - padBottomLocal;

  const gapLocal = SELL_FOOTER_BAND_GAP_FRAC / DETAIL_HEIGHT_FRAC;
  const regionHFrac = colY1 - colY0;
  const contentHFrac = regionHFrac - 2 * gapLocal;
  const bandWeightSum =
    SELL_FOOTER_NAME_BAND_FRAC + SELL_FOOTER_OWNED_BAND_FRAC + SELL_FOOTER_PRICE_BAND_FRAC;
  const nameHFrac = (contentHFrac * SELL_FOOTER_NAME_BAND_FRAC) / bandWeightSum;
  const ownedHFrac = (contentHFrac * SELL_FOOTER_OWNED_BAND_FRAC) / bandWeightSum;
  const priceHFrac = (contentHFrac * SELL_FOOTER_PRICE_BAND_FRAC) / bandWeightSum;

  const nameY1 = colY0 + nameHFrac;
  const ownedY0 = nameY1 + gapLocal;
  const ownedY1 = ownedY0 + ownedHFrac;
  const priceY0 = ownedY1 + gapLocal;
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

/** Sell-detail panel (item name, owned, sell price) — +20% vs original design. */
const WAREHOUSE_DETAIL_FONT_SCALE = 1.2;
const SELL_NAME_FONT_BASE_PX = 14 * WAREHOUSE_DETAIL_FONT_SCALE;
const SELL_OWNED_LABEL_FONT_BASE_PX = 14 * WAREHOUSE_DETAIL_FONT_SCALE;
const SELL_OWNED_COUNT_FONT_BASE_PX = 16 * WAREHOUSE_DETAIL_FONT_SCALE;
const SELL_OWNED_LABEL_OFFSET_ART_PX = 11;
const SELL_PRICE_LABEL_FONT_BASE_PX = 12 * WAREHOUSE_DETAIL_FONT_SCALE;
const SELL_PRICE_VALUE_FONT_BASE_PX = 14 * WAREHOUSE_DETAIL_FONT_SCALE;
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
/** Orange `ui_button` label — ~25% larger than legacy 14px for readability. */
const SELL_USE_BTN_FONT_BASE_PX = 18;
/** Thinner dark stroke on cream fill (default warehouse stroke is heavier + shadow). */
const SELL_USE_BTN_STROKE_FACTOR = 0.2;
const SELL_USE_BTN_TEXT_PAD_PX = 6;
const SELL_USE_BTN_FONT_MIN_PX = 12;
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
/** Nudge SELL / SELL ALL centers and hit rects downward (art px). */
const SELL_ACTION_BTN_OFFSET_ART_PX = 15;

/** Legacy art bounding box for center sell controls — maps into footer col2. */
const SELL_COL2_ART = {
  x0: SELL_QTY_MINUS_X0,
  x1: 0.6341,
  y0: SELL_QTY_ROW_Y0,
  y1: 0.9004,
} as const;

function artRectToCol2Local(
  x0: number,
  x1: number,
  y0: number,
  y1: number
): { x0: number; x1: number; y0: number; y1: number } {
  const src = SELL_COL2_ART;
  const w = src.x1 - src.x0;
  const h = src.y1 - src.y0;
  return {
    x0: (x0 - src.x0) / w,
    x1: (x1 - src.x0) / w,
    y0: (y0 - src.y0) / h,
    y1: (y1 - src.y0) / h,
  };
}

function buildSellControlsCells(): SellFooterCellFrac[] {
  const raw: SellFooterCellFrac[] = [
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
  return raw.map(({ id, x0, x1, y0, y1 }) => ({
    id,
    ...artRectToCol2Local(x0, x1, y0, y1),
  }));
}

const SELL_CONTROLS_CELLS: SellFooterCellFrac[] = buildSellControlsCells();

/** Min px for sell qty display + HTML overlay (fraction of field height). */
const SELL_QTY_FIELD_FONT_MIN_PX = 12;
const SELL_QTY_FIELD_FONT_HEIGHT_FRAC = 0.55;
const SELL_ACTION_BTN_FONT_BASE_PX = 17;
const CAPACITY_TEXT_FONT_BASE_PX = 16; // 13 × 1.20 — warehouse used/max counter (e.g. 155 / 500)
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
const UPGRADE_HIT_REGION = {
  x0: 0.638,
  y0: BOTTOM_SECTION_TOP_FRAC + 0.004,
  x1: 0.924,
  y1: BOTTOM_SECTION_BOTTOM_FRAC,
};
const UPGRADE_BASE_HIT_Y0 = 0.668;
const UPGRADE_BASE_HIT_Y1 = 0.888;
const UPGRADE_BASE_HIT_SPAN = UPGRADE_BASE_HIT_Y1 - UPGRADE_BASE_HIT_Y0;
const upgradeYInBottomSection = (legacyYFrac: number): number => {
  const rel = (legacyYFrac - UPGRADE_BASE_HIT_Y0) / UPGRADE_BASE_HIT_SPAN;
  return UPGRADE_HIT_REGION.y0 + rel * (UPGRADE_HIT_REGION.y1 - UPGRADE_HIT_REGION.y0);
};

function artRectToCol3Local(
  x0: number,
  x1: number,
  y0: number,
  y1: number
): { x0: number; x1: number; y0: number; y1: number } {
  const src = UPGRADE_HIT_REGION;
  const w = src.x1 - src.x0;
  const h = src.y1 - src.y0;
  return {
    x0: (x0 - src.x0) / w,
    x1: (x1 - src.x0) / w,
    y0: (y0 - src.y0) / h,
    y1: (y1 - src.y0) / h,
  };
}

function buildUpgradePanelCells(): SellFooterCellFrac[] {
  const raw: SellFooterCellFrac[] = [
    { id: 'upgradeIcon', x0: 0.662, y0: upgradeYInBottomSection(0.688), x1: 0.748, y1: upgradeYInBottomSection(0.818) },
    { id: 'levelBox', x0: 0.7572, y0: upgradeYInBottomSection(0.6924), x1: 0.8932, y1: upgradeYInBottomSection(0.7295) },
    { id: 'capacityBox', x0: 0.7572, y0: upgradeYInBottomSection(0.7432), x1: 0.8932, y1: upgradeYInBottomSection(0.7813) },
    /** Dark-pill text areas (right of icon), measured from `warehouse.png` recessed boxes. */
    { id: 'coinSlot', x0: 0.7044, y0: upgradeYInBottomSection(0.8223), x1: 0.735, y1: upgradeYInBottomSection(0.8584) },
    { id: 'woodSlot', x0: 0.776, y0: upgradeYInBottomSection(0.8223), x1: 0.8118, y1: upgradeYInBottomSection(0.8584) },
    { id: 'stoneSlot', x0: 0.8542, y0: upgradeYInBottomSection(0.8233), x1: 0.89, y1: upgradeYInBottomSection(0.8584) },
  ];
  return raw.map(({ id, x0, x1, y0, y1 }) => ({
    id,
    ...artRectToCol3Local(x0, x1, y0, y1),
  }));
}

const UPGRADE_PANEL_CELLS: SellFooterCellFrac[] = buildUpgradePanelCells();
/** Full col3 hit target (legacy upgrade art region). */
const UPGRADE_HIT_CELL: SellFooterCellFrac = { id: 'upgradeHit', x0: 0, y0: 0, x1: 1, y1: 1 };
/** Widen coin cost pill leftward for wider number display (art px). */
const UPGRADE_COIN_SLOT_EXPAND_LEFT_ART_PX = 5;
const UPGRADE_LEVEL_FONT_BASE_PX = 17;
const UPGRADE_CAPACITY_FONT_BASE_PX = 17;
const UPGRADE_COST_FONT_BASE_PX = 15;
const UPGRADE_DEBUG_COLOR = 0x9c27b0;
const UPGRADE_DEBUG_HIT_COLOR = 0x00bcd4;

/**
 * Warehouse close hit — panel-relative inset from top-right of modal rect
 * (panelLeft/panelTop/panelW/panelH; same box as cover-cropped bg).
 */
/** Inset from panel right edge as fraction of panel width (center at 1 − frac). */
const CLOSE_RIGHT_FRAC = 0.015;
/** Inset from panel top edge as fraction of panel height (top anchor of hit circle). */
const CLOSE_TOP_FRAC = 0.10;
/** Hit radius on warehouse art (1536×1024), scaled by panel width. */
const CLOSE_BTN_RADIUS_ART_PX = 56;

/** Art slot width for `process-empty` (reference for fill ratio only). */
const CAPACITY_TRACK_W_FRAC = 668 / WAREHOUSE_ART_W;
/** Process bar outer region width as fraction of modal panel width. */
const PROCESS_BAR_WIDTH_FRAC = 0.8;
/** Inner `process-empty` track width as fraction of outer process bar width. */
const PROCESS_INNER_WIDTH_FRAC = 0.7;
/** Green fill art width at 100% vs empty track width. */
const CAPACITY_FILL_MAX_W_FRAC = 398 / WAREHOUSE_ART_W;
/** Fill max width as fraction of track display width (398 / 668 art ratio). */
const CAPACITY_FILL_MAX_TRACK_W_FRAC = CAPACITY_FILL_MAX_W_FRAC / CAPACITY_TRACK_W_FRAC;
/** Green fill left edge as fraction of inner `process-empty` track width from track.left. */
const CAPACITY_FILL_LEFT_TRACK_FRAC = 0.08;
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

/** Category tab row: half art size + extras; fixed gap between tabs, group centered on tab rail. */
const TAB_DISPLAY_SCALE = 0.5;
/** Vertical scale for tab sprites and tablist background (width unchanged). */
const TAB_HEIGHT_SCALE = 1.01;
/** Per-tab sprite shrink applied after base display size (icons scale with tab). */
const TAB_SPRITE_SCALE = 0.92;
const TAB_EXTRA_W_ART_PX = 68;
const TAB_EXTRA_H_ART_PX = 13;
/** Horizontal gap between adjacent category tab sprites (warehouse art px). */
const TAB_GAP_ART_PX = 24;

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

function panelYFromTop(panelTop: number, panelH: number, frac: number): number {
  return panelTop + panelH * frac;
}

/** Outer process bar region (`capacityProcessBg`) — full process slot width. */
function capacityProcessBgRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number
): CapacityHeaderRectPx {
  const top = panelYFromTop(panelTop, panelH, PROCESS_ROW_TOP_PANEL_FRAC);
  const height = panelH * PROCESS_ROW_HEIGHT_PANEL_FRAC * PROCESS_ROW_HEIGHT_SCALE;
  const width = panelW * PROCESS_BAR_WIDTH_FRAC;
  const left = panelLeft + panelW * 0.5 - width * 0.5;
  const centerX = panelLeft + panelW * 0.5;
  return {
    left,
    top,
    width,
    height,
    centerX,
    centerY: top + height / 2,
  };
}

/** Inner `process-empty` track — centered within outer process bar. */
function capacityTrackRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  const outer = capacityProcessBgRectPx(panelW, panelH, panelLeft, panelTop);
  const width = outer.width * PROCESS_INNER_WIDTH_FRAC;
  const left = outer.centerX - width * 0.5;
  return {
    left,
    top: outer.top,
    width,
    height: outer.height,
    centerX: outer.centerX,
    centerY: outer.centerY,
  };
}

function capacityFillRectPx(panelW: number, panelH: number, panelLeft: number, panelTop: number): CapacityHeaderRectPx {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop);
  const fillHeight = panelH * CAPACITY_FILL_H_FRAC;
  const fillCenterY =
    track.centerY +
    panelH * CAPACITY_FILL_OFFSET_Y_PANEL_FRAC +
    CAPACITY_FILL_NUDGE_ART_Y * (panelH / WAREHOUSE_ART_H);
  const fillTop = fillCenterY - fillHeight / 2;
  const fillLeft = track.left + track.width * CAPACITY_FILL_LEFT_TRACK_FRAC;
  const fillMaxWidth = Math.max(
    0,
    track.width * (CAPACITY_FILL_MAX_TRACK_W_FRAC - CAPACITY_FILL_LEFT_TRACK_FRAC)
  );
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
  warehouseCoverCrop: { cropX: number; cropY: number; cropW: number; cropH: number };
  gridLeft: number;
  gridTop: number;
  gridViewportW: number;
  gridViewportH: number;
  gridContentOffsetX: number;
  gridContentW: number;
  itemsListWidthScale: number;
  itemSlotWidthScale: number;
  itemSlotGapScale: number;
  slotPitchW: number;
  slotPitchH: number;
  slotDisplayWidth: number;
  cellW: number;
  cellH: number;
  cols: number;
  visibleRows: number;
  scrollOffset: number;
  maxScrollOffset: number;
  slotCount: number;
  debugGrid: boolean;
  modalSectionCells: { id: string; left: number; top: number; width: number; height: number }[];
  sellFooterRow: { left: number; top: number; width: number; height: number };
  sellFooterCols: { id: string; left: number; top: number; width: number; height: number }[];
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
    displayWidth: number;
    displayHeight: number;
    textureKey: string;
    active: boolean;
  }[];
  tabListBg: { left: number; top: number; width: number; height: number; textureKey: string };
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
  private itemsListBg: Phaser.GameObjects.Image;
  private tabListBg: Phaser.GameObjects.Image;
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
  private scrollDrag = createScrollDragSession();
  private readonly boundClearScrollDrag: () => void;
  private readonly boundScrollPointerMove: (pointer: Phaser.Input.Pointer) => void;
  private capacityProcessBg!: Phaser.GameObjects.Image;
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
  private modalLayoutDebugContainer?: Phaser.GameObjects.Container;
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
    this.boundClearScrollDrag = () => {
      if (!this.visible) return;
      endScrollDrag(this.scrollDrag);
    };
    this.boundScrollPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.visible) return;
      handleScrollDragMove(this.scrollDrag, pointer, 'y', (offset) => this.setScrollOffset(offset));
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
    this.panelBg.setDisplaySize(this.panelW, this.panelH);
    const panelFrame = this.panelBg.frame;
    this.warehouseCoverCrop = computeObjectCoverCrop(
      panelFrame.width,
      panelFrame.height,
      this.panelW,
      this.panelH
    );
    this.panelBg.setInteractive();

    const processBgKey = scene.textures.exists(WAREHOUSE_PROCESS_BG_KEY)
      ? WAREHOUSE_PROCESS_BG_KEY
      : 'ui_warehouse';
    this.capacityProcessBg = scene.add
      .image(0, 0, processBgKey)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

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
        warehouseTitleLikeTextStyle('light', {
          fontSize: `${CAPACITY_TEXT_FONT_BASE_PX}px`,
          align: 'center',
        })
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    const tabListBgKey = scene.textures.exists(WAREHOUSE_TABLIST_BG_KEY)
      ? WAREHOUSE_TABLIST_BG_KEY
      : 'ui_warehouse';
    this.tabListBg = scene.add
      .image(0, 0, tabListBgKey)
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
          shadow: false,
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

    const upgradeHitRect = this.upgradePanelCellRectPx(UPGRADE_HIT_CELL);
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

    const itemsListBgKey = scene.textures.exists(WAREHOUSE_ITEMS_LIST_BG_KEY)
      ? WAREHOUSE_ITEMS_LIST_BG_KEY
      : 'ui_warehouse';
    this.itemsListBg = scene.add
      .image(0, 0, itemsListBgKey)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.scrollContent = scene.add.container(0, 0);
    this.listContainer = scene.add.container(this.gridContentOffsetX, 0);
    this.scrollContent.add(this.listContainer);
    this.scrollViewport.add([this.itemsListBg, this.scrollContent]);

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
      beginScrollDrag(this.scrollDrag, pointer, this.scrollOffset, 'y');
    });

    scene.input.on('pointermove', this.boundScrollPointerMove);
    scene.input.on('pointerup', this.boundClearScrollDrag);
    scene.input.on('pointerupoutside', this.boundClearScrollDrag);
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
      this.capacityProcessBg,
      this.capacityTrack,
      this.capacityFill,
      this.capacityText,
      this.tabListBg,
      ...this.tabButtons.map((t) => t.image),
      this.searchLabel,
      this.sortLabel,
      this.scrollHit,
      this.scrollViewport,
      this.scrollMaskGraphics,
    ];
    if (this.modalLayoutDebugContainer) panelChildren.push(this.modalLayoutDebugContainer);
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

    this.syncModalLayoutDebugGrid();
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
      this.syncModalLayoutDebugGrid();
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
    this.sellFooterCells = buildSellFooterCells();
    if (this.panelBg) {
      this.panelBg.setPosition(this.cx, this.cy);
      this.panelBg.setDisplaySize(this.panelW, this.panelH);
      const frame = this.panelBg.frame;
      this.warehouseCoverCrop = computeObjectCoverCrop(
        frame.width,
        frame.height,
        this.panelW,
        this.panelH
      );
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
    this.applySellUseBtnTextStyle(this.scaleFont(SELL_USE_BTN_FONT_BASE_PX));
    this.fitSellUseBtnTextToButton();
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
      0,
      ITEMS_LIST_HEIGHT_PANEL_FRAC
    );
    const slotBandW = grid.width;
    this.gridViewportW = slotBandW * ITEMS_LIST_WIDTH_SCALE;
    const itemsListOffsetX = this.panelW * ITEMS_LIST_OFFSET_X_PANEL_FRAC;
    this.gridLeft = grid.centerX - this.gridViewportW / 2 + itemsListOffsetX;
    this.gridTop = this.panelYFromTop(ITEMS_LIST_TOP_PANEL_FRAC);
    this.gridViewportH =
      this.panelH * ITEMS_LIST_HEIGHT_PANEL_FRAC * ITEMS_LIST_HEIGHT_SCALE +
      this.artSpanH(GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX);
    this.gridContentW = slotBandW;
    const pitchCellW = this.gridContentW / WAREHOUSE_GRID_COLS;
    const pitchCellH = this.gridViewportH / WAREHOUSE_GRID_ROWS;
    this.pitchCellH = pitchCellH;
    this.cellW = pitchCellW - this.artSpanW(CELL_SLOT_SHRINK_W_ART_PX);
    this.cellH = pitchCellH + this.artSpanH(CELL_SLOT_HEIGHT_EXTRA_ART_PX);
    const slotPitchW = this.cellW * ITEM_SLOT_GAP_SCALE;
    const totalGridWidth = (WAREHOUSE_GRID_COLS - 1) * slotPitchW + this.cellW;
    this.gridContentOffsetX = (this.gridViewportW - totalGridWidth) / 2;

    this.scrollViewport.setPosition(this.gridLeft, this.gridTop);
    this.listContainer.setPosition(this.gridContentOffsetX, 0);
    this.layoutItemsListBackground();
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
    const closeRadius = this.panelW * (CLOSE_BTN_RADIUS_ART_PX / WAREHOUSE_ART_W);
    const closeX = this.panelLeft + this.panelW * (1 - CLOSE_RIGHT_FRAC);
    const closeY = this.panelTop + this.panelH * CLOSE_TOP_FRAC + closeRadius;
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
    const col = this.sellFooterColRectPx(3);
    let x = cell.centerX;
    if (slotId === 'coinSlot') {
      x += col.width * COL3_COIN_TEXT_X_OFFSET_FRAC;
    }
    return { x, y: cell.centerY };
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
  /** Panel height fraction from modal top (not art texture / cover-crop mapping). */
  private panelYFromTop(frac: number): number {
    return this.panelTop + this.panelH * frac;
  }

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

  private artFracCellRectPx(cell: SellFooterCellFrac): {
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

  private sellFooterRowRectPx(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const left = this.panelLeft + this.panelW * SELL_FOOTER_ROW_LEFT_FRAC;
    const top = this.panelTop + this.panelH * SELL_FOOTER_ROW_Y0;
    const width = this.panelW * SELL_FOOTER_ROW_WIDTH_FRAC;
    const height = this.panelH * (SELL_FOOTER_ROW_Y1 - SELL_FOOTER_ROW_Y0);
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  private sellFooterColRectPx(col: 1 | 2 | 3): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const row = this.sellFooterRowRectPx();
    const colStart =
      col === 1 ? 0 : col === 2 ? SELL_FOOTER_COL1_FRAC : SELL_FOOTER_COL1_FRAC + SELL_FOOTER_COL2_FRAC;
    const colWidth =
      col === 1 ? SELL_FOOTER_COL1_FRAC : col === 2 ? SELL_FOOTER_COL2_FRAC : SELL_FOOTER_COL3_FRAC;
    const left = row.left + row.width * colStart;
    const width = row.width * colWidth;
    return {
      left,
      top: row.top,
      width,
      height: row.height,
      centerX: left + width / 2,
      centerY: row.centerY,
    };
  }

  private sellFooterColCellRectPx(
    col: 1 | 2 | 3,
    cell: SellFooterCellFrac
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const colRect = this.sellFooterColRectPx(col);
    const left = colRect.left + colRect.width * cell.x0;
    const top = colRect.top + colRect.height * cell.y0;
    const width = colRect.width * (cell.x1 - cell.x0);
    const height = colRect.height * (cell.y1 - cell.y0);
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  private shiftFooterRectPx<T extends {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }>(rect: T, dx: number, dy: number): T {
    return {
      ...rect,
      left: rect.left + dx,
      top: rect.top + dy,
      centerX: rect.centerX + dx,
      centerY: rect.centerY + dy,
    };
  }

  private scaleFooterRectWidthPx<T extends {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }>(rect: T, scale: number, anchorCenterX: number): T {
    const width = rect.width * scale;
    const left = anchorCenterX - width / 2;
    return {
      ...rect,
      left,
      width,
      centerX: anchorCenterX,
    };
  }

  /** Shrink owned label + count as one bar; preserves the label/count split. */
  private scaleCol1OwnedCellWidthPx<T extends {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }>(rect: T, cellId: 'ownedLabel' | 'ownedCount'): T {
    const label = this.sellFooterColCellRectPx(1, this.getSellFooterCell('ownedLabel'));
    const count = this.sellFooterColCellRectPx(1, this.getSellFooterCell('ownedCount'));
    const groupLeft = Math.min(label.left, count.left);
    const groupRight = Math.max(label.left + label.width, count.left + count.width);
    const groupW = groupRight - groupLeft;
    const newGroupW = groupW * COL1_DETAIL_CELL_WIDTH_SCALE;
    const anchorCenterX = (groupLeft + groupRight) / 2;
    const newGroupLeft = anchorCenterX - newGroupW / 2;
    const source = cellId === 'ownedLabel' ? label : count;
    const relLeft = (source.left - groupLeft) / groupW;
    const relW = source.width / groupW;
    const left = newGroupLeft + relLeft * newGroupW;
    const width = relW * newGroupW;
    return {
      ...rect,
      left,
      width,
      centerX: left + width / 2,
    };
  }

  /** Qty row horizontal center + vertical nudge within footer col2. */
  private sellCol2QtyRowAdjustPx(): { dx: number; dy: number } {
    const col = this.sellFooterColRectPx(2);
    const dy = col.height * COL2_QTY_ROW_Y_OFFSET_FRAC;
    const minus = this.shiftFooterRectPx(
      this.sellFooterColCellRectPx(2, this.getSellControlsCell('qtyMinus')),
      this.artSpanW(SELL_QTY_MINUS_OFFSET_ART_PX),
      0
    );
    const field = this.shiftFooterRectPx(
      this.sellFooterColCellRectPx(2, this.getSellControlsCell('qtyField')),
      this.artSpanW(SELL_QTY_FIELD_OFFSET_ART_PX),
      0
    );
    const plus = this.sellFooterColCellRectPx(2, this.getSellControlsCell('qtyPlus'));
    const groupLeft = Math.min(minus.left, field.left, plus.left);
    const groupRight = Math.max(
      minus.left + minus.width,
      field.left + field.width,
      plus.left + plus.width
    );
    const dx = col.centerX - (groupLeft + groupRight) / 2;
    return { dx, dy };
  }

  /** SELL / SELL ALL pair horizontal center within footer col2. */
  private sellCol2SellBtnsAdjustPx(): { dx: number } {
    const col = this.sellFooterColRectPx(2);
    const sell = this.sellFooterColCellRectPx(2, this.getSellControlsCell('sellBtn'));
    const sellAll = this.sellFooterColCellRectPx(2, this.getSellControlsCell('sellAllBtn'));
    const groupLeft = sell.left;
    const groupRight = sellAll.left + sellAll.width;
    const dx = col.centerX - (groupLeft + groupRight) / 2;
    return { dx };
  }

  /** Sell-preview detail cells — col1 of unified footer row. */
  private sellDetailCellRectPx(cell: SellFooterCellFrac): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    let rect = this.sellFooterColCellRectPx(1, cell);
    const col1 = this.sellFooterColRectPx(1);
    rect = this.shiftFooterRectPx(rect, 0, col1.height * COL1_COLUMN_Y_OFFSET_FRAC);
    if (cell.id === 'name') {
      rect = this.shiftFooterRectPx(rect, 0, col1.height * COL1_NAME_Y_OFFSET_FRAC);
    }
    if (
      COL1_NAME_OWNED_Y_OFFSET_FRAC !== 0 &&
      (cell.id === 'name' || cell.id === 'ownedLabel' || cell.id === 'ownedCount')
    ) {
      rect = this.shiftFooterRectPx(rect, 0, col1.height * COL1_NAME_OWNED_Y_OFFSET_FRAC);
    }
    if (cell.id === 'preview' || cell.id === 'sellPriceLeft') {
      rect = this.scaleFooterRectWidthPx(
        rect,
        COL1_DETAIL_CELL_WIDTH_SCALE,
        rect.centerX
      );
    } else if (cell.id === 'ownedLabel' || cell.id === 'ownedCount') {
      rect = this.scaleCol1OwnedCellWidthPx(rect, cell.id);
    }
    return rect;
  }

  /** Center sell controls — col2 of unified footer row. */
  private sellControlsCellRectPx(cell: SellFooterCellFrac): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellFooterColCellRectPx(2, cell);
    if (cell.id === 'qtyMinus' || cell.id === 'qtyField' || cell.id === 'qtyPlus') {
      const { dx, dy } = this.sellCol2QtyRowAdjustPx();
      return this.shiftFooterRectPx(base, dx, dy);
    }
    if (cell.id === 'sellBtn' || cell.id === 'sellAllBtn') {
      const { dx } = this.sellCol2SellBtnsAdjustPx();
      return this.shiftFooterRectPx(base, dx, 0);
    }
    return base;
  }

  private upgradePanelCellRectPx(cell: SellFooterCellFrac): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const col = this.sellFooterColRectPx(3);
    let rect = this.sellFooterColCellRectPx(3, cell);
    if (cell.id === 'levelBox' || cell.id === 'capacityBox') {
      rect = this.shiftFooterRectPx(rect, 0, col.height * COL3_LEVEL_TEXT_Y_OFFSET_FRAC);
    } else if (cell.id === 'coinSlot' || cell.id === 'woodSlot' || cell.id === 'stoneSlot') {
      rect = this.shiftFooterRectPx(rect, 0, col.height * COL3_COST_TEXT_Y_OFFSET_FRAC);
    }
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
    const base = this.sellControlsCellRectPx(this.getSellControlsCell('qtyMinus'));
    return this.shiftFooterRectPx(base, this.artSpanW(SELL_QTY_MINUS_OFFSET_ART_PX), 0);
  }

  private sellQtyFieldRectPx(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellControlsCellRectPx(this.getSellControlsCell('qtyField'));
    return this.shiftFooterRectPx(base, this.artSpanW(SELL_QTY_FIELD_OFFSET_ART_PX), 0);
  }

  private sellActionBtnRectPx(id: 'sellBtn' | 'sellAllBtn'): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.sellControlsCellRectPx(this.getSellControlsCell(id));
    const height = Math.max(1, base.height * COL2_SELL_BTN_HEIGHT_SCALE);
    const top =
      base.top + (base.height - height) / 2 + this.artSpanH(SELL_ACTION_BTN_OFFSET_ART_PX);
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

  private layoutCapacityProcessBgRectPx(): CapacityHeaderRectPx {
    const top = this.panelYFromTop(PROCESS_ROW_TOP_PANEL_FRAC);
    const height = this.panelH * PROCESS_ROW_HEIGHT_PANEL_FRAC * PROCESS_ROW_HEIGHT_SCALE;
    const width = this.panelW * PROCESS_BAR_WIDTH_FRAC;
    const left = this.panelLeft + this.panelW * 0.5 - width * 0.5;
    const centerX = this.panelLeft + this.panelW * 0.5;
    return {
      left,
      top,
      width,
      height,
      centerX,
      centerY: top + height / 2,
    };
  }

  private layoutCapacityTrackRectPx(): CapacityHeaderRectPx {
    const outer = this.layoutCapacityProcessBgRectPx();
    const width = outer.width * PROCESS_INNER_WIDTH_FRAC;
    const left = outer.centerX - width * 0.5;
    return {
      left,
      top: outer.top,
      width,
      height: outer.height,
      centerX: outer.centerX,
      centerY: outer.centerY,
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
    const fillLeft = track.left + track.width * CAPACITY_FILL_LEFT_TRACK_FRAC;
    const fillMaxWidth = Math.max(
      0,
      track.width * (CAPACITY_FILL_MAX_TRACK_W_FRAC - CAPACITY_FILL_LEFT_TRACK_FRAC)
    );
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
    return this.artFracCellRectPx(this.getWarehouseHeaderCell(id));
  }

  /** Stretch tab art to the slot (ShopPanel category tabs); active/inactive share one display box. */
  private layoutTabSpriteImage(
    image: Phaser.GameObjects.Image,
    width: number,
    height: number
  ): void {
    const frame = image.frame;
    image.setCrop(0, 0, frame.width, frame.height);
    image.setDisplaySize(width, height);
  }

  /** Tab display size: panelW × (artW/1536) × scale, panelH × (artH/1024) × scale. */
  private tabDisplaySizePx(tab: (typeof WAREHOUSE_TAB_LAYOUT)[number]): { w: number; h: number } {
    return {
      w:
        (this.artSpanW(tab.artW) * TAB_DISPLAY_SCALE + this.artSpanW(TAB_EXTRA_W_ART_PX)) *
        TAB_SPRITE_SCALE,
      h:
        (this.artSpanH(tab.artH) * TAB_DISPLAY_SCALE + this.artSpanH(TAB_EXTRA_H_ART_PX)) *
        TAB_SPRITE_SCALE *
        TAB_HEIGHT_SCALE,
    };
  }

  private tabGapPx(): number {
    return this.artSpanW(TAB_GAP_ART_PX);
  }

  /** Screen X for centering the tab group on the modal panel (wooden frame), not baked rail art. */
  private tabRowCenterXPx(): number {
    // Geometric panel center (visible modal after cover-crop). Baked rail art center (~0.594 via
    // fracX) sits further right; fracX(0.5) can also differ from panelLeft + panelW/2 when crop
    // uses texture frame size — prefer the panel rect the player sees.
    return this.panelLeft + this.panelW * 0.5;
  }

  /** Sum of tab sprite widths plus gaps; group is centered on modal panel X. */
  private tabRowGroupWidthPx(): number {
    const gapPx = this.tabGapPx();
    const tabCount = WAREHOUSE_TAB_LAYOUT.length;
    const tabsWidth = WAREHOUSE_TAB_LAYOUT.reduce(
      (sum, layout) => sum + this.tabDisplaySizePx(layout).w,
      0
    );
    return tabsWidth + Math.max(0, tabCount - 1) * gapPx;
  }

  private tabRowGroupLeftPx(): number {
    return this.tabRowCenterXPx() - this.tabRowGroupWidthPx() / 2;
  }

  private tabRowLeftPx(index: number): number {
    const gapPx = this.tabGapPx();
    let left = this.tabRowGroupLeftPx();
    for (let i = 0; i < index; i++) {
      left += this.tabDisplaySizePx(WAREHOUSE_TAB_LAYOUT[i]).w + gapPx;
    }
    return left;
  }

  private tabRowTopPx(): number {
    return this.panelYFromTop(TAB_ROW_TOP_PANEL_FRAC);
  }

  private tabRowCenterYPx(tabH: number): number {
    return this.tabRowTopPx() + tabH / 2;
  }

  /** Tab row wooden rail bg — centered on modal panel, width spans tab group. */
  private tabListBgRectPx(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const tabH = this.tabDisplaySizePx(WAREHOUSE_TAB_LAYOUT[0]).h;
    const centerY = this.tabRowCenterYPx(tabH);
    const width = this.tabRowGroupWidthPx();
    const height = tabH;
    const centerX = this.tabRowCenterXPx();
    return {
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
      centerX,
      centerY,
    };
  }

  private layoutTabListBackground(): void {
    const rect = this.tabListBgRectPx();
    this.tabListBg.setPosition(rect.centerX, rect.centerY);
    this.tabListBg.setDisplaySize(rect.width, rect.height);
    if (this.tabListBg.texture.key !== WAREHOUSE_TABLIST_BG_KEY) {
      this.tabListBg.setAlpha(0.35);
    } else {
      this.tabListBg.setAlpha(1);
    }
  }

  /** Tab row: fixed gap between sprites; group centered on panel; shared baseline Y below capacity. */
  private tabSpriteRectPx(index: number, tab: (typeof WAREHOUSE_TAB_LAYOUT)[number]): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const size = this.tabDisplaySizePx(tab);
    const left = this.tabRowLeftPx(index);
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
    const processBgCell = this.layoutCapacityProcessBgRectPx();
    const trackCell = this.layoutCapacityTrackRectPx();
    this.capacityProcessBg.setPosition(processBgCell.centerX, processBgCell.centerY);
    this.capacityProcessBg.setDisplaySize(processBgCell.width, processBgCell.height);
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

    this.layoutTabListBackground();

    WAREHOUSE_TAB_LAYOUT.forEach((layout, index) => {
      const tab = this.tabButtons.find((t) => t.id === layout.id);
      if (!tab) return;
      const rect = this.tabSpriteRectPx(index, layout);
      tab.image.setPosition(rect.centerX, rect.centerY);
      this.layoutTabSpriteImage(tab.image, rect.width, rect.height);
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
    const level = this.upgradePanelCellRectPx(this.getUpgradePanelCell('levelBox'));
    const capacity = this.upgradePanelCellRectPx(this.getUpgradePanelCell('capacityBox'));
    this.upgradeLevelText.setPosition(level.centerX, level.centerY);
    this.upgradeLevelText.setWordWrapWidth(level.width * 0.94);

    this.upgradeCapacityText.setPosition(capacity.centerX, capacity.centerY);
    this.upgradeCapacityText.setWordWrapWidth(capacity.width * 0.94);

    const coinPos = this.upgradeCostTextPosition('coinSlot');
    const woodPos = this.upgradeCostTextPosition('woodSlot');
    const stonePos = this.upgradeCostTextPosition('stoneSlot');
    this.upgradeCoinText.setPosition(coinPos.x, coinPos.y);
    this.upgradeCoinText.setScale(COL3_COIN_TEXT_WIDTH_SCALE, 1);
    this.upgradeWoodText.setPosition(woodPos.x, woodPos.y);
    this.upgradeWoodText.setScale(1, 1);
    this.upgradeStoneText.setPosition(stonePos.x, stonePos.y);
    this.upgradeStoneText.setScale(1, 1);

    const hit = this.upgradePanelCellRectPx(UPGRADE_HIT_CELL);
    this.upgradeHit.setPosition(hit.centerX, hit.centerY);
    this.upgradeHit.setSize(hit.width, hit.height);
  }

  /** Center-bottom qty / sell buttons aligned to footer col2. */
  private layoutSellControls(): void {
    const minus = this.sellQtyMinusRectPx();
    const field = this.sellQtyFieldRectPx();
    const plus = this.sellControlsCellRectPx(this.getSellControlsCell('qtyPlus'));
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
    const preview = this.sellDetailCellRectPx(this.getSellFooterCell('preview'));
    const name = this.sellDetailCellRectPx(this.getSellFooterCell('name'));
    const ownedLabel = this.sellDetailCellRectPx(this.getSellFooterCell('ownedLabel'));
    const ownedCount = this.sellDetailCellRectPx(this.getSellFooterCell('ownedCount'));
    const priceLeft = this.sellDetailCellRectPx(this.getSellFooterCell('sellPriceLeft'));
    const priceUse = this.sellDetailCellRectPx(this.getSellFooterCell('sellPriceUse'));

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
    this.fitSellUseBtnTextToButton();
  }

  /** Cream label on orange `ui_button` — matches SELL pills, no drop shadow. */
  private applySellUseBtnTextStyle(fontPx: number): void {
    applyWarehouseTitleLikeSizing(this.sellUseBtn, 'light', fontPx);
    this.sellUseBtn.setShadow(0, 0, '#000000', 0, false, false);
    this.sellUseBtn.setStroke(
      WAREHOUSE_TITLE_STROKE_DARK,
      Math.max(2, Math.round(fontPx * SELL_USE_BTN_STROKE_FACTOR))
    );
  }

  /** Shrink USE label if it overflows the scaled orange button art. */
  private fitSellUseBtnTextToButton(): void {
    const btnW = this.sellUseBtnImg.displayWidth;
    const btnH = this.sellUseBtnImg.displayHeight;
    if (btnW <= 0 || btnH <= 0) return;

    const maxW = Math.max(1, btnW - SELL_USE_BTN_TEXT_PAD_PX);
    const maxH = Math.max(1, btnH - SELL_USE_BTN_TEXT_PAD_PX);
    let fontPx = this.scaleFont(SELL_USE_BTN_FONT_BASE_PX);
    this.applySellUseBtnTextStyle(fontPx);
    while (
      fontPx > SELL_USE_BTN_FONT_MIN_PX &&
      (this.sellUseBtn.width > maxW || this.sellUseBtn.height > maxH)
    ) {
      fontPx -= 1;
      this.applySellUseBtnTextStyle(fontPx);
    }
  }

  private computeSellPreviewIconSize(): number {
    const { width, height } = this.sellDetailCellRectPx(this.getSellFooterCell('preview'));
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

  /** Item card display width in renderList (does not affect grid viewport metrics). */
  private computeSlotDisplayWidth(): number {
    return this.cellW * ITEM_SLOT_WIDTH_SCALE;
  }

  private slotGridStepX(): number {
    return this.cellW * ITEM_SLOT_GAP_SCALE;
  }

  private slotGridStepY(): number {
    return this.pitchCellH * ITEM_SLOT_GAP_SCALE;
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

  private createSlotQtyText(
    badgeCenterX: number,
    badgeCenterY: number,
    count: number
  ): Phaser.GameObjects.Text {
    const fontSizePx = slotQtyFontSizePx(count, this.typographyScale);
    return this.container.scene.add
      .text(
        badgeCenterX,
        badgeCenterY,
        `${count}`,
        warehouseTitleLikeTextStyle('small', {
          fontSize: `${fontSizePx}px`,
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
      WAREHOUSE_GRID_ROWS,
      Math.ceil(slotCount / WAREHOUSE_GRID_COLS),
      this.minScrollRows
    );
    return rows * this.slotGridStepY();
  }

  /** Dev/e2e: force extra scrollable rows (e.g. 8 rows when catalog has fewer item types). */
  setMinScrollRows(rows: number): void {
    this.minScrollRows = Math.max(WAREHOUSE_GRID_ROWS, rows);
    this.repaint();
  }

  private layoutItemsListBackground(): void {
    this.itemsListBg.setPosition(this.gridViewportW / 2, this.gridViewportH / 2);
    this.itemsListBg.setDisplaySize(this.gridViewportW, this.gridViewportH);
    this.scrollViewport.setPosition(this.gridLeft, this.gridTop);
    this.scrollMaskGraphics?.setPosition(this.gridLeft, this.gridTop);
    if (this.itemsListBg.texture.key !== WAREHOUSE_ITEMS_LIST_BG_KEY) {
      this.itemsListBg.setAlpha(0.35);
    } else {
      this.itemsListBg.setAlpha(1);
    }
  }

  /** Modal section bands (header / item grid / footer) — `?debugWarehouse=1`. */
  private buildModalLayoutDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];

    g.lineStyle(2, DEBUG_LAYOUT_GRID_COLOR, DEBUG_GRID_ALPHA);
    g.strokeRect(this.panelLeft, this.panelTop, this.panelW, this.panelH);

    const sections: { id: string; x0: number; x1: number; y0: number; y1: number }[] = [
      {
        id: 'headerSection',
        x0: 0,
        x1: 1,
        y0: HEADER_SECTION_TOP_FRAC,
        y1: HEADER_SECTION_BOTTOM_FRAC,
      },
      {
        id: 'gridSection',
        x0: GRID_LEFT_FRAC,
        x1: GRID_LEFT_FRAC + GRID_WIDTH_FRAC,
        y0: ITEMS_LIST_TOP_PANEL_FRAC,
        y1: ITEMS_LIST_TOP_PANEL_FRAC + ITEMS_LIST_HEIGHT_PANEL_FRAC,
      },
      {
        id: 'bottomSection',
        x0: 0,
        x1: 1,
        y0: BOTTOM_SECTION_TOP_FRAC,
        y1: BOTTOM_SECTION_BOTTOM_FRAC,
      },
    ];

    g.lineStyle(2, DEBUG_LAYOUT_GRID_COLOR, DEBUG_GRID_ALPHA * 0.85);
    for (const section of sections) {
      const rect =
        section.id === 'gridSection'
          ? (() => {
              const band = this.rectFromFrac(
                section.x0,
                section.x1,
                0,
                ITEMS_LIST_HEIGHT_PANEL_FRAC
              );
              const top = this.panelYFromTop(section.y0);
              const height = this.panelH * (section.y1 - section.y0);
              return {
                left: band.left,
                top,
                width: band.width,
                height,
                centerX: band.centerX,
                centerY: top + height / 2,
              };
            })()
          : this.rectFromFrac(section.x0, section.x1, section.y0, section.y1);
      g.strokeRect(rect.left, rect.top, rect.width, rect.height);
      labels.push(
        scene.add
          .text(rect.centerX, rect.top + 6, section.id, {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#80deea',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setAlpha(0.9)
      );
    }

    return scene.add.container(0, 0, [g, ...labels]);
  }

  private getModalSectionCellsForMetrics(): {
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }[] {
    return [
      {
        id: 'headerSection',
        ...this.rectFromFrac(0, 1, HEADER_SECTION_TOP_FRAC, HEADER_SECTION_BOTTOM_FRAC),
      },
      {
        id: 'gridSection',
        ...(() => {
          const band = this.rectFromFrac(
            GRID_LEFT_FRAC,
            GRID_LEFT_FRAC + GRID_WIDTH_FRAC,
            0,
            ITEMS_LIST_HEIGHT_PANEL_FRAC
          );
          const top = this.panelYFromTop(ITEMS_LIST_TOP_PANEL_FRAC);
          const height = this.panelH * ITEMS_LIST_HEIGHT_PANEL_FRAC;
          return { left: band.left, top, width: band.width, height };
        })(),
      },
      {
        id: 'bottomSection',
        ...this.rectFromFrac(0, 1, BOTTOM_SECTION_TOP_FRAC, BOTTOM_SECTION_BOTTOM_FRAC),
      },
    ].map(({ id, left, top, width, height }) => ({ id, left, top, width, height }));
  }

  private syncModalLayoutDebugGrid(): void {
    if (!isWarehouseGridDebug()) {
      this.modalLayoutDebugContainer?.destroy();
      this.modalLayoutDebugContainer = undefined;
      return;
    }
    this.modalLayoutDebugContainer?.destroy();
    this.modalLayoutDebugContainer = this.buildModalLayoutDebugOverlay(this.sceneRef);
    this.modalLayoutDebugContainer.setScrollFactor(0);
    this.modalLayoutDebugContainer.setDepth(WAREHOUSE_DEBUG_GRID_DEPTH - 1);
    if (this.container) {
      if (!this.container.list.includes(this.modalLayoutDebugContainer)) {
        this.container.addAt(this.modalLayoutDebugContainer, 1);
      }
    }
  }

  /** 6×2 viewport + extended rows for scroll tuning (debug only). */
  private buildDebugGridOverlay(scene: Phaser.Scene, totalRows: number): Phaser.GameObjects.Container {
    const ox = this.gridContentOffsetX;
    const stepX = this.slotGridStepX();
    const stepY = this.slotGridStepY();
    const gridW = (WAREHOUSE_GRID_COLS - 1) * stepX + this.cellW;
    const contentH = Math.max(this.gridViewportH, totalRows * stepY);
    const g = scene.add.graphics();
    g.lineStyle(1, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA * 0.55);
    for (let c = 0; c <= WAREHOUSE_GRID_COLS; c++) {
      const x = ox + (c < WAREHOUSE_GRID_COLS ? c * stepX : gridW);
      g.strokeLineShape(new Phaser.Geom.Line(x, 0, x, contentH));
    }
    for (let r = 0; r <= totalRows; r++) {
      const y = r * stepY;
      g.strokeLineShape(new Phaser.Geom.Line(ox, y, ox + gridW, y));
    }
    g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
    g.strokeRect(0, 0, this.gridViewportW, this.gridViewportH);
    if (totalRows > WAREHOUSE_GRID_ROWS) {
      g.lineStyle(1, DEBUG_GRID_COLOR, 0.45);
      g.strokeLineShape(
        new Phaser.Geom.Line(0, this.gridViewportH, this.gridViewportW, this.gridViewportH)
      );
    }

    const labels: Phaser.GameObjects.Text[] = [];
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < WAREHOUSE_GRID_COLS; col++) {
        const idx = row * WAREHOUSE_GRID_COLS + col;
        labels.push(
          scene.add
            .text(
              ox + col * stepX + this.cellW / 2,
              row * stepY + this.cellH / 2,
              `${col},${row}\n${idx}`,
              {
                fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
                color: row < WAREHOUSE_GRID_ROWS ? '#dfe963' : '#b8c94e',
                fontFamily: 'Arial',
                align: 'center',
              }
            )
            .setOrigin(0.5)
            .setAlpha(row < WAREHOUSE_GRID_ROWS ? 0.85 : 0.55)
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

  /** Sell footer row + col1 detail / col2 controls placeholders (`?debugWarehouse=1`). */
  private buildSellFooterDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    g.lineStyle(2, DEBUG_GRID_COLOR, DEBUG_GRID_ALPHA);
    const labels: Phaser.GameObjects.Text[] = [];

    const footerRegion = this.sellFooterRowRectPx();
    g.lineStyle(2, DEBUG_LAYOUT_GRID_COLOR, DEBUG_GRID_ALPHA * 0.85);
    g.strokeRect(footerRegion.left, footerRegion.top, footerRegion.width, footerRegion.height);
    labels.push(
      scene.add
        .text(
          footerRegion.centerX,
          footerRegion.top + 4,
          `sellFooterRow ${(SELL_FOOTER_ROW_WIDTH_FRAC * 100).toFixed(0)}%W`,
          {
            fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#80deea',
            fontFamily: 'Arial',
            align: 'center',
          }
        )
        .setOrigin(0.5, 0)
        .setAlpha(0.9)
    );

    for (const col of [1, 2, 3] as const) {
      const colRect = this.sellFooterColRectPx(col);
      g.lineStyle(1, DEBUG_LAYOUT_GRID_COLOR, DEBUG_GRID_ALPHA * 0.55);
      g.strokeRect(colRect.left, colRect.top, colRect.width, colRect.height);
      labels.push(
        scene.add
          .text(
            colRect.centerX,
            colRect.top + 4,
            `col${col} ${col === 1 ? 'detail' : col === 2 ? 'sell' : 'upgrade'} ${((col === 1 ? SELL_FOOTER_COL1_FRAC : col === 2 ? SELL_FOOTER_COL2_FRAC : SELL_FOOTER_COL3_FRAC) * 100).toFixed(0)}%`,
            {
              fontSize: scaledFontSizePx(DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
              color: '#80deea',
              fontFamily: 'Arial',
              align: 'center',
            }
          )
          .setOrigin(0.5, 0)
          .setAlpha(0.85)
      );
    }

    const nameCell = this.getSellFooterCell('name');
    const priceCell = this.getSellFooterCell('sellPrice');
    const rightColInset = this.sellDetailCellRectPx({
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
      const { left, top, width, height, centerX, centerY } = this.sellDetailCellRectPx(cell);
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
              : this.sellControlsCellRectPx(cell);
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
          `gap=${(SELL_FOOTER_BAND_GAP_FRAC * 100).toFixed(2)}% padTB=${(SELL_RIGHT_PAD_TOP_FRAC * 100).toFixed(2)}% padR=${(SELL_RIGHT_PAD_RIGHT_FRAC * 100).toFixed(2)}%`,
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
    if (!isWarehouseGridDebug()) {
      this.sellFooterDebugContainer?.destroy();
      this.sellFooterDebugContainer = undefined;
      return;
    }
    this.sellFooterDebugContainer?.destroy();
    this.sellFooterDebugContainer = this.buildSellFooterDebugOverlay(this.sceneRef);
    this.sellFooterDebugContainer.setScrollFactor(0);
    this.sellFooterDebugContainer.setDepth(WAREHOUSE_DEBUG_GRID_DEPTH);
    if (this.container) {
      this.container.add(this.sellFooterDebugContainer);
    }
    if (this.visible) this.bringModalHitsToTop();
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
            `${cellId}\nscale=${TAB_DISPLAY_SCALE} gap=${TAB_GAP_ART_PX}px y=${TAB_ROW_TOP_PANEL_FRAC.toFixed(4)}`,
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

    const hit = this.upgradePanelCellRectPx(UPGRADE_HIT_CELL);
    g.lineStyle(2, UPGRADE_DEBUG_HIT_COLOR, DEBUG_GRID_ALPHA);
    g.strokeRect(hit.left, hit.top, hit.width, hit.height);
    labels.push(
      scene.add
        .text(hit.centerX, hit.top + 4, `upgradeHit\ncol3 0–1`, {
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
    if (!isWarehouseGridDebug()) {
      this.upgradePanelDebugContainer?.destroy();
      this.upgradePanelDebugContainer = undefined;
      return;
    }
    this.upgradePanelDebugContainer?.destroy();
    this.upgradePanelDebugContainer = this.buildUpgradePanelDebugOverlay(this.sceneRef);
    this.upgradePanelDebugContainer.setScrollFactor(0);
    this.upgradePanelDebugContainer.setDepth(WAREHOUSE_DEBUG_GRID_DEPTH);
    if (this.container) {
      this.container.add(this.upgradePanelDebugContainer);
    }
    if (this.visible) this.bringModalHitsToTop();
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
    this.syncModalLayoutDebugGrid();
    this.syncSellFooterDebugGrid();
    this.syncUpgradePanelDebugGrid();
    this.syncHeaderDebugGrid();
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
      this.layoutTabSpriteImage(tab.image, rect.width, rect.height);
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
      WAREHOUSE_GRID_ROWS,
      Math.ceil(slots.length / WAREHOUSE_GRID_COLS) || WAREHOUSE_GRID_ROWS,
      this.minScrollRows
    );

    this.layoutItemsListBackground();
    this.syncDebugGrid(totalRows);
    this.setScrollOffset(this.scrollOffset);

    if (slots.length === 0) {
      return;
    }

    const slotDisplayW = this.computeSlotDisplayWidth();
    const iconSize = this.computeSlotIconSize(slotDisplayW, this.cellH);
    const nameWrapW = slotDisplayW * 0.92;
    const slotNameYOffsetPx = this.cellH * ITEM_SLOT_NAME_Y_OFFSET_FRAC;

    slots.forEach((slot, i) => {
      const col = i % WAREHOUSE_GRID_COLS;
      const row = Math.floor(i / WAREHOUSE_GRID_COLS);
      const cellLeft = col * this.slotGridStepX();
      const cellTop = row * this.slotGridStepY();
      const { iconCenterY, nameCenterY } = this.slotCellLayout(cellTop);
      const slotCenterX = cellLeft + this.cellW / 2;
      const slotCenterY = cellTop + this.cellH / 2;

      const slotBgKey = this.container.scene.textures.exists('ui_warehouse_item')
        ? 'ui_warehouse_item'
        : 'ui_warehouse';
      const slotBg = this.container.scene.add
        .image(slotCenterX, slotCenterY, slotBgKey)
        .setDisplaySize(slotDisplayW, this.cellH);

      const tex = this.container.scene.textures.exists(slot.iconKey) ? slot.iconKey : 'seed';
      const icon = this.container.scene.add.image(slotCenterX, iconCenterY, tex);
      icon.setOrigin(0.5, 0.5);
      icon.setDisplaySize(iconSize, iconSize);

      const nameText = this.createSlotNameText(
        slotCenterX,
        nameCenterY + slotNameYOffsetPx,
        slot.label,
        nameWrapW
      );

      const isSelected = slot.id === this.selectedSellId;
      if (isSelected) {
        const ringW = slotDisplayW * 0.94;
        const ringH = this.cellH * 0.94;
        const ring = this.container.scene.add.rectangle(
          slotCenterX,
          slotCenterY,
          ringW,
          ringH,
          0xffd700,
          0.22
        );
        this.listContainer.add(ring);
      }

      const qtyBadge = slotQtyBadgeCenterFrac();
      const slotLeft = slotCenterX - slotDisplayW / 2;
      const qtyBadgeCenterX = slotLeft + slotDisplayW * qtyBadge.x;
      const qtyBadgeCenterY = cellTop + this.cellH * qtyBadge.y;
      const qty = this.createSlotQtyText(qtyBadgeCenterX, qtyBadgeCenterY, slot.count);

      this.listContainer.add([slotBg, icon, nameText, qty]);

      const hit = this.container.scene.add
        .rectangle(
          slotCenterX,
          slotCenterY,
          slotDisplayW * 0.94,
          this.cellH * 0.94,
          0x000000,
          0.001
        )
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (slot.count <= 0) return;
        beginScrollDrag(this.scrollDrag, pointer, this.scrollOffset, 'y', () =>
          this.selectSlot(slot.id)
        );
      });
      this.listContainer.add(hit);
    });
  }

  hide(): void {
    this.hideSellQtyInput();
    clearScrollDrag(this.scrollDrag);
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
    const sellFooterRow = (() => {
      const { left, top, width, height } = this.sellFooterRowRectPx();
      return { left, top, width, height };
    })();
    const sellFooterCols = ([1, 2, 3] as const).map((col) => {
      const { left, top, width, height } = this.sellFooterColRectPx(col);
      return { id: `col${col}`, left, top, width, height };
    });
    const sellFooterCells = this.sellFooterCells.map((cell) => {
      const { left, top, width, height } = this.sellDetailCellRectPx(cell);
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
              : this.sellControlsCellRectPx(cell);
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
        displayWidth: tab.image.displayWidth,
        displayHeight: tab.image.displayHeight,
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
      warehouseCoverCrop: {
        cropX: this.warehouseCoverCrop.cropX,
        cropY: this.warehouseCoverCrop.cropY,
        cropW: this.warehouseCoverCrop.cropW,
        cropH: this.warehouseCoverCrop.cropH,
      },
      gridLeft: this.gridLeft,
      gridTop: this.gridTop,
      gridViewportW: this.gridViewportW,
      gridViewportH: this.gridViewportH,
      gridContentOffsetX: this.gridContentOffsetX,
      gridContentW: this.gridContentW,
      itemsListWidthScale: ITEMS_LIST_WIDTH_SCALE,
      itemSlotWidthScale: ITEM_SLOT_WIDTH_SCALE,
      itemSlotGapScale: ITEM_SLOT_GAP_SCALE,
      slotPitchW: this.slotGridStepX(),
      slotPitchH: this.slotGridStepY(),
      slotDisplayWidth: this.computeSlotDisplayWidth(),
      cellW: this.cellW,
      cellH: this.cellH,
      cols: WAREHOUSE_GRID_COLS,
      visibleRows: WAREHOUSE_GRID_ROWS,
      scrollOffset: this.scrollOffset,
      maxScrollOffset: this.getMaxScrollOffset(),
      slotCount: this.lastRenderedSlotCount,
      debugGrid: isWarehouseGridDebug(),
      modalSectionCells: this.getModalSectionCellsForMetrics(),
      sellFooterRow,
      sellFooterCols,
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
      tabListBg: (() => {
        const rect = this.tabListBgRectPx();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          textureKey: this.tabListBg.texture.key,
        };
      })(),
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
    this.sceneRef.input.off('pointermove', this.boundScrollPointerMove);
    this.sceneRef.input.off('pointerup', this.boundClearScrollDrag);
    this.sceneRef.input.off('pointerupoutside', this.boundClearScrollDrag);
    this.scrollViewport.clearMask(true);
    this.scrollGeometryMask?.destroy();
    this.scrollMaskGraphics?.destroy();
    this.closeHit.destroy();
    this.container.destroy();
  }
}

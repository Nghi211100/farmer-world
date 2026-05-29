import Phaser from 'phaser';
import { UI_TEXT_BACKGROUND_TEXTURE_KEY } from '../config/assets';
import { isShopGridDebug } from '../config/gameConfig';
import { HUD_MODAL_DEPTH } from './BottomMenu';
import {
  FOOD_ENERGY_RECOVERY,
  isFoodItem,
  isSeedItem,
  isShopBuyable,
  ITEM_ICON_KEYS,
  ITEM_IDS,
  ITEM_LABELS,
} from '../config/items';
import type { EconomySystem } from '../systems/EconomySystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { HUDResources } from './TopHUD';
import { computeShopModalPanelSize } from './modalPanelSize';
import {
  CATEGORY_TAB_ZONE_GAP_Y_PX,
  CATEGORY_TAB_ZONE_PAD_X_PX,
  SHOP_ART_H as SHOP_LAYOUT_ART_H,
  SHOP_ART_W as SHOP_LAYOUT_ART_W,
  SHOP_CATEGORY_TAB_COUNT,
  SHOP_GRID_COLS as SHOP_LAYOUT_GRID_COLS,
  SHOP_ITEM_GRID_OFFSET_Y_PX,
  SHOP_ITEM_GRID_PAD_TOP_FRAC,
  resolveShopProductGridViewportInset,
  SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
  SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
  SHOP_LAYOUT_DETAIL_COL_SPAN,
  SHOP_LAYOUT_DETAIL_COL_START,
  SHOP_LAYOUT_GRID_COL_SPAN,
  SHOP_LAYOUT_GRID_COL_START,
  SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
  SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
  SHOP_LAYOUT_TABS_COL_SPAN,
  SHOP_LAYOUT_TABS_COL_START,
  SHOP_MODAL_LAYOUT_COLS,
  categoryTabListHeightsFromModalAvailable,
  categoryTabListModalAvailableHeightPx,
  computeCategoryTabDimensionsFromZone,
  mapShopArtRectToPanelLocal,
  resolveShopContentRowRect,
  resolveShopLayoutTier,
  resolveShopDetailContentColRect,
  resolveShopModalColRect,
  resolveShopModalRowRect,
} from './shopModalLayout';
import {
  getModalTypographyScale,
  scaledFontSize,
  scaledFontSizePx,
} from './uiFontScale';
import {
  applyWarehouseTitleLikeSizing,
  WAREHOUSE_TITLE_FONT,
  warehouseStrokeForColor,
  warehouseTitleLikeTextStyle,
} from './warehouseTextStyle';

export interface ShopBuyResult {
  success: boolean;
  message: string;
}

/** Native size of `ui/shop-modal.png` — layout fractions tuned to this art. */
export const SHOP_ART_W = 1536;
export const SHOP_ART_H = 1024;

/** Center-crop region from `object-fit: cover` (texture px). */
export interface ObjectCoverCrop {
  texW: number;
  texH: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  scale: number;
}

/** Compute cover crop for texture → target display size (matches `applyImageObjectCover`). */
export function computeObjectCoverCrop(
  texW: number,
  texH: number,
  targetW: number,
  targetH: number
): ObjectCoverCrop {
  if (texW <= 0 || texH <= 0) {
    return { texW, texH, cropX: 0, cropY: 0, cropW: texW, cropH: texH, scale: 1 };
  }
  const scale = Math.max(targetW / texW, targetH / texH);
  const cropW = targetW / scale;
  const cropH = targetH / scale;
  const cropX = (texW - cropW) / 2;
  const cropY = (texH - cropH) / 2;
  return { texW, texH, cropX, cropY, cropW, cropH, scale };
}

/** Map shop art pixel (1536×1024 space) to screen using cover crop + panel rect. */
export function artPxToScreen(
  artX: number,
  artY: number,
  crop: ObjectCoverCrop,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { x: number; y: number } {
  const u = crop.cropW > 0 ? (artX - crop.cropX) / crop.cropW : 0;
  const v = crop.cropH > 0 ? (artY - crop.cropY) / crop.cropH : 0;
  return { x: panelLeft + u * panelW, y: panelTop + v * panelH };
}

/**
 * CSS `object-fit: cover` for a Phaser image: uniform scale to fill `targetW`×`targetH`,
 * center-crop texture overflow (avoids stretch / letterbox from transparent PNG margins).
 */
export function applyImageObjectCover(
  image: Phaser.GameObjects.Image,
  targetW: number,
  targetH: number
): ObjectCoverCrop {
  const frame = image.frame;
  const texW = frame.width;
  const texH = frame.height;
  if (texW <= 0 || texH <= 0) {
    image.setDisplaySize(targetW, targetH);
    return { texW, texH, cropX: 0, cropY: 0, cropW: texW, cropH: texH, scale: 1 };
  }
  const crop = computeObjectCoverCrop(texW, texH, targetW, targetH);
  image.setCrop(crop.cropX, crop.cropY, crop.cropW, crop.cropH);
  image.setDisplaySize(targetW, targetH);
  return crop;
}

/** Crop to a fixed art region (texture px), then cover-fit to the target display size. */
export function applyImageArtRegionCover(
  image: Phaser.GameObjects.Image,
  artX: number,
  artY: number,
  artW: number,
  artH: number,
  targetW: number,
  targetH: number
): ObjectCoverCrop {
  if (artW <= 0 || artH <= 0) {
    image.setDisplaySize(targetW, targetH);
    return { texW: artW, texH: artH, cropX: 0, cropY: 0, cropW: artW, cropH: artH, scale: 1 };
  }
  image.setCrop(artX, artY, artW, artH);
  return applyImageObjectCover(image, targetW, targetH);
}

/** Crop to a fixed art region (texture px), then stretch to exactly `targetW`×`targetH` (no letterbox). */
export function applyImageArtRegionStretch(
  image: Phaser.GameObjects.Image,
  artX: number,
  artY: number,
  artW: number,
  artH: number,
  targetW: number,
  targetH: number
): void {
  if (artW <= 0 || artH <= 0) {
    image.setDisplaySize(targetW, targetH);
    return;
  }
  image.setCrop(artX, artY, artW, artH);
  image.setDisplaySize(targetW, targetH);
}

const SHOP_OVERLAY_ALPHA = 0.001;
const COIN_TEXTURE_KEY = 'coin';
const SHOP_BG_KEY = 'ui_shop_modal';
const CARD_TEXTURE_KEY = 'ui_shop_item';
const SHOP_CATEGORY_TAB_TEXTURES: Record<
  ShopCategoryId,
  { inactive: string; active: string }
> = {
  all: { inactive: 'shop_tab_all', active: 'shop_tab_all_active' },
  seeds: { inactive: 'shop_tab_seeds', active: 'shop_tab_seeds_active' },
  animals: { inactive: 'shop_tab_animals', active: 'shop_tab_animals_active' },
  decorations: {
    inactive: 'shop_tab_decorations',
    active: 'shop_tab_decorations_active',
  },
  foods: { inactive: 'shop_tab_foods', active: 'shop_tab_foods_active' },
  resources: { inactive: 'shop_tab_resources', active: 'shop_tab_resources_active' },
};
const UI_CHECK_TEXTURE_KEY = 'ui_check';

const SHOP_LOCKED_HINT = 'Sắp ra mắt';

const GRID_COLS = SHOP_LAYOUT_GRID_COLS;
/** E2e expects 6px row gutter between product card rows. */
const GRID_ROW_GAP_PX = 6;
/** Product card display scale inside cell (matches e2e `SHOP_ITEM_CARD_SCALE`). */
const SHOP_ITEM_CARD_SCALE = 0.95;
/** Min pointer travel before grid scroll drag starts (avoids eating taps on scrollHit). */
const SCROLL_DRAG_THRESHOLD_PX = 6;

/** Modal layout overlay (tabs / grid / detail, 4×3 cells). */
const DEBUG_LAYOUT_GRID_COLOR = 0xdfe963;
const DEBUG_LAYOUT_GRID_ALPHA = 0.72;
const DEBUG_DETAIL_COLOR = 0xff9800;
/** Texture-space grid (256px + key art guides), mapped through object-cover. */
const DEBUG_ART_GRID_CYAN = 0x00e5ff;
const DEBUG_ART_GRID_MAGENTA = 0xff40ff;
const DEBUG_ART_GRID_ALPHA = 0.78;
const DEBUG_ART_CROP_OUTLINE = 0xff40ff;
const DEBUG_ART_FULL_TEX_OUTLINE = 0x00e5ff;
/** Detail buy-qty − / pill / + and BUY CTA hit guides. */
const DEBUG_BUY_QTY_HIT_COLOR = 0xff9800;
/** Child depth for debug overlay within the shop container (z-order via bringToTop). */
const SHOP_DEBUG_GRID_DEPTH = 10000;
/** Interactive hits sit above debug grid (depth + list index). */
const SHOP_HIT_DEPTH = SHOP_DEBUG_GRID_DEPTH + 100;
const ART_GRID_MAJOR_STEP_PX = 256;

/** Close button — same corner as warehouse art on 1536×1024. */
const CLOSE_BTN_OFFSET_X_PX = -20;
const CLOSE_BTN_OFFSET_Y_PX = 40;
const CLOSE_BTN_CENTER_X_FRAC = (1405 + CLOSE_BTN_OFFSET_X_PX) / SHOP_ART_W;
const CLOSE_BTN_CENTER_Y_FRAC = (120 + CLOSE_BTN_OFFSET_Y_PX) / SHOP_ART_H;
const CLOSE_BTN_RADIUS_ART_PX = 56;

/** Left vertical category tabs (6) — hit/glow on baked wooden buttons (`ui/shop-modal.png` art px). */
const CATEGORY_TAB_CENTER_X_ART_PX = 92;
/** Screen px shift applied to category tab hit/glow centers (right of baked art). */
export const CATEGORY_TAB_OFFSET_X_PX = 123;
/** Screen px shift applied to category tab hit/glow centers (up from baked art). */
export const CATEGORY_TAB_OFFSET_Y_PX = -17;
/** Vertical gap between adjacent tab hit boxes (art px). */
export const CATEGORY_TAB_GAP_PX = 0;
const CATEGORY_TAB_FIRST_CENTER_Y_ART_PX = 291;
export const CATEGORY_TAB_HIT_W_PX = 165;
export const CATEGORY_TAB_HIT_H_PX = 92;
const CATEGORY_TAB_COUNT = 6;
const CATEGORY_TAB_CENTER_X_PX = CATEGORY_TAB_CENTER_X_ART_PX + CATEGORY_TAB_OFFSET_X_PX;
const CATEGORY_TAB_CENTER_X_FRAC = CATEGORY_TAB_CENTER_X_PX / SHOP_ART_W;
const CATEGORY_TAB_HIT_W_FRAC = CATEGORY_TAB_HIT_W_PX / SHOP_ART_W;
const CATEGORY_TAB_HIT_H_FRAC = CATEGORY_TAB_HIT_H_PX / SHOP_ART_H;

/** Y centers: first baked tab + offsets, then uniform (hitH + gap) steps. */
export function buildCategoryTabCenterYPx(): number[] {
  const startY = CATEGORY_TAB_FIRST_CENTER_Y_ART_PX + CATEGORY_TAB_OFFSET_Y_PX;
  const step = CATEGORY_TAB_HIT_H_PX + CATEGORY_TAB_GAP_PX;
  return Array.from({ length: CATEGORY_TAB_COUNT }, (_, i) => startY + step * i);
}

const CATEGORY_TAB_CENTER_Y_PX = buildCategoryTabCenterYPx();
const CATEGORY_TAB_CENTERS_Y_FRAC = CATEGORY_TAB_CENTER_Y_PX.map((y) => y / SHOP_ART_H);

/** Content band column fractions (tabs / grid / detail). */
const TABS_WIDTH_FRAC = 0.125;
const GRID_WIDTH_FRAC = 0.625;

/**
 * Main content band (below header, above pagination): tabs 12.5%, grid 62.5%, detail 25%.
 * Insets tightened vs baked art margins so the split uses more panel width.
 */
const CONTENT_LEFT_PX = 150;
const CONTENT_RIGHT_PX = 1350;
const CONTENT_WIDTH_PX = CONTENT_RIGHT_PX - CONTENT_LEFT_PX;
const TABS_WIDTH_PX = Math.round(CONTENT_WIDTH_PX * TABS_WIDTH_FRAC);
const GRID_WIDTH_PX = Math.round(CONTENT_WIDTH_PX * GRID_WIDTH_FRAC);
const GRID_LEFT_PX = CONTENT_LEFT_PX + TABS_WIDTH_PX;
const DETAIL_LEFT_PX = GRID_LEFT_PX + GRID_WIDTH_PX;

/** Product grid inset on cream panel — legacy art px guides for debug overlay. */
const GRID_TOP_FRAC = 235 / SHOP_ART_H;
const GRID_HEIGHT_FRAC = 520 / SHOP_ART_H;

/** Inset for product cards inside the grid scroll viewport. */
const GRID_CONTENT_PAD_LEFT_PX = 20;
const GRID_CONTENT_PAD_RIGHT_PX = 15;

/** Product grid card scale vs prior art (width +5.06%, height −13.38% cumulative). */
const GRID_CARD_W_SCALE = 1.02 * 1.03;
const GRID_CARD_H_SCALE = 0.97 * 0.95 * 0.94 * 1.07 * 1.01 * 1.02 * 1.10 * 0.98 * 0.97 * 1.02 * 1.005;
/** Product card fit box vs cell — lower width = narrower hit zone and more gutter. */
const GRID_CARD_W_FRAC = 0.88 * GRID_CARD_W_SCALE;
/** Card / hit height vs cell pitch. */
const GRID_CARD_H_FRAC = GRID_CARD_H_SCALE;
const GRID_HIT_W_FRAC = GRID_CARD_W_FRAC;
const GRID_HIT_H_FRAC = GRID_CARD_H_FRAC;
/** `ui_shop_item` frame drawn larger than fit box; width clamped, height capped for row gap. */
const GRID_CARD_BG_SCALE = 1.12;
const GRID_CARD_BG_MAX_W_FRAC = 0.96 * GRID_CARD_W_SCALE;
/** Legacy overlap removed — row spacing uses GRID_ROW_GAP_PX only. */
const GRID_ROW_OVERLAP_PX = 0;
/** Selected grid check: inset from top of card (fraction of card height). */
const GRID_CARD_CHECK_TOP_FRAC = 0.15;
/** Selected grid check: inset from right of card (fraction of card width). */
const GRID_CARD_CHECK_RIGHT_FRAC = 0.20;
/** Selected grid check: square, 30% of prior (0.8 × 0.30) of footer band size per side. */
const GRID_CARD_CHECK_SIZE_FRAC = 0.8 * 0.3;
/** Grid card coin + price row: width as fraction of card width, centered horizontally. */
const GRID_CARD_FOOTER_W_FRAC = 0.8;
/** Grid card coin + price row: band height for coin sizing (fraction of card height). */
const GRID_CARD_FOOTER_H_FRAC = 0.3;
/** Grid card coin + price row: center Y inset from card bottom (fraction of card height). */
const GRID_CARD_FOOTER_BOTTOM_FRAC = 0.225;
/** Grid card footer coin display scale (90% of base coin size; +50% vs 0.6). */
const GRID_CARD_FOOTER_COIN_SCALE = 0.9;
/** Grid card footer price amount font scale (+72% vs base 13px; +20% vs 1.43). */
const GRID_CARD_FOOTER_PRICE_FONT_SCALE = 1.43 * 1.2;
/** Grid card footer coin + amount. */
const GRID_CARD_PRICE_FONT_SIZE_PX = 13;
const GRID_CARD_PRICE_COIN_AMOUNT_GAP_FRAC = 0.035;
/** Item icon scales from hit box, not boosted bg art (detail panel uses DETAIL_ICON_SIZE_FRAC). */
const GRID_ICON_SIZE_W_FRAC = 0.46 * 1.03 * GRID_CARD_W_SCALE;
const GRID_ICON_SIZE_H_FRAC = 0.46 * 0.99 * GRID_CARD_H_SCALE;

const DETAIL_TITLE_Y_FRAC = 0.095;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on title center. */
const DETAIL_TITLE_Y_OFFSET_FRAC = 0.03;
const DETAIL_ICON_Y_FRAC = 0.305;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on icon center. */
const DETAIL_ICON_Y_OFFSET_FRAC = -0.07;
/** Fits item art inside cream preview slot without overlapping stats / CTA. */
const DETAIL_ICON_SIZE_FRAC = 0.17 * 1.1 * 1.5 * 1.5;
const DETAIL_STAT_Y0_FRAC = 0.54;
const DETAIL_STAT_ROW_STEP_FRAC = 0.055 * 0.97 * 0.95 * 0.96;
/** Width of stat line pill bg as fraction of detail band width. */
const DETAIL_STAT_BG_WIDTH_FRAC = 0.9;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on stats block. */
const DETAIL_STATS_Y_OFFSET_FRAC = -0.16;
/** Detail info band — left coin pill + price below (baked `ui/shop-modal.png` art px). */
const DETAIL_COIN_BOX_X0_PX = 1092;
const DETAIL_COIN_BOX_X1_PX = 1162;
const DETAIL_COIN_BOX_Y0_PX = 592;
const DETAIL_PRICE_AMOUNT_Y0_PX = 652;
const DETAIL_PRICE_AMOUNT_Y1_PX = 674;
/** Art px: shift price box below baked band — scaled via panel layout at layout time. */
const DETAIL_PRICE_BOX_OFFSET_Y_ART_PX = 30;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on top of art-mapped price box. */
const DETAIL_PRICE_Y_OFFSET_FRAC = 0.07;
/** Extra height beyond baked price amount band (`ui_box` displayH). */
const DETAIL_PRICE_BOX_EXTRA_H_PX = 35;
/** Scale {@link detailPriceBoxRect} height (display + hit). */
const DETAIL_PRICE_BOX_HEIGHT_SCALE = 1.155 * 1.05 * 1.1;
/** Inner row: gap between coin icon and amount (fraction of display width). */
const DETAIL_PRICE_COIN_AMOUNT_GAP_FRAC = 0.035;
/** Coin icon cap inside taller price box (+50% vs prior 24×1.1). */
const DETAIL_PRICE_COIN_MAX_SIZE_PX = 24 * 1.1 * 1.5;
/** Unit price amount text inside `ui_box` (coin + number row; +20% vs prior 16×1.1). */
const DETAIL_PRICE_AMOUNT_FONT_SIZE_PX = 16 * 1.1 * 1.2;
const DETAIL_TITLE_FONT_BASE_PX = 16;
const DETAIL_STAT_FONT_BASE_PX = 12 * 1.2;
const PAGE_LABEL_FONT_BASE_PX = 13;
const TOAST_FONT_BASE_PX = 13;
const SHOP_DEBUG_LABEL_FONT_BASE_PX = 8;
const SHOP_DEBUG_LABEL_SMALL_BASE_PX = 7;
const SHOP_CATEGORY_DEBUG_LABEL_BASE_PX = 9;
const DETAIL_INFO_Y_FRAC = DETAIL_COIN_BOX_Y0_PX / SHOP_ART_H;
const DETAIL_INFO_H_FRAC = (DETAIL_PRICE_AMOUNT_Y1_PX - DETAIL_COIN_BOX_Y0_PX) / SHOP_ART_H;
const UI_BOX_TEXTURE_KEY = 'ui_box';
/** Registered in `assets.ts` as `ui/plus-devide.png` (− / pill / + row). */
const UI_PLUS_DEVIDE_TEXTURE_KEY = 'ui_plus_devide';
const DETAIL_CTA_Y_FRAC = 0.87;

/** Baked detail BUY CTA on `ui/shop-modal.png` (1536×1024 art px). */
const DETAIL_BUY_X0_PX = 1070;
const DETAIL_BUY_X1_PX = 1330;
const DETAIL_BUY_Y0_PX = 650;
const DETAIL_BUY_Y1_PX = 724;
/** Art px: shift BUY CTA hit zone below baked art — scaled via `artSpanH`. */
export const DETAIL_BUY_OFFSET_Y_ART_PX = 70;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on top of art-mapped BUY hit. */
const DETAIL_BUY_Y_OFFSET_FRAC = 0.15;
/** Scale BUY CTA height in layout, display, and hit zones. */
const DETAIL_BUY_HEIGHT_SCALE = 1.02;

/** Baked buy-qty row on `ui/shop-modal.png` (1536×1024 art px) — golden − / pill / + above price. */
const DETAIL_BUY_QTY_ROW_Y0_PX = 611;
const DETAIL_BUY_QTY_ROW_Y1_PX = 643;
/** Additive Y nudge (fraction of {@link detailBandRect} height) on top of art-mapped qty row. */
const DETAIL_QTY_Y_OFFSET_FRAC = 0.03;
/** Scale qty row height in layout, display, and hit zones. */
const DETAIL_BUY_QTY_ROW_HEIGHT_SCALE = 1.071 * 1.05 * 1.1;
const DETAIL_BUY_QTY_MINUS_X0_PX = 1092;
const DETAIL_BUY_QTY_MINUS_X1_PX = 1138;
const DETAIL_BUY_QTY_FIELD_X0_PX = 1140;
const DETAIL_BUY_QTY_FIELD_X1_PX = 1271;
const DETAIL_BUY_QTY_PLUS_X0_PX = 1273;
const DETAIL_BUY_QTY_PLUS_X1_PX = 1321;
const DETAIL_BUY_QTY_FONT_MIN_PX = 14;
const DETAIL_BUY_QTY_FONT_HEIGHT_FRAC = 0.55;
/** Extra width on − / + hit rects only (`buyQtyBtnHitRectFromArt`); does not resize the bg sprite. */
const DETAIL_BUY_QTY_BTN_EXTRA_W_PX = 11;
/** Extra height on − / + hit rects only (`buyQtyBtnHitRectFromArt`); does not resize the bg sprite. */
const DETAIL_BUY_QTY_BTN_EXTRA_H_PX = 5;
/** Extra display height for `ui_plus_devide` (`buyQtyDisplayRowRect`). */
const DETAIL_BUY_QTY_BG_EXTRA_H_PX = DETAIL_BUY_QTY_BTN_EXTRA_H_PX + 31;
/** Extra width on qty pill hit / input / display only (`buyQtyFieldHitRectFromArt`); does not resize bg or −/+ hits. */
const DETAIL_BUY_QTY_FIELD_EXTRA_W_PX = 10;
/** Extra height on qty pill hit / input / display only (`buyQtyFieldHitRectFromArt`); does not resize bg or −/+ hits. */
const DETAIL_BUY_QTY_FIELD_EXTRA_H_PX = 3;

/** Bottom pagination bar. */
const PAGINATION_Y_FRAC = 937 / SHOP_ART_H;
const PAGINATION_PREV_X_FRAC = 598 / SHOP_ART_W;
const PAGINATION_NEXT_X_FRAC = 938 / SHOP_ART_W;
const PAGINATION_LABEL_X_FRAC = 768 / SHOP_ART_W;
const PAGINATION_TAB_X0_FRAC = 858 / SHOP_ART_W;
const PAGINATION_TAB_STEP_FRAC = 68 / SHOP_ART_W;

const SHOP_CATALOG = [
  { id: ITEM_IDS.SEEDS_WHEAT },
  { id: ITEM_IDS.SEEDS_CORN },
  { id: ITEM_IDS.SEEDS_CARROT },
  { id: ITEM_IDS.SEEDS_TOMATO },
  { id: ITEM_IDS.SEEDS_PUMPKIN },
  { id: ITEM_IDS.CANDY },
  { id: ITEM_IDS.MILK },
  { id: ITEM_IDS.COOKIE },
  { id: ITEM_IDS.BREAD },
  { id: ITEM_IDS.JUICE },
  { id: ITEM_IDS.CAKE },
  { id: ITEM_IDS.FLOUR },
] as const;

export type ShopCategoryId =
  | 'all'
  | 'seeds'
  | 'animals'
  | 'decorations'
  | 'foods'
  | 'resources';

const SHOP_CATEGORIES: { id: ShopCategoryId; locked: boolean }[] = [
  { id: 'all', locked: false },
  { id: 'seeds', locked: false },
  { id: 'animals', locked: true },
  { id: 'decorations', locked: false },
  { id: 'foods', locked: false },
  { id: 'resources', locked: false },
];

function catalogIdsForCategory(cat: ShopCategoryId): string[] {
  return SHOP_CATALOG.filter(({ id }) => {
    if (!isShopBuyable(id)) return false;
    if (cat === 'all') return true;
    if (cat === 'seeds') return isSeedItem(id);
    if (cat === 'foods') return isFoodItem(id);
    if (cat === 'resources') return id === ITEM_IDS.FLOUR;
    return false;
  }).map(({ id }) => id);
}

interface CategoryTabUi {
  id: ShopCategoryId;
  locked: boolean;
  bg: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
}

function buildDimOutsidePanel(
  scene: Phaser.Scene,
  viewportW: number,
  viewportH: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): Phaser.GameObjects.Rectangle[] {
  const panelRight = panelLeft + panelW;
  const panelBottom = panelTop + panelH;
  const color = 0x000000;
  const alpha = SHOP_OVERLAY_ALPHA;
  const rects: Phaser.GameObjects.Rectangle[] = [];

  if (panelTop > 0) {
    rects.push(
      scene.add.rectangle(viewportW / 2, panelTop / 2, viewportW, panelTop, color, alpha)
    );
  }
  if (panelBottom < viewportH) {
    const h = viewportH - panelBottom;
    rects.push(
      scene.add.rectangle(viewportW / 2, panelBottom + h / 2, viewportW, h, color, alpha)
    );
  }
  if (panelLeft > 0) {
    rects.push(
      scene.add.rectangle(panelLeft / 2, viewportH / 2, panelLeft, viewportH, color, alpha)
    );
  }
  if (panelRight < viewportW) {
    const w = viewportW - panelRight;
    rects.push(
      scene.add.rectangle(panelRight + w / 2, viewportH / 2, w, viewportH, color, alpha)
    );
  }

  for (const rect of rects) {
    rect.setScrollFactor(0);
    rect.setInteractive();
  }
  return rects;
}

export class ShopPanel {
  private readonly scene: Phaser.Scene;
  private viewportW: number;
  private viewportH: number;
  private container: Phaser.GameObjects.Container;
  private dimOverlayRects: Phaser.GameObjects.Rectangle[] = [];
  private visible = false;
  private panelW = 0;
  private panelH = 0;
  private panelLeft = 0;
  private panelTop = 0;
  private cx = 0;
  private cy = 0;

  private economy?: EconomySystem;
  private inventory?: InventorySystem;

  private categoryTabs: CategoryTabUi[] = [];
  private activeCategory: ShopCategoryId = 'all';

  private filteredIds: string[] = [];
  private currentPage = 0;
  private selectedId: string | null = null;

  private gridLeft = 0;
  private gridTop = 0;
  private gridViewportW = 0;
  private gridViewportH = 0;
  private gridContentW = 0;
  private pitchCellH = 0;
  private cellW = 0;
  private cellH = 0;
  private gridContentPadLeft = 0;
  private gridContentPadRight = 0;
  private gridContentPadTop = 0;
  private cardDisplayW = 0;
  private cardDisplayH = 0;
  private cardTex = '';
  private gridRows = 2;
  private tabListLeft = 0;
  private tabListTop = 0;
  private tabListViewportW = 0;
  private tabListViewportH = 0;
  private tabListContentH = 0;
  private tabListModalAvailableH = 0;
  private tabItemScale = 1;

  private scrollViewport!: Phaser.GameObjects.Container;
  private scrollContent!: Phaser.GameObjects.Container;
  private itemsBgContainer!: Phaser.GameObjects.Container;
  private listContainer!: Phaser.GameObjects.Container;
  private scrollMaskGraphics?: Phaser.GameObjects.Graphics;
  private scrollGeometryMask?: Phaser.Display.Masks.GeometryMask;
  private scrollHit!: Phaser.GameObjects.Rectangle;
  private scrollOffset = 0;
  private scrollDragActive = false;
  private scrollDragPointerId: number | null = null;
  private scrollDragStartY = 0;
  private scrollDragStartOffset = 0;
  private readonly boundClearScrollDrag: () => void;
  private lastRenderedSlotCount = 0;
  private gridCellHits: Phaser.GameObjects.Rectangle[] = [];
  private readonly boundWheel: (
    pointer: Phaser.Input.Pointer,
    over: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event?: WheelEvent
  ) => void;
  private detailTitle!: Phaser.GameObjects.Text;
  private detailIcon!: Phaser.GameObjects.Image;
  private detailStatBgs: Phaser.GameObjects.Image[] = [];
  private detailStatLines: Phaser.GameObjects.Text[] = [];
  private detailPriceBox!: Phaser.GameObjects.Image;
  private detailPriceCoin!: Phaser.GameObjects.Image;
  private detailPriceAmount!: Phaser.GameObjects.Text;
  private detailBuyQtyBg!: Phaser.GameObjects.Image;
  private detailBuyQtyText!: Phaser.GameObjects.Text;
  private buyMinusHit!: Phaser.GameObjects.Rectangle;
  private buyQtyFieldHit!: Phaser.GameObjects.Rectangle;
  private buyPlusHit!: Phaser.GameObjects.Rectangle;
  private buyQtyInputEl: HTMLInputElement | null = null;
  private buyQuantity = 1;
  private buyMainHit!: Phaser.GameObjects.Rectangle;

  private pageLabel!: Phaser.GameObjects.Text;
  private pageTabHits: Phaser.GameObjects.Rectangle[] = [];
  private pageTabHighlights: Phaser.GameObjects.Rectangle[] = [];
  private prevPageHit!: Phaser.GameObjects.Rectangle;
  private nextPageHit!: Phaser.GameObjects.Rectangle;

  private toastText!: Phaser.GameObjects.Text;
  private testGridPadding = 0;
  private closeHit!: Phaser.GameObjects.Arc;
  private panelBg!: Phaser.GameObjects.Image;
  private shopCoverCrop!: ObjectCoverCrop;
  private debugGridContainer?: Phaser.GameObjects.Container;
  /** Combined viewport tier × panel artSpanH ratio (see `uiFontScale.ts`). */
  private typographyScale = 1;

  private onBuy?: (result: ShopBuyResult) => void;

  private get gridPageSize(): number {
    return GRID_COLS * this.gridRows;
  }

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.boundClearScrollDrag = () => {
      this.scrollDragActive = false;
      this.scrollDragPointerId = null;
    };
    this.boundWheel = (pointer, _over, _dx, dy, _dz, event) => {
      if (!this.visible) return;
      if (!this.isPointerInGrid(pointer)) return;
      event?.stopPropagation();
      this.scrollBy(dy);
    };
    this.viewportW = width;
    this.viewportH = height;
    ({ panelW: this.panelW, panelH: this.panelH } = computeShopModalPanelSize(
      width,
      height,
      SHOP_ART_W,
      SHOP_ART_H
    ));
    this.cx = width / 2;
    this.cy = height / 2;
    this.panelLeft = this.cx - this.panelW / 2;
    this.panelTop = this.cy - this.panelH / 2;

    this.dimOverlayRects = buildDimOutsidePanel(
      scene,
      width,
      height,
      this.panelLeft,
      this.panelTop,
      this.panelW,
      this.panelH
    );

    const panelBgKey = scene.textures.exists(SHOP_BG_KEY) ? SHOP_BG_KEY : 'ui_warehouse';
    const panelBg = scene.add.image(this.cx, this.cy, panelBgKey);
    panelBg.setScrollFactor(0);
    this.panelBg = panelBg;
    panelBg.setDisplaySize(this.panelW, this.panelH);
    const frame = panelBg.frame;
    this.shopCoverCrop = computeObjectCoverCrop(
      frame.width,
      frame.height,
      this.panelW,
      this.panelH
    );

    this.buildCategoryTabs(scene);
    this.buildProductGrid(scene);
    this.buildDetailPanel(scene);
    this.buildPagination(scene);

    this.toastText = scene.add
      .text(this.cx, this.fracY(0.86), '', {
        ...warehouseTitleLikeTextStyle('light', { fontSize: '13px' }),
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    const closeY = this.fracY(CLOSE_BTN_CENTER_Y_FRAC);
    const closeX = this.fracX(CLOSE_BTN_CENTER_X_FRAC);
    const closeRadius = this.spanW(CLOSE_BTN_RADIUS_ART_PX / SHOP_ART_W);

    this.closeHit = scene.add
      .circle(closeX, closeY, closeRadius, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    const stopHudLeak = (event?: Phaser.Types.Input.EventData) => event?.stopPropagation();
    const onClose = (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event?: Phaser.Types.Input.EventData
    ) => {
      stopHudLeak(event);
      this.hide();
    };

    this.closeHit.on('pointerdown', onClose);
    this.closeHit.on('pointerup', onClose);

    this.container = scene.add.container(0, 0, [
      ...this.dimOverlayRects,
      panelBg,
      ...this.categoryTabs.flatMap((t) => [t.bg, t.glow, ...(t.label ? [t.label] : []), t.hit]),
      this.scrollHit,
      this.scrollViewport,
      this.scrollMaskGraphics!,
      this.detailTitle,
      this.detailIcon,
      ...this.detailStatBgs,
      ...this.detailStatLines,
      this.detailPriceBox,
      this.detailPriceCoin,
      this.detailPriceAmount,
      this.detailBuyQtyBg,
      this.detailBuyQtyText,
      this.buyMinusHit,
      this.buyQtyFieldHit,
      this.buyPlusHit,
      this.buyMainHit,
      this.prevPageHit,
      this.nextPageHit,
      this.pageLabel,
      ...this.pageTabHits,
      ...this.pageTabHighlights,
      this.toastText,
      this.closeHit,
    ]);
    this.container.setDepth(HUD_MODAL_DEPTH);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    this.filteredIds = catalogIdsForCategory('all');
    this.selectedId = this.filteredIds[0] ?? null;
    this.syncCategoryTabTextures();
    this.layoutShopPanel();
    this.syncDebugGrid();
  }

  /** Recompute panel geometry and all regions after viewport resize (same pattern as category tabs). */
  resize(viewportW: number, viewportH: number): void {
    this.viewportW = viewportW;
    this.viewportH = viewportH;
    this.updatePanelGeometry();
    this.layoutShopPanel();
    if (this.economy) {
      this.refreshGrid();
      this.refreshDetail();
      this.refreshPagination();
    }
    if (this.visible) {
      this.syncDebugGrid();
      this.bringDebugGridToTop();
      this.bringBuyControlsToTop();
    }
  }

  private updatePanelGeometry(): void {
    ({ panelW: this.panelW, panelH: this.panelH } = computeShopModalPanelSize(
      this.viewportW,
      this.viewportH,
      SHOP_ART_W,
      SHOP_ART_H
    ));
    this.cx = this.viewportW / 2;
    this.cy = this.viewportH / 2;
    this.panelLeft = this.cx - this.panelW / 2;
    this.panelTop = this.cy - this.panelH / 2;
    this.panelBg.setPosition(this.cx, this.cy);
    this.panelBg.setDisplaySize(this.panelW, this.panelH);
    const frame = this.panelBg.frame;
    this.shopCoverCrop = computeObjectCoverCrop(
      frame.width,
      frame.height,
      this.panelW,
      this.panelH
    );
  }

  private layoutDimOverlays(): void {
    const vw = this.viewportW;
    const vh = this.viewportH;
    const panelRight = this.panelLeft + this.panelW;
    const panelBottom = this.panelTop + this.panelH;
    let i = 0;
    if (this.panelTop > 0) {
      this.dimOverlayRects[i]?.setPosition(vw / 2, this.panelTop / 2);
      this.dimOverlayRects[i]?.setSize(vw, this.panelTop);
      i++;
    }
    if (panelBottom < vh) {
      const h = vh - panelBottom;
      this.dimOverlayRects[i]?.setPosition(vw / 2, panelBottom + h / 2);
      this.dimOverlayRects[i]?.setSize(vw, h);
      i++;
    }
    if (this.panelLeft > 0) {
      this.dimOverlayRects[i]?.setPosition(this.panelLeft / 2, vh / 2);
      this.dimOverlayRects[i]?.setSize(this.panelLeft, vh);
      i++;
    }
    if (panelRight < vw) {
      const w = vw - panelRight;
      this.dimOverlayRects[i]?.setPosition(panelRight + w / 2, vh / 2);
      this.dimOverlayRects[i]?.setSize(w, vh);
    }
  }

  private layoutShopPanel(): void {
    this.typographyScale = getModalTypographyScale(
      this.viewportW,
      this.viewportH,
      (artPx) => this.artSpanH(artPx),
      SHOP_ART_W,
      SHOP_ART_H,
      computeShopModalPanelSize
    );
    this.layoutDimOverlays();
    this.layoutCategoryTabs();
    this.layoutProductGrid();
    this.layoutDetailPanel();
    this.layoutPagination();
    this.layoutCloseButton();
    this.layoutShopTypography();
    this.toastText.setPosition(this.cx, this.fracY(0.86));
  }

  private scaleFont(basePx: number): number {
    return scaledFontSize(basePx, this.typographyScale);
  }

  /** Apply responsive font sizes to shop modal labels. */
  private layoutShopTypography(): void {
    applyWarehouseTitleLikeSizing(
      this.detailTitle,
      'dark',
      this.scaleFont(DETAIL_TITLE_FONT_BASE_PX)
    );
    const statPx = this.scaleFont(DETAIL_STAT_FONT_BASE_PX);
    this.detailStatLines.forEach((line) => applyWarehouseTitleLikeSizing(line, 'dark', statPx));
    applyWarehouseTitleLikeSizing(this.pageLabel, 'light', this.scaleFont(PAGE_LABEL_FONT_BASE_PX));
    applyWarehouseTitleLikeSizing(this.toastText, 'light', this.scaleFont(TOAST_FONT_BASE_PX));
    for (const tab of this.categoryTabs) {
      tab.label?.setFontSize(
        scaledFontSizePx(SHOP_CATEGORY_DEBUG_LABEL_BASE_PX, this.typographyScale)
      );
    }
  }

  private layoutProductGrid(): void {
    const tier = this.layoutTier();
    this.gridRows = tier.gridRows;
    const gridBand = this.modalZoneRect(
      SHOP_LAYOUT_GRID_COL_START,
      SHOP_LAYOUT_GRID_COL_SPAN
    );
    const gridViewportInset = resolveShopProductGridViewportInset(gridBand.height);
    const gridOffsetY = this.artSpanOnPanelH(SHOP_ITEM_GRID_OFFSET_Y_PX);
    this.gridLeft = gridBand.left;
    this.gridTop = gridBand.top + gridViewportInset.viewportTopOffsetPx + gridOffsetY;
    this.gridViewportW = gridBand.width;
    this.gridViewportH = gridViewportInset.viewportHeightPx;
    this.gridContentPadLeft = this.artSpanOnPanelW(GRID_CONTENT_PAD_LEFT_PX);
    this.gridContentPadRight = this.artSpanOnPanelW(GRID_CONTENT_PAD_RIGHT_PX);
    this.gridContentPadTop = gridBand.height * SHOP_ITEM_GRID_PAD_TOP_FRAC;
    this.gridContentW =
      this.gridViewportW - this.gridContentPadLeft - this.gridContentPadRight;
    this.pitchCellH = this.gridViewportH / this.gridRows;
    this.cellW = this.gridContentW / GRID_COLS;
    this.cellH = this.pitchCellH;

    const cardMaxH = Math.max(8, this.cellH - GRID_ROW_GAP_PX);
    const cardFrame = this.scene.textures.get(this.cardTex).get();
    const cardFitScale = (cardMaxH / cardFrame.height) * SHOP_ITEM_CARD_SCALE;
    const cardFitW = cardFrame.width * cardFitScale;
    const cardFitH = cardMaxH;
    const bgCapW = this.cellW * GRID_CARD_BG_MAX_W_FRAC;
    this.cardDisplayW = Math.min(cardFitW * GRID_CARD_W_SCALE, bgCapW);
    this.cardDisplayH = cardFitH * GRID_CARD_H_SCALE;

    this.scrollViewport.setPosition(this.gridLeft, this.gridTop);
    this.itemsBgContainer.setPosition(this.gridContentPadLeft, this.gridContentPadTop);
    this.listContainer.setPosition(this.gridContentPadLeft, this.gridContentPadTop);
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

  private layoutDetailPanel(): void {
    const detail = this.detailBandRect();
    const padX = detail.width * 0.08;
    const titleYFrac = DETAIL_TITLE_Y_FRAC + DETAIL_TITLE_Y_OFFSET_FRAC;
    this.detailTitle.setPosition(detail.centerX, detail.top + detail.height * titleYFrac);
    this.detailTitle.setWordWrapWidth(detail.width - padX * 2);

    const iconYFrac = DETAIL_ICON_Y_FRAC + DETAIL_ICON_Y_OFFSET_FRAC;
    const iconSize = Math.min(detail.width, detail.height) * DETAIL_ICON_SIZE_FRAC;
    this.detailIcon
      .setPosition(detail.centerX, detail.top + detail.height * iconYFrac)
      .setDisplaySize(iconSize, iconSize);

    const statY0Frac = DETAIL_STAT_Y0_FRAC + DETAIL_STATS_Y_OFFSET_FRAC;
    const { width: statBgWidth, height: statBgHeight } = this.detailStatBgDisplaySize(
      detail.width
    );
    this.syncDetailStatBgTextures();
    this.detailStatBgs.forEach((bg, row) => {
      bg.setPosition(
        detail.centerX,
        detail.top + detail.height * (statY0Frac + row * DETAIL_STAT_ROW_STEP_FRAC)
      );
      bg.setDisplaySize(statBgWidth, statBgHeight);
      bg.setAlpha(1);
    });
    this.detailStatLines.forEach((line, row) => {
      line.setPosition(
        detail.centerX,
        detail.top + detail.height * (statY0Frac + row * DETAIL_STAT_ROW_STEP_FRAC)
      );
      line.setWordWrapWidth(detail.width - padX * 2);
    });

    const priceBox = this.detailPriceBoxRect();
    this.detailPriceBox.setPosition(priceBox.centerX, priceBox.centerY);
    this.detailPriceBox.setDisplaySize(priceBox.width, priceBox.height);
    this.layoutDetailPriceRow();
    this.layoutDetailBuyQtyRow();
    this.layoutBuyQtyHitZones();
    this.layoutBuyMainHit();
    if (this.detailBuyQtyText?.visible) {
      const field = this.buyQtyFieldHitRectFromArt(
        DETAIL_BUY_QTY_FIELD_X0_PX,
        DETAIL_BUY_QTY_FIELD_X1_PX,
        DETAIL_BUY_QTY_ROW_Y0_PX,
        DETAIL_BUY_QTY_ROW_Y1_PX
      );
      const fontPx = this.buyQtyFontSizePx(field.height);
      applyWarehouseTitleLikeSizing(this.detailBuyQtyText, 'light', fontPx);
      this.detailBuyQtyText.setPosition(field.centerX, field.centerY);
    }
  }

  private layoutPagination(): void {
    const py = this.fracY(PAGINATION_Y_FRAC);
    const prevX = this.fracX(PAGINATION_PREV_X_FRAC);
    const labelX = this.fracX(PAGINATION_LABEL_X_FRAC);
    const tabW = this.spanW(0.042);
    const tabH = this.spanH(0.048);
    this.prevPageHit.setPosition(prevX, py).setSize(tabW * 1.2, tabH);
    this.nextPageHit.setPosition(this.fracX(PAGINATION_NEXT_X_FRAC), py).setSize(tabW * 1.2, tabH);
    this.pageLabel.setPosition(labelX, py);
    this.pageTabHits.forEach((hit, i) => {
      const tx = this.fracX(PAGINATION_TAB_X0_FRAC + i * PAGINATION_TAB_STEP_FRAC);
      hit.setPosition(tx, py).setSize(tabW, tabH);
      this.pageTabHighlights[i]?.setPosition(tx, py).setSize(tabW, tabH);
    });
  }

  private layoutCloseButton(): void {
    const closeCol = resolveShopModalColRect(11, 1, this.panelW);
    const headerRow = resolveShopModalRowRect(
      SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
      SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
      this.panelH
    );
    const closeX = this.panelLeft + closeCol.leftPanelPx + closeCol.widthPanelPx / 2;
    const closeY = this.panelTop + headerRow.topPanelPx + headerRow.heightPanelPx / 2;
    const closeRadius = Math.min(closeCol.widthPanelPx, headerRow.heightPanelPx) * 0.42;
    this.closeHit.setPosition(closeX, closeY);
    this.closeHit.setRadius(Math.max(closeRadius, 12));
  }

  /**
   * Dual debug overlays when `isShopGridDebug()` is on:
   * - Yellow: modal layout (tabs / grid / detail, 4×3) — linear art fractions → panel.
   * - Cyan / magenta: texture-space guides on `ui_shop_modal` mapped through object-cover crop.
   *
   * Off by default. Enable with `?debugShopGrid=1` or `__FARMER_WORLD_TEST__?.setShopDebugGrid(true)`.
   */
  private buildLayoutDebugGridOverlay(): Phaser.GameObjects.Container {
    const scene = this.scene;
    const g = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];

    g.lineStyle(2, DEBUG_LAYOUT_GRID_COLOR, DEBUG_LAYOUT_GRID_ALPHA);
    g.strokeRect(this.panelLeft, this.panelTop, this.panelW, this.panelH);

    const headerRow = resolveShopModalRowRect(
      SHOP_LAYOUT_HEADER_ROW_TOP_FRAC,
      SHOP_LAYOUT_HEADER_ROW_HEIGHT_FRAC,
      this.panelH
    );
    const closeCol = resolveShopModalColRect(11, 1, this.panelW);
    g.lineStyle(1, DEBUG_DETAIL_COLOR, DEBUG_LAYOUT_GRID_ALPHA * 0.55);
    g.strokeRect(
      this.panelLeft + closeCol.leftPanelPx,
      this.panelTop + headerRow.topPanelPx,
      closeCol.widthPanelPx,
      headerRow.heightPanelPx
    );

    const tabsBand = this.modalZoneRect(SHOP_LAYOUT_TABS_COL_START, SHOP_LAYOUT_TABS_COL_SPAN);
    const gridBand = this.modalZoneRect(SHOP_LAYOUT_GRID_COL_START, SHOP_LAYOUT_GRID_COL_SPAN);
    const detailBand = this.modalZoneRect(
      SHOP_LAYOUT_DETAIL_COL_START,
      SHOP_LAYOUT_DETAIL_COL_SPAN
    );

    g.lineStyle(2, DEBUG_LAYOUT_GRID_COLOR, DEBUG_LAYOUT_GRID_ALPHA);
    g.strokeRect(tabsBand.left, tabsBand.top, tabsBand.width, tabsBand.height);
    g.strokeRect(gridBand.left, gridBand.top, gridBand.width, gridBand.height);
    g.strokeRect(detailBand.left, detailBand.top, detailBand.width, detailBand.height);

    const bandLabel = (r: typeof tabsBand, text: string) =>
      labels.push(
        scene.add
          .text(r.centerX, r.top + 6, text, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#dfe963',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setAlpha(0.9)
      );
    bandLabel(tabsBand, 'cols 1–2');
    bandLabel(gridBand, 'cols 3–9');
    bandLabel(detailBand, 'cols 10–11');

    const cellW = gridBand.width / GRID_COLS;
    const cellH = gridBand.height / this.gridRows;
    g.lineStyle(1, DEBUG_LAYOUT_GRID_COLOR, DEBUG_LAYOUT_GRID_ALPHA * 0.55);
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = gridBand.left + c * cellW;
      g.strokeLineShape(new Phaser.Geom.Line(x, gridBand.top, x, gridBand.top + gridBand.height));
    }
    for (let r = 0; r <= this.gridRows; r++) {
      const y = gridBand.top + r * cellH;
      g.strokeLineShape(new Phaser.Geom.Line(gridBand.left, y, gridBand.left + gridBand.width, y));
    }

    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        labels.push(
          scene.add
            .text(
              gridBand.left + col * cellW + cellW / 2,
              gridBand.top + row * cellH + cellH / 2,
              `${col},${row}\n${idx}`,
              {
                fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
                color: '#dfe963',
                fontFamily: 'Arial',
                align: 'center',
              }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setAlpha(0.85)
        );
      }
    }

    const detail = detailBand;
    const titleYFrac = DETAIL_TITLE_Y_FRAC + DETAIL_TITLE_Y_OFFSET_FRAC;
    const iconYFrac = DETAIL_ICON_Y_FRAC + DETAIL_ICON_Y_OFFSET_FRAC;
    const statY0Frac = DETAIL_STAT_Y0_FRAC + DETAIL_STATS_Y_OFFSET_FRAC;
    const detailRegions: { label: string; y0: number; y1: number }[] = [
      { label: 'title', y0: 0, y1: titleYFrac * 2 },
      { label: 'icon', y0: iconYFrac - DETAIL_ICON_SIZE_FRAC, y1: iconYFrac + DETAIL_ICON_SIZE_FRAC },
      {
        label: 'stats',
        y0: statY0Frac - DETAIL_STAT_ROW_STEP_FRAC * 0.5,
        y1: statY0Frac + DETAIL_STAT_ROW_STEP_FRAC * 2.5,
      },
      { label: 'info', y0: DETAIL_INFO_Y_FRAC, y1: DETAIL_INFO_Y_FRAC + DETAIL_INFO_H_FRAC },
      { label: 'cta', y0: DETAIL_CTA_Y_FRAC - 0.07, y1: DETAIL_CTA_Y_FRAC + 0.08 },
    ];

    g.lineStyle(1, DEBUG_DETAIL_COLOR, DEBUG_LAYOUT_GRID_ALPHA * 0.65);
    for (const region of detailRegions) {
      const top = detail.top + detail.height * region.y0;
      const height = detail.height * (region.y1 - region.y0);
      g.strokeRect(detail.left, top, detail.width, height);
      labels.push(
        scene.add
          .text(detail.left + 4, top + 2, region.label, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#ffb74d',
            fontFamily: 'Arial',
            align: 'left',
          })
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setAlpha(0.9)
      );
    }

    CATEGORY_TAB_CENTERS_Y_FRAC.forEach((cyFrac, i) => {
      const cy = this.fracY(cyFrac);
      const cx = this.fracX(CATEGORY_TAB_CENTER_X_FRAC);
      const w = this.spanW(CATEGORY_TAB_HIT_W_FRAC);
      const h = this.spanH(CATEGORY_TAB_HIT_H_FRAC);
      g.lineStyle(1, DEBUG_LAYOUT_GRID_COLOR, DEBUG_LAYOUT_GRID_ALPHA * 0.4);
      g.strokeRect(cx - w / 2, cy - h / 2, w, h);
      const catId = SHOP_CATEGORIES[i]?.id ?? `tab${i + 1}`;
      labels.push(
        scene.add
          .text(cx, cy, catId, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#b8c94e',
            fontFamily: 'Arial',
            align: 'center',
            backgroundColor: '#00000066',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setAlpha(0.85)
      );
    });

    const container = scene.add.container(0, 0, [g, ...labels]);
    container.setScrollFactor(0);
    return container;
  }

  private artToScreen(artX: number, artY: number): { x: number; y: number } {
    return artPxToScreen(
      artX,
      artY,
      this.shopCoverCrop,
      this.panelLeft,
      this.panelTop,
      this.panelW,
      this.panelH
    );
  }

  /** Texture-space guides (1536×1024) projected through object-cover onto the panel. */
  private buildArtTextureDebugGridOverlay(): Phaser.GameObjects.Container {
    const scene = this.scene;
    const g = scene.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];
    const crop = this.shopCoverCrop;

    const addArtLabel = (artX: number, artY: number, text: string, color: string) => {
      const p = this.artToScreen(artX, artY);
      labels.push(
        scene.add
          .text(p.x + 2, p.y + 2, text, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color,
            fontFamily: 'Arial',
            align: 'left',
          })
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setAlpha(0.92)
      );
    };

    const strokeArtVLine = (artX: number, color: number, alpha: number, width = 1) => {
      const y0 = 0;
      const y1 = SHOP_ART_H;
      const a = this.artToScreen(artX, y0);
      const b = this.artToScreen(artX, y1);
      g.lineStyle(width, color, alpha);
      g.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
    };

    const strokeArtHLine = (artY: number, color: number, alpha: number, width = 1) => {
      const x0 = 0;
      const x1 = SHOP_ART_W;
      const a = this.artToScreen(x0, artY);
      const b = this.artToScreen(x1, artY);
      g.lineStyle(width, color, alpha);
      g.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
    };

    // Full texture bounds vs visible cover crop (panel = visible region).
    const fullTl = this.artToScreen(0, 0);
    const fullBr = this.artToScreen(SHOP_ART_W, SHOP_ART_H);
    const fullLeft = Math.min(fullTl.x, fullBr.x);
    const fullTop = Math.min(fullTl.y, fullBr.y);
    const fullW = Math.abs(fullBr.x - fullTl.x);
    const fullH = Math.abs(fullBr.y - fullTl.y);
    g.lineStyle(2, DEBUG_ART_FULL_TEX_OUTLINE, DEBUG_ART_GRID_ALPHA * 0.55);
    g.strokeRect(fullLeft, fullTop, fullW, fullH);
    labels.push(
      scene.add
        .text(fullLeft + 4, fullTop + 4, `texture ${SHOP_ART_W}×${SHOP_ART_H}`, {
          fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
          color: '#80deea',
          fontFamily: 'Arial',
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setAlpha(0.9)
    );

    g.lineStyle(2, DEBUG_ART_CROP_OUTLINE, DEBUG_ART_GRID_ALPHA);
    g.strokeRect(this.panelLeft, this.panelTop, this.panelW, this.panelH);
    labels.push(
      scene.add
        .text(this.panelLeft + 4, this.panelTop + this.panelH - 18, 'visible crop', {
          fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
          color: '#ea80fc',
          fontFamily: 'Arial',
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setAlpha(0.9)
    );

    for (let x = 0; x <= SHOP_ART_W; x += ART_GRID_MAJOR_STEP_PX) {
      strokeArtVLine(x, DEBUG_ART_GRID_CYAN, DEBUG_ART_GRID_ALPHA * 0.45);
    }
    for (let y = 0; y <= SHOP_ART_H; y += ART_GRID_MAJOR_STEP_PX) {
      strokeArtHLine(y, DEBUG_ART_GRID_CYAN, DEBUG_ART_GRID_ALPHA * 0.45);
    }

    const keyVX = [CONTENT_LEFT_PX, GRID_LEFT_PX, DETAIL_LEFT_PX, CONTENT_RIGHT_PX];
    for (const artX of keyVX) {
      strokeArtVLine(artX, DEBUG_ART_GRID_MAGENTA, DEBUG_ART_GRID_ALPHA, 2);
      addArtLabel(artX, GRID_TOP_FRAC * SHOP_ART_H, `x${artX}`, '#ea80fc');
    }

    const gridBottomY = (GRID_TOP_FRAC + GRID_HEIGHT_FRAC) * SHOP_ART_H;
    const keyHY = [
      GRID_TOP_FRAC * SHOP_ART_H,
      gridBottomY,
      PAGINATION_Y_FRAC * SHOP_ART_H,
    ];
    for (const artY of keyHY) {
      strokeArtHLine(artY, DEBUG_ART_GRID_MAGENTA, DEBUG_ART_GRID_ALPHA, 2);
      addArtLabel(CONTENT_LEFT_PX, artY, `y${Math.round(artY)}`, '#ea80fc');
    }

    addArtLabel(CONTENT_LEFT_PX, GRID_TOP_FRAC * SHOP_ART_H, `${CONTENT_LEFT_PX},${Math.round(GRID_TOP_FRAC * SHOP_ART_H)}`, '#80deea');
    addArtLabel(
      CONTENT_RIGHT_PX,
      gridBottomY,
      `${CONTENT_RIGHT_PX},${Math.round(gridBottomY)}`,
      '#80deea'
    );
    addArtLabel(
      GRID_LEFT_PX,
      GRID_TOP_FRAC * SHOP_ART_H,
      `${GRID_LEFT_PX},${Math.round(GRID_TOP_FRAC * SHOP_ART_H)}`,
      '#80deea'
    );
    addArtLabel(
      PAGINATION_LABEL_X_FRAC * SHOP_ART_W,
      PAGINATION_Y_FRAC * SHOP_ART_H,
      `pag y${Math.round(PAGINATION_Y_FRAC * SHOP_ART_H)}`,
      '#80deea'
    );

    this.strokeBuyQtyDebugRegions(g, labels, scene);

    const cropLabel = `crop ${Math.round(crop.cropX)},${Math.round(crop.cropY)} ${Math.round(crop.cropW)}×${Math.round(crop.cropH)}`;
    labels.push(
      scene.add
        .text(this.panelRight() - 4, this.panelTop + 4, cropLabel, {
          fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
          color: '#ea80fc',
          fontFamily: 'Arial',
          align: 'right',
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setAlpha(0.85)
    );

    const container = scene.add.container(0, 0, [g, ...labels]);
    container.setScrollFactor(0);
    return container;
  }

  private panelRight(): number {
    return this.panelLeft + this.panelW;
  }

  private layoutTier() {
    return resolveShopLayoutTier(this.viewportW, this.viewportH);
  }

  /** Panel-local column band in a modal row → screen-space rect. */
  private modalZoneRect(
    colStart: number,
    colSpan: number,
    rowTopFrac = SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
    rowHeightFrac = SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const col = resolveShopModalColRect(colStart, colSpan, this.panelW);
    const row = resolveShopModalRowRect(rowTopFrac, rowHeightFrac, this.panelH);
    const left = this.panelLeft + col.leftPanelPx;
    const top = this.panelTop + row.topPanelPx;
    const width = col.widthPanelPx;
    const height = row.heightPanelPx;
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  /** Map baked shop-modal art px to screen using panel 11-col / 15–85 row layout. */
  private mapArtRectToScreen(
    artX0: number,
    artY0: number,
    artX1: number,
    artY1: number
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const mapped = mapShopArtRectToPanelLocal(
      artX0,
      artY0,
      artX1,
      artY1,
      this.panelW,
      this.panelH
    );
    return {
      left: this.panelLeft + mapped.left,
      top: this.panelTop + mapped.top,
      width: mapped.width,
      height: mapped.height,
      centerX: this.panelLeft + mapped.centerX,
      centerY: this.panelTop + mapped.centerY,
    };
  }

  private artSpanOnPanelW(artPx: number): number {
    const contentArt = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, SHOP_LAYOUT_ART_W);
    const contentPanel = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, this.panelW);
    return artPx * (contentPanel.widthPanelPx / contentArt.widthPx);
  }

  private artSpanOnPanelH(artPx: number): number {
    const bandH = categoryTabListModalAvailableHeightPx(this.panelH);
    const bandArtH =
      resolveShopContentRowRect(SHOP_LAYOUT_ART_H).heightPanelPx || SHOP_LAYOUT_ART_H;
    return bandH * (artPx / bandArtH);
  }

  private syncDebugGrid(): void {
    this.syncCategoryTabLabels();
    if (!isShopGridDebug()) {
      this.debugGridContainer?.destroy();
      this.debugGridContainer = undefined;
      return;
    }
    this.debugGridContainer?.destroy();
    if (this.panelBg) {
      const frame = this.panelBg.frame;
      this.shopCoverCrop = computeObjectCoverCrop(
        frame.width,
        frame.height,
        this.panelW,
        this.panelH
      );
    }
    const layoutOverlay = this.buildLayoutDebugGridOverlay();
    const artOverlay = this.buildArtTextureDebugGridOverlay();
    this.debugGridContainer = this.scene.add.container(0, 0, [artOverlay, layoutOverlay]);
    this.debugGridContainer.setScrollFactor(0);
    this.debugGridContainer.setDepth(SHOP_DEBUG_GRID_DEPTH);
    this.debugGridContainer.clearMask(true);
    this.disableDebugOverlayInput(this.debugGridContainer);
    this.container.add(this.debugGridContainer);
    this.bringDebugGridToTop();
    if (this.visible) this.bringBuyControlsToTop();
  }

  /** Debug overlays are visual-only — must not participate in Phaser hit tests. */
  private disableDebugOverlayInput(root: Phaser.GameObjects.GameObject): void {
    if ('disableInteractive' in root && typeof root.disableInteractive === 'function') {
      (root as Phaser.GameObjects.GameObject & { disableInteractive: () => void }).disableInteractive();
    }
    if (root instanceof Phaser.GameObjects.Container) {
      for (const child of root.list) {
        this.disableDebugOverlayInput(child);
      }
    }
  }

  /**
   * Raise debug grid above panel art (`ui_shop_modal`, `ui_box`, `ui_plus_devide`, card bgs).
   * Interactive hits are re-stacked above the grid via `bringBuyControlsToTop()`.
   * Grid scroll capture (`scrollHit`) stays below `scrollViewport` so cell hits receive clicks.
   */
  private bringDebugGridToTop(): void {
    if (!this.debugGridContainer) return;
    this.debugGridContainer.clearMask(true);
    this.container.bringToTop(this.debugGridContainer);
  }

  /** Art fraction (0–1 of 1536×1024) → screen X through object-cover crop. */
  private fracX(f: number): number {
    return this.artToScreen(f * SHOP_ART_W, 0).x;
  }

  /** Art fraction (0–1 of 1536×1024) → screen Y through object-cover crop. */
  private fracY(f: number): number {
    return this.artToScreen(0, f * SHOP_ART_H).y;
  }

  /** Screen width for an art-width fraction (cover-aware; replaces panelW × frac). */
  private spanW(fracW: number): number {
    return Math.abs(this.fracX(fracW) - this.fracX(0));
  }

  /** Screen height for an art-height fraction (cover-aware; replaces panelH × frac). */
  private spanH(fracH: number): number {
    return Math.abs(this.fracY(fracH) - this.fracY(0));
  }

  /** Screen span for a vertical distance in shop art pixels (object-cover aware). */
  private artSpanH(artPx: number): number {
    return this.spanH(artPx / SHOP_ART_H);
  }

  private buyQtyFontSizePx(fieldHeightPx: number): number {
    return Math.max(
      this.scaleFont(DETAIL_BUY_QTY_FONT_MIN_PX),
      Math.round(fieldHeightPx * DETAIL_BUY_QTY_FONT_HEIGHT_FRAC)
    );
  }

  private detailBandRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const col = resolveShopDetailContentColRect(this.panelW);
    const row = resolveShopModalRowRect(
      SHOP_LAYOUT_CONTENT_ROW_TOP_FRAC,
      SHOP_LAYOUT_CONTENT_ROW_HEIGHT_FRAC,
      this.panelH
    );
    const left = this.panelLeft + col.leftPanelPx;
    const top = this.panelTop + row.topPanelPx;
    const width = col.widthPanelPx;
    const height = row.heightPanelPx;
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  private detailPriceBoxRect(): {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  } {
    const detail = this.detailBandRect();
    const priceBoxBand = this.mapArtRectToScreen(
      DETAIL_COIN_BOX_X0_PX,
      DETAIL_PRICE_AMOUNT_Y0_PX,
      DETAIL_COIN_BOX_X1_PX,
      DETAIL_PRICE_AMOUNT_Y1_PX
    );
    return {
      centerX: detail.centerX,
      centerY:
        priceBoxBand.centerY +
        this.artSpanOnPanelH(DETAIL_PRICE_BOX_OFFSET_Y_ART_PX) +
        detail.height * DETAIL_PRICE_Y_OFFSET_FRAC,
      width: detail.width,
      height:
        (priceBoxBand.height + this.artSpanOnPanelH(DETAIL_PRICE_BOX_EXTRA_H_PX)) *
        DETAIL_PRICE_BOX_HEIGHT_SCALE,
    };
  }

  private texOrFallback(key: string, fallback: string): string {
    return this.scene.textures.exists(key) ? key : fallback;
  }

  /** Display size for `ui/text-background.png` — preserve texture aspect (not row-step squash). */
  private detailStatBgDisplaySize(detailBandWidth: number): { width: number; height: number } {
    const width = detailBandWidth * DETAIL_STAT_BG_WIDTH_FRAC;
    const tex = this.scene.textures.get(UI_TEXT_BACKGROUND_TEXTURE_KEY);
    const frame = tex?.get();
    const srcW = frame?.width > 0 ? frame.width : 194;
    const srcH = frame?.height > 0 ? frame.height : 21;
    return { width, height: width * (srcH / srcW) };
  }

  /** Ensure stat rows use the text-background texture (not shop-modal fallback from ctor). */
  private syncDetailStatBgTextures(): void {
    if (!this.scene.textures.exists(UI_TEXT_BACKGROUND_TEXTURE_KEY)) return;
    for (const bg of this.detailStatBgs) {
      if (bg.texture.key !== UI_TEXT_BACKGROUND_TEXTURE_KEY) {
        bg.setTexture(UI_TEXT_BACKGROUND_TEXTURE_KEY);
      }
    }
  }

  private bringDetailStatTextAboveBackgrounds(): void {
    for (const line of this.detailStatLines) {
      this.container.bringToTop(line);
    }
  }

  private buildCategoryTabs(scene: Phaser.Scene): void {
    SHOP_CATEGORIES.forEach((cat, i) => {
      const cy = this.fracY(CATEGORY_TAB_CENTERS_Y_FRAC[i] ?? CATEGORY_TAB_CENTERS_Y_FRAC[0]);
      const cx = this.fracX(CATEGORY_TAB_CENTER_X_FRAC);
      const w = this.spanW(CATEGORY_TAB_HIT_W_FRAC);
      const h = this.spanH(CATEGORY_TAB_HIT_H_FRAC);
      const tabTextureKey = this.texOrFallback(
        SHOP_CATEGORY_TAB_TEXTURES[cat.id].inactive,
        SHOP_BG_KEY
      );

      const bg = scene.add
        .image(cx, cy, tabTextureKey)
        .setScrollFactor(0)
        .setDisplaySize(w, h)
        .setOrigin(0.5, 0.5);

      const glow = scene.add
        .rectangle(cx, cy, w, h, 0xffd700, 0.35)
        .setScrollFactor(0)
        .setVisible(false);

      const label = scene.add
        .text(cx, cy, cat.id, {
          fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
          color: '#b8c94e',
          fontFamily: 'Arial',
          align: 'center',
          backgroundColor: '#00000088',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setVisible(isShopGridDebug());

      const hit = scene.add
        .rectangle(cx, cy, w, h, 0x000000, 0.001)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: !cat.locked });

      hit.on('pointerdown', () => this.selectCategory(cat.id));

      this.categoryTabs.push({ id: cat.id, locked: cat.locked, bg, hit, glow, label });
    });
    this.layoutCategoryTabs();
  }

  /** Toggle category id labels when shop debug grid is on/off. */
  private syncCategoryTabLabels(): void {
    const show = isShopGridDebug();
    for (const tab of this.categoryTabs) {
      tab.label?.setVisible(show);
    }
  }

  private layoutCategoryTabs(): void {
    const tier = this.layoutTier();
    const tabsZone = this.modalZoneRect(SHOP_LAYOUT_TABS_COL_START, SHOP_LAYOUT_TABS_COL_SPAN);
    const padX = this.artSpanOnPanelW(CATEGORY_TAB_ZONE_PAD_X_PX);
    const gapY = this.artSpanOnPanelH(CATEGORY_TAB_ZONE_GAP_Y_PX);
    this.tabListLeft = tabsZone.left;
    this.tabListTop = tabsZone.top;
    this.tabListViewportW = tabsZone.width;
    this.tabListModalAvailableH = tabsZone.height;
    const { contentH, viewportH } = categoryTabListHeightsFromModalAvailable(
      tabsZone.height,
      tier.categoryTabListMinHeightPx
    );
    this.tabListContentH = contentH;
    this.tabListViewportH = viewportH;
    const { tabW, tabH, scaledStep } = computeCategoryTabDimensionsFromZone(
      tabsZone.width,
      contentH,
      SHOP_CATEGORY_TAB_COUNT,
      padX,
      gapY
    );
    this.tabItemScale = 1;
    const cx = tabsZone.left + tabsZone.width / 2;

    this.categoryTabs.forEach((tab, i) => {
      const cy = tabsZone.top + tabH / 2 + i * scaledStep;
      tab.bg.setPosition(cx, cy).setDisplaySize(tabW, tabH);
      tab.glow.setPosition(cx, cy).setSize(tabW, tabH);
      tab.hit.setPosition(cx, cy).setSize(Math.max(tabW, 8), Math.max(tabH, 8));
      tab.label?.setPosition(cx, cy);
    });
    this.syncCategoryTabTextures();
  }

  private buildProductGrid(scene: Phaser.Scene): void {
    this.cardTex = this.texOrFallback(CARD_TEXTURE_KEY, SHOP_BG_KEY);

    this.scrollViewport = scene.add.container(0, 0);
    this.scrollViewport.setScrollFactor(0);

    this.scrollContent = scene.add.container(0, 0);
    this.itemsBgContainer = scene.add.container(0, 0);
    this.listContainer = scene.add.container(0, 0);
    this.scrollContent.add([this.itemsBgContainer, this.listContainer]);
    this.scrollViewport.add(this.scrollContent);

    this.scrollMaskGraphics = scene.add.graphics({ x: 0, y: 0 });
    this.scrollMaskGraphics.setScrollFactor(0);
    this.scrollMaskGraphics.setAlpha(0.001);
    this.scrollGeometryMask = this.scrollMaskGraphics.createGeometryMask();
    this.scrollViewport.setMask(this.scrollGeometryMask);

    this.scrollHit = scene.add
      .rectangle(0, 0, 8, 8, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    this.scrollHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.scrollDragPointerId = pointer.id;
      this.scrollDragStartY = pointer.y;
      this.scrollDragStartOffset = this.scrollOffset;
      this.scrollDragActive = false;
    });
    this.scrollHit.on('pointerup', this.boundClearScrollDrag);
    this.scrollHit.on('pointerupoutside', this.boundClearScrollDrag);
    this.scrollHit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.scrollDragPointerId !== pointer.id) return;
      if (!this.scrollDragActive) {
        if (Math.abs(pointer.y - this.scrollDragStartY) < SCROLL_DRAG_THRESHOLD_PX) return;
        this.scrollDragActive = true;
      }
      this.setScrollOffset(this.scrollDragStartOffset - (pointer.y - this.scrollDragStartY));
    });

    scene.input.on('pointerup', this.boundClearScrollDrag);
    scene.input.on('pointerupoutside', this.boundClearScrollDrag);
    scene.input.on('wheel', this.boundWheel);
  }

  /** Screen Y for slot row center (bg + icons + hits share this). */
  private gridSlotCenterY(row: number): number {
    return this.gridContentPadTop + row * this.pitchCellH + this.cellH / 2;
  }

  /** Coin + price row band on grid card (80% width, centered, 24% from bottom). */
  private gridCardFooterRect(
    centerX: number,
    centerY: number
  ): { centerX: number; centerY: number; width: number; height: number } {
    return {
      centerX,
      centerY:
        centerY + this.cardDisplayH / 2 - this.cardDisplayH * GRID_CARD_FOOTER_BOTTOM_FRAC,
      width: this.cardDisplayW * GRID_CARD_FOOTER_W_FRAC,
      height: this.cardDisplayH * GRID_CARD_FOOTER_H_FRAC,
    };
  }

  /** Selected-item check at 15% from top and 17% from right of card. */
  private gridCardTopCheckLayout(
    centerX: number,
    centerY: number
  ): { centerX: number; centerY: number; size: number } {
    const footer = this.gridCardFooterRect(centerX, centerY);
    const size = Math.min(footer.width, footer.height) * GRID_CARD_CHECK_SIZE_FRAC;
    return {
      centerX:
        centerX + this.cardDisplayW / 2 - this.cardDisplayW * GRID_CARD_CHECK_RIGHT_FRAC,
      centerY: centerY - this.cardDisplayH / 2 + this.cardDisplayH * GRID_CARD_CHECK_TOP_FRAC,
      size,
    };
  }

  private addGridCardPriceRow(centerX: number, centerY: number, unitPrice: number): void {
    const footer = this.gridCardFooterRect(centerX, centerY);
    const coinTex = this.texOrFallback(COIN_TEXTURE_KEY, 'seed');
    const coinSize =
      Math.min(footer.height * 0.75, footer.width * 0.38) * GRID_CARD_FOOTER_COIN_SCALE;
    const priceFontPx = Math.round(
      GRID_CARD_PRICE_FONT_SIZE_PX * GRID_CARD_FOOTER_PRICE_FONT_SCALE
    );
    const amount = this.scene.add
      .text(0, 0, String(unitPrice), {
        ...warehouseTitleLikeTextStyle('dark', {
          fontSize: `${priceFontPx}px`,
        }),
        align: 'left',
      })
      .setOrigin(0, 0.5);
    applyWarehouseTitleLikeSizing(
      amount,
      'dark',
      Math.max(8, this.scaleFont(priceFontPx))
    );
    const gap = footer.width * GRID_CARD_PRICE_COIN_AMOUNT_GAP_FRAC;
    const groupW = coinSize + gap + amount.width;
    const groupLeft = footer.centerX - groupW / 2;
    const coin = this.scene.add
      .image(groupLeft + coinSize * 0.5, footer.centerY, coinTex)
      .setDisplaySize(coinSize, coinSize)
      .setOrigin(0.5, 0.5);
    amount.setPosition(groupLeft + coinSize + gap, footer.centerY);
    coin.disableInteractive();
    amount.disableInteractive();
    this.listContainer.add([coin, amount]);
  }

  private rebuildItemsBackground(totalRows: number): void {
    this.itemsBgContainer.removeAll(true);
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const centerX = col * this.cellW + this.cellW / 2;
        const centerY = this.gridSlotCenterY(row);
        const card = this.scene.add
          .image(centerX, centerY, this.cardTex)
          .setDisplaySize(this.cardDisplayW, this.cardDisplayH);
        this.itemsBgContainer.add(card);
      }
    }
  }

  private getScrollContentHeight(slotCount: number): number {
    const rows = Math.max(this.gridRows, Math.ceil(slotCount / GRID_COLS) || this.gridRows);
    return this.gridContentPadTop + rows * this.pitchCellH;
  }

  private getMaxScrollOffset(): number {
    return Math.max(0, this.getScrollContentHeight(this.lastRenderedSlotCount) - this.gridViewportH);
  }

  /** Scroll API: positive deltaY scrolls content down (reveals lower rows). */
  scrollBy(deltaY: number): void {
    this.setScrollOffset(this.scrollOffset + deltaY * 0.35);
  }

  setScrollOffset(offset: number): void {
    this.scrollOffset = Phaser.Math.Clamp(offset, 0, this.getMaxScrollOffset());
    this.scrollContent.setY(-this.scrollOffset);
    this.syncPageFromScroll();
  }

  getScrollOffset(): number {
    return this.scrollOffset;
  }

  private syncPageFromScroll(): void {
    const pageHeight = this.gridRows * this.pitchCellH;
    const maxPage = this.pageCount() - 1;
    if (pageHeight <= 0 || maxPage <= 0) {
      this.currentPage = 0;
      return;
    }
    const maxScroll = this.getMaxScrollOffset();
    if (maxScroll > 0 && this.scrollOffset >= maxScroll - 0.5) {
      this.currentPage = maxPage;
      return;
    }
    this.currentPage = Phaser.Math.Clamp(Math.floor(this.scrollOffset / pageHeight), 0, maxPage);
  }

  private syncScrollFromPage(): void {
    const pageHeight = this.gridRows * this.pitchCellH;
    const maxPage = this.pageCount() - 1;
    const target =
      this.currentPage >= maxPage
        ? this.getMaxScrollOffset()
        : this.currentPage * pageHeight;
    this.setScrollOffset(target);
  }

  private isPointerInGrid(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.gridLeft &&
      pointer.x <= this.gridLeft + this.gridViewportW &&
      pointer.y >= this.gridTop &&
      pointer.y <= this.gridTop + this.gridViewportH
    );
  }

  private firstVisibleRow(): number {
    if (this.pitchCellH <= 0) return 0;
    return Math.max(0, Math.floor((this.scrollOffset - this.gridContentPadTop) / this.pitchCellH));
  }

  private buildDetailPanel(_scene: Phaser.Scene): void {
    this.detailTitle = this.scene.add
      .text(0, 0, '', {
        ...warehouseTitleLikeTextStyle('dark', { fontSize: '16px' }),
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.detailIcon = this.scene.add
      .image(0, 0, 'seed')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.detailStatBgs = [0, 1, 2].map(() =>
      this.scene.add
        .image(0, 0, UI_TEXT_BACKGROUND_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setAlpha(1)
        .setVisible(false)
    );

    this.detailStatLines = [0, 1, 2].map(() =>
      this.scene.add
        .text(0, 0, '', {
          ...warehouseTitleLikeTextStyle('dark', { fontSize: '12px' }),
          align: 'center',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
    );

    const boxTex = this.texOrFallback(UI_BOX_TEXTURE_KEY, SHOP_BG_KEY);
    this.detailPriceBox = this.scene.add
      .image(0, 0, boxTex)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    const coinTex = this.texOrFallback(COIN_TEXTURE_KEY, 'seed');
    this.detailPriceCoin = this.scene.add
      .image(0, 0, coinTex)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.detailPriceAmount = this.scene.add
      .text(0, 0, '', {
        ...warehouseTitleLikeTextStyle('dark', {
          fontSize: `${DETAIL_PRICE_AMOUNT_FONT_SIZE_PX}px`,
        }),
        align: 'left',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    const qtyRowTex = this.texOrFallback(UI_PLUS_DEVIDE_TEXTURE_KEY, SHOP_BG_KEY);
    this.detailBuyQtyBg = this.scene.add
      .image(0, 0, qtyRowTex)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false);

    const qtyField = this.buyQtyFieldHitRectFromArt(
      DETAIL_BUY_QTY_FIELD_X0_PX,
      DETAIL_BUY_QTY_FIELD_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    this.detailBuyQtyText = this.scene.add
      .text(qtyField.centerX, qtyField.centerY, '1', {
        ...warehouseTitleLikeTextStyle('light', {
          fontSize: `${this.buyQtyFontSizePx(qtyField.height)}px`,
        }),
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.buyMinusHit = this.createBuyQtyHitZone('minus', () => this.adjustBuyQuantity(-1));
    this.buyQtyFieldHit = this.createBuyQtyHitZone('field', () => this.openBuyQtyInput());
    this.buyPlusHit = this.createBuyQtyHitZone('plus', () => this.adjustBuyQuantity(1));
    this.buyMainHit = this.createBuyMainHit();
    this.layoutBuyQtyHitZones();
    this.layoutBuyMainHit();
  }

  private buildPagination(_scene: Phaser.Scene): void {
    const py = this.fracY(PAGINATION_Y_FRAC);
    const prevX = this.fracX(PAGINATION_PREV_X_FRAC);
    const labelX = this.fracX(PAGINATION_LABEL_X_FRAC);
    const tabW = this.spanW(0.042);
    const tabH = this.spanH(0.048);

    this.prevPageHit = this.scene.add
      .rectangle(prevX, py, tabW * 1.2, tabH, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.prevPageHit.on('pointerdown', () => this.setPage(this.currentPage - 1));

    const nextX = this.fracX(PAGINATION_NEXT_X_FRAC);
    this.nextPageHit = this.scene.add
      .rectangle(nextX, py, tabW * 1.2, tabH, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.nextPageHit.on('pointerdown', () => this.setPage(this.currentPage + 1));

    this.pageLabel = this.scene.add
      .text(labelX, py, '1/1', {
        ...warehouseTitleLikeTextStyle('light', { fontSize: '13px' }),
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    for (let i = 0; i < 3; i++) {
      const tx = this.fracX(PAGINATION_TAB_X0_FRAC + i * PAGINATION_TAB_STEP_FRAC);
      const highlight = this.scene.add
        .rectangle(tx, py, tabW, tabH, 0xff9800, 0.45)
        .setScrollFactor(0)
        .setVisible(false);
      const hit = this.scene.add
        .rectangle(tx, py, tabW, tabH, 0x000000, 0.001)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      const pageIndex = i;
      hit.on('pointerdown', () => this.setPage(pageIndex));
      this.pageTabHighlights.push(highlight);
      this.pageTabHits.push(hit);
    }
  }

  private selectCategory(id: ShopCategoryId): void {
    const tab = SHOP_CATEGORIES.find((c) => c.id === id);
    if (!tab) return;
    if (tab.locked) {
      this.showToast(SHOP_LOCKED_HINT);
      return;
    }
    this.activeCategory = id;
    this.currentPage = 0;
    this.scrollOffset = 0;
    this.filteredIds = catalogIdsForCategory(id);
    if (this.filteredIds.length === 0) {
      this.selectedId = null;
    } else if (!this.selectedId || !this.filteredIds.includes(this.selectedId)) {
      this.selectedId = this.filteredIds[0];
    }
    this.syncCategoryTabTextures();
    this.refreshAll();
  }

  /** Swap inactive/active store tab art for the selected category. */
  private syncCategoryTabTextures(): void {
    for (const tab of this.categoryTabs) {
      tab.glow.setVisible(false);
      const pair = SHOP_CATEGORY_TAB_TEXTURES[tab.id];
      const active = tab.id === this.activeCategory;
      const key = this.texOrFallback(active ? pair.active : pair.inactive, SHOP_BG_KEY);
      tab.bg.setTexture(key);
    }
  }

  private itemIdAtSlot(slotIndex: number): string | null {
    const col = slotIndex % GRID_COLS;
    const viewportRow = Math.floor(slotIndex / GRID_COLS);
    const globalIndex = (this.firstVisibleRow() + viewportRow) * GRID_COLS + col;
    return this.effectiveFilteredIds()[globalIndex] ?? null;
  }

  private selectItem(itemId: string): void {
    this.selectedId = itemId;
    this.buyQuantity = 1;
    this.refreshAll();
  }

  private effectiveFilteredIds(): string[] {
    if (this.testGridPadding <= 0) return this.filteredIds;
    const filler = this.filteredIds[0] ?? ITEM_IDS.SEEDS_WHEAT;
    return [...this.filteredIds, ...Array(this.testGridPadding).fill(filler)];
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.effectiveFilteredIds().length / this.gridPageSize));
  }

  private setPage(page: number): void {
    const max = this.pageCount() - 1;
    this.currentPage = Phaser.Math.Clamp(page, 0, max);
    this.syncScrollFromPage();
    this.refreshGrid();
    this.refreshPagination();
  }

  private refreshGrid(): void {
    this.listContainer.removeAll(true);
    this.gridCellHits = [];

    const ids = this.effectiveFilteredIds();
    this.lastRenderedSlotCount = ids.length;
    const totalRows = Math.max(this.gridRows, Math.ceil(ids.length / GRID_COLS) || this.gridRows);
    this.rebuildItemsBackground(totalRows);
    this.setScrollOffset(this.scrollOffset);

    const economy = this.economy;
    if (!economy) return;

    const iconHit = Math.min(this.cellW * GRID_HIT_W_FRAC, this.cellH * GRID_HIT_H_FRAC);
    const iconW = iconHit * GRID_ICON_SIZE_W_FRAC;
    const iconH = iconHit * GRID_ICON_SIZE_H_FRAC;

    ids.forEach((itemId, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const centerX = col * this.cellW + this.cellW / 2;
      const centerY = this.gridSlotCenterY(row);

      const iconKey = ITEM_ICON_KEYS[itemId] ?? 'seed';
      const tex = this.texOrFallback(iconKey, 'seed');
      const icon = this.scene.add
        .image(centerX, centerY - this.cellH * 0.12, tex)
        .setDisplaySize(iconW, iconH);

      const unit = economy.getShopPrice(itemId);
      this.addGridCardPriceRow(centerX, centerY, unit);

      if (itemId === this.selectedId) {
        const checkLayout = this.gridCardTopCheckLayout(centerX, centerY);
        const checkTex = this.texOrFallback(UI_CHECK_TEXTURE_KEY, SHOP_BG_KEY);
        const check = this.scene.add
          .image(checkLayout.centerX, checkLayout.centerY, checkTex)
          .setDisplaySize(checkLayout.size, checkLayout.size)
          .setOrigin(0.5, 0.5);
        check.disableInteractive();
        this.listContainer.add(check);
      }

      icon.disableInteractive();

      const hit = this.scene.add
        .rectangle(
          centerX,
          centerY,
          this.cellW * GRID_HIT_W_FRAC,
          this.cellH * GRID_HIT_H_FRAC,
          0x000000,
          0.001
        )
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.selectItem(itemId));

      this.listContainer.add([icon, hit]);
      this.gridCellHits.push(hit);
    });

    for (const hit of this.gridCellHits) {
      this.listContainer.bringToTop(hit);
    }
  }

  private refreshDetail(): void {
    if (!this.selectedId || !this.economy || !this.inventory) {
      this.detailTitle.setText('');
      this.detailIcon.setVisible(false);
      this.detailStatBgs.forEach((bg) => bg.setVisible(false));
      this.detailStatLines.forEach((t) => t.setText(''));
      this.detailPriceBox.setVisible(false);
      this.detailPriceCoin.setVisible(false);
      this.detailPriceAmount.setText('');
      this.detailBuyQtyText?.setText('');
      this.detailBuyQtyText?.setVisible(false);
      this.detailBuyQtyBg?.setVisible(false);
      return;
    }

    const itemId = this.selectedId;
    const unit = this.economy.getShopPrice(itemId);
    const iconKey = ITEM_ICON_KEYS[itemId] ?? 'seed';
    const tex = this.texOrFallback(iconKey, 'seed');

    this.detailTitle.setText(ITEM_LABELS[itemId] ?? itemId);
    this.detailIcon.setTexture(tex);
    this.detailIcon.setVisible(true);

    const energy = FOOD_ENERGY_RECOVERY[itemId];
    this.syncDetailStatBgTextures();
    this.detailStatBgs.forEach((bg) => bg.setVisible(true).setAlpha(1));
    this.detailStatLines[0].setText(`Giá: ${unit} xu`);
    this.detailStatLines[1].setText(
      energy !== undefined ? `Hồi năng lượng: +${energy}` : 'Hạt giống / nguyên liệu'
    );
    this.detailStatLines[2].setText(
      this.economy.canAfford(unit) ? 'Đủ xu để mua' : `Thiếu ${unit - this.economy.getCoins()} xu`
    );

    this.detailPriceCoin.setVisible(true);
    this.detailPriceAmount.setText(String(unit));
    this.layoutDetailPanel();
    this.bringDetailStatTextAboveBackgrounds();
    this.refreshBuyQuantity();
  }

  /** Max purchasable qty from coins + warehouse space (min 1 when any purchase is possible). */
  private getMaxBuyQuantity(itemId: string): number {
    if (!this.economy) return 1;
    const unit = this.economy.getShopPrice(itemId);
    if (unit <= 0) return 1;
    const maxByCoins = Math.floor(this.economy.getCoins() / unit);
    const wh = this.inventory?.warehouse;
    const space = wh ? wh.getCapacity() - wh.getUsedCapacity() : maxByCoins;
    const cap = Math.min(maxByCoins, space);
    return Math.max(1, cap);
  }

  private setBuyQuantity(qty: number): void {
    if (!this.selectedId) return;
    const max = this.getMaxBuyQuantity(this.selectedId);
    this.buyQuantity = Phaser.Math.Clamp(Math.floor(qty), 1, max);
    this.updateBuyQtyDisplay();
  }

  private adjustBuyQuantity(delta: number): void {
    this.setBuyQuantity(this.buyQuantity + delta);
  }

  private gameRectToClient(
    left: number,
    top: number,
    width: number,
    height: number
  ): { left: number; top: number; width: number; height: number } {
    const scale = this.scene.scale;
    const bounds = scale.canvasBounds;
    const toPageX = (gameX: number) => bounds.left + gameX / scale.displayScale.x;
    const toPageY = (gameY: number) => bounds.top + gameY / scale.displayScale.y;
    const pageLeft = toPageX(left);
    const pageTop = toPageY(top);
    const pageRight = toPageX(left + width);
    const pageBottom = toPageY(top + height);
    return {
      left: pageLeft,
      top: pageTop,
      width: pageRight - pageLeft,
      height: pageBottom - pageTop,
    };
  }

  /** Dev/e2e: verify Phaser hit-test picks up buy CTA / qty zones at baked centers. */
  getBuyHitTestAt(target: 'minus' | 'field' | 'plus' | 'buy'): {
    hitsBuyControl: boolean;
    topIsBuyControl: boolean;
    hitCount: number;
    topHitName: string;
  } {
    const snap = this.getBuyControlsSnapshot()[target];
    const pointer = this.scene.input.activePointer;
    pointer.x = snap.centerX;
    pointer.y = snap.centerY;
    pointer.position.set(snap.centerX, snap.centerY);
    pointer.worldX = snap.centerX;
    pointer.worldY = snap.centerY;
    const hits = this.scene.input.hitTestPointer(pointer);
    const buyHits = new Set<Phaser.GameObjects.GameObject>([
      this.buyMainHit,
      this.buyMinusHit,
      this.buyQtyFieldHit,
      this.buyPlusHit,
    ]);
    const top = hits[0];
    const topHitName =
      top === this.buyMinusHit
        ? 'buyMinusHit'
        : top === this.buyQtyFieldHit
          ? 'buyQtyFieldHit'
          : top === this.buyPlusHit
            ? 'buyPlusHit'
            : top === this.buyMainHit
              ? 'buyMainHit'
              : top === this.panelBg
                ? 'panelBg'
                : top === this.scrollHit
                  ? 'scrollHit'
                  : top?.constructor?.name ?? 'none';
    return {
      hitsBuyControl: hits.some((h) => buyHits.has(h)),
      topIsBuyControl: hits.length > 0 && buyHits.has(hits[0]!),
      hitCount: hits.length,
      topHitName,
    };
  }

  /** @deprecated Use getBuyHitTestAt */
  getBuyQtyHitTestAt(target: 'minus' | 'field' | 'plus'): ReturnType<ShopPanel['getBuyHitTestAt']> {
    return this.getBuyHitTestAt(target);
  }

  /** Dev/e2e: dispatch native pointer events on the game canvas (DOM → Phaser path). */
  dispatchCanvasPointerTap(target: 'minus' | 'field' | 'plus' | 'buy'): void {
    const snap = this.getBuyControlsSnapshot()[target];
    const canvas = this.scene.game.canvas;
    const pointerInit = {
      clientX: snap.clientCenterX,
      clientY: snap.clientCenterY,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse' as const,
      isPrimary: true,
      button: 0,
      buttons: 1,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit, buttons: 0 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { ...pointerInit, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { ...pointerInit, button: 0 }));
  }

  /** Dev/e2e: canvas-relative click at grid viewport slot center (0–11). */
  getGridSlotCanvasClickPosition(slotIndex: number): { x: number; y: number } | null {
    const itemId = this.itemIdAtSlot(slotIndex);
    if (!itemId) return null;
    const col = slotIndex % GRID_COLS;
    const viewportRow = Math.floor(slotIndex / GRID_COLS);
    const centerX =
      this.gridLeft + this.gridContentPadLeft + col * this.cellW + this.cellW / 2;
    const centerY =
      this.gridTop +
      this.scrollContent.y +
      this.gridContentPadTop +
      this.gridSlotCenterY(viewportRow);
    const client = this.gameRectToClient(centerX, centerY, 0, 0);
    const canvas = this.scene.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: client.left - bounds.left,
      y: client.top - bounds.top,
    };
  }

  /** Dev/e2e: canvas-relative click position for Playwright `canvas.click({ position })`. */
  getBuyCanvasClickPosition(
    target: 'minus' | 'field' | 'plus' | 'buy'
  ): { x: number; y: number } {
    const snap = this.getBuyControlsSnapshot()[target];
    const canvas = this.scene.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: snap.clientCenterX - bounds.left,
      y: snap.clientCenterY - bounds.top,
    };
  }


  private ensureBuyQtyInput(): HTMLInputElement {
    if (this.buyQtyInputEl) return this.buyQtyInputEl;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Buy quantity');
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
      color: '#fff8e1',
      WebkitTextStroke: `2px ${warehouseStrokeForColor('#fff8e1')}`,
      display: 'none',
      boxSizing: 'border-box',
      borderRadius: '4px',
    });
    input.addEventListener('blur', () => this.commitBuyQtyInput());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    document.body.appendChild(input);
    this.buyQtyInputEl = input;
    return input;
  }

  /** Tap qty pill: focus hidden number input (native keyboard). */
  private openBuyQtyInput(): void {
    if (!this.visible || !this.selectedId) return;
    const field = this.buyQtyFieldHitRectFromArt(
      DETAIL_BUY_QTY_FIELD_X0_PX,
      DETAIL_BUY_QTY_FIELD_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const client = this.gameRectToClient(field.left, field.top, field.width, field.height);
    const input = this.ensureBuyQtyInput();
    const max = this.getMaxBuyQuantity(this.selectedId);
    input.min = '1';
    input.max = String(max);
    input.value = String(this.buyQuantity);
    input.style.left = `${client.left}px`;
    input.style.top = `${client.top}px`;
    input.style.width = `${client.width}px`;
    input.style.height = `${client.height}px`;
    input.style.fontSize = `${this.buyQtyFontSizePx(client.height)}px`;
    input.style.display = 'block';
    input.focus({ preventScroll: true });
    input.select();
  }

  private commitBuyQtyInput(): void {
    if (!this.buyQtyInputEl || this.buyQtyInputEl.style.display === 'none') return;
    const raw = this.buyQtyInputEl.value.trim();
    this.hideBuyQtyInput();
    if (raw === '') return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) this.setBuyQuantity(parsed);
  }

  private hideBuyQtyInput(): void {
    if (!this.buyQtyInputEl) return;
    this.buyQtyInputEl.style.display = 'none';
    if (document.activeElement === this.buyQtyInputEl) {
      this.buyQtyInputEl.blur();
    }
  }

  private bringBuyControlsToTop(): void {
    for (const hit of [
      ...this.categoryTabs.map((t) => t.hit),
      this.prevPageHit,
      this.nextPageHit,
      ...this.pageTabHits,
      this.buyMainHit,
      this.buyMinusHit,
      this.buyQtyFieldHit,
      this.buyPlusHit,
      this.toastText,
      this.closeHit,
    ]) {
      if (hit) {
        hit.setDepth(SHOP_HIT_DEPTH);
        this.container.bringToTop(hit);
      }
    }
    // Keep scroll drag capture below scrollViewport so grid cell hits receive taps.
    const viewportIdx = this.container.getIndex(this.scrollViewport);
    const hitIdx = this.container.getIndex(this.scrollHit);
    if (viewportIdx >= 0 && hitIdx >= 0 && hitIdx >= viewportIdx) {
      this.container.moveTo(this.scrollHit, viewportIdx);
    }
    this.scene.children.bringToTop(this.container);
  }

  /** Qty row layout anchor only — `ui_plus_devide` bg is hidden; hits/text use art rects. */
  private layoutDetailBuyQtyRow(): void {
    // Background sprite intentionally not shown.
  }

  /** − / pill / + row: full {@link detailBandRect} width; vertical position from baked art. */
  private buyQtyLayoutRowRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const detail = this.detailBandRect();
    const artRow = this.mapArtRectToScreen(
      DETAIL_BUY_QTY_MINUS_X0_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_PLUS_X1_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const offsetY = detail.height * DETAIL_QTY_Y_OFFSET_FRAC;
    const height = artRow.height * DETAIL_BUY_QTY_ROW_HEIGHT_SCALE;
    const centerY = artRow.centerY + offsetY;
    return {
      left: detail.left,
      top: centerY - height / 2,
      width: detail.width,
      height,
      centerX: detail.centerX,
      centerY,
    };
  }

  /** Display size for `ui_plus_devide` (full detail band width; extra height from art). */
  private buyQtyDisplayRowRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.buyQtyLayoutRowRect();
    const height = base.height + this.artSpanOnPanelH(DETAIL_BUY_QTY_BG_EXTRA_H_PX);
    return {
      left: base.left,
      top: base.centerY - height / 2,
      width: base.width,
      height,
      centerX: base.centerX,
      centerY: base.centerY,
    };
  }

  /** Map baked qty sub-regions onto the layout row (hit zones / qty text; not bg display scale). */
  private buyQtySubRectFromArt(
    x0Px: number,
    x1Px: number,
    y0Px: number,
    y1Px: number
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const rowLeft = DETAIL_BUY_QTY_MINUS_X0_PX;
    const rowRight = DETAIL_BUY_QTY_PLUS_X1_PX;
    const rowTop = DETAIL_BUY_QTY_ROW_Y0_PX;
    const rowBottom = DETAIL_BUY_QTY_ROW_Y1_PX;
    const display = this.buyQtyLayoutRowRect();
    const rowSpanX = rowRight - rowLeft;
    const rowSpanY = rowBottom - rowTop;
    const relX0 = rowSpanX > 0 ? (x0Px - rowLeft) / rowSpanX : 0;
    const relX1 = rowSpanX > 0 ? (x1Px - rowLeft) / rowSpanX : 1;
    const relY0 = rowSpanY > 0 ? (y0Px - rowTop) / rowSpanY : 0;
    const relY1 = rowSpanY > 0 ? (y1Px - rowTop) / rowSpanY : 1;
    const left = display.left + relX0 * display.width;
    const top = display.top + relY0 * display.height;
    const width = (relX1 - relX0) * display.width;
    const height = (relY1 - relY0) * display.height;
    return {
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  /** − / + hit zones: baked sub-rect on display row, expanded symmetrically (not pill field). */
  private buyQtyBtnHitRectFromArt(
    x0Px: number,
    x1Px: number,
    y0Px: number,
    y1Px: number
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.buyQtySubRectFromArt(x0Px, x1Px, y0Px, y1Px);
    const width = base.width + this.artSpanOnPanelW(DETAIL_BUY_QTY_BTN_EXTRA_W_PX);
    const height = base.height + this.artSpanOnPanelH(DETAIL_BUY_QTY_BTN_EXTRA_H_PX);
    return {
      left: base.centerX - width / 2,
      top: base.centerY - height / 2,
      width,
      height,
      centerX: base.centerX,
      centerY: base.centerY,
    };
  }

  /** Qty pill hit / input / display: baked sub-rect on layout row, expanded symmetrically (not −/+ buttons). */
  private buyQtyFieldHitRectFromArt(
    x0Px: number,
    x1Px: number,
    y0Px: number,
    y1Px: number
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const base = this.buyQtySubRectFromArt(x0Px, x1Px, y0Px, y1Px);
    const width = base.width + this.artSpanOnPanelW(DETAIL_BUY_QTY_FIELD_EXTRA_W_PX);
    const height = base.height + this.artSpanOnPanelH(DETAIL_BUY_QTY_FIELD_EXTRA_H_PX);
    return {
      left: base.centerX - width / 2,
      top: base.centerY - height / 2,
      width,
      height,
      centerX: base.centerX,
      centerY: base.centerY,
    };
  }

  private createBuyMainHit(): Phaser.GameObjects.Rectangle {
    const hit = this.scene.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(SHOP_HIT_DEPTH)
      .setInteractive({ useHandCursor: true });
    hit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation();
        this.onBuyPointerDown();
      }
    );
    return hit;
  }

  private onBuyPointerDown(): void {
    if (!this.visible || !this.selectedId || !this.economy) return;
    this.purchase(this.selectedId, this.buyQuantity);
  }

  private buyMainHitRectFromArt(): {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const detail = this.detailBandRect();
    const rect = this.mapArtRectToScreen(
      DETAIL_BUY_X0_PX,
      DETAIL_BUY_Y0_PX,
      DETAIL_BUY_X1_PX,
      DETAIL_BUY_Y1_PX
    );
    const offsetY =
      this.artSpanOnPanelH(DETAIL_BUY_OFFSET_Y_ART_PX) + detail.height * DETAIL_BUY_Y_OFFSET_FRAC;
    const contentRow = resolveShopContentRowRect(this.panelH);
    const maxBottom = this.panelTop + contentRow.topPanelPx + contentRow.heightPanelPx;
    const height = rect.height * DETAIL_BUY_HEIGHT_SCALE;
    const top = Math.min(rect.top + offsetY, maxBottom - height);
    return {
      left: detail.left,
      top,
      width: detail.width,
      height,
      centerX: detail.centerX,
      centerY: top + height / 2,
    };
  }

  private layoutBuyMainHit(): void {
    if (!this.buyMainHit) return;
    const rect = this.buyMainHitRectFromArt();
    this.buyMainHit.setPosition(rect.centerX, rect.centerY);
    this.buyMainHit.setSize(Math.max(rect.width, 8), Math.max(rect.height, 8));
  }

  private createBuyQtyHitZone(
    target: 'minus' | 'field' | 'plus',
    onPointerDown: () => void
  ): Phaser.GameObjects.Rectangle {
    const zone = this.scene.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(SHOP_HIT_DEPTH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (!this.visible || !this.selectedId || !this.economy) return;
      if (isShopGridDebug()) {
        const rect =
          target === 'field'
            ? this.buyQtyFieldHitRectFromArt(
                DETAIL_BUY_QTY_FIELD_X0_PX,
                DETAIL_BUY_QTY_FIELD_X1_PX,
                DETAIL_BUY_QTY_ROW_Y0_PX,
                DETAIL_BUY_QTY_ROW_Y1_PX
              )
            : this.buyQtyBtnHitRectFromArt(
                target === 'minus' ? DETAIL_BUY_QTY_MINUS_X0_PX : DETAIL_BUY_QTY_PLUS_X0_PX,
                target === 'minus' ? DETAIL_BUY_QTY_MINUS_X1_PX : DETAIL_BUY_QTY_PLUS_X1_PX,
                DETAIL_BUY_QTY_ROW_Y0_PX,
                DETAIL_BUY_QTY_ROW_Y1_PX
              );
        const pointer = this.scene.input.activePointer;
        console.log('[shop buy-qty] hit', target, {
          pointerX: pointer.x,
          pointerY: pointer.y,
          rect,
        });
      }
      onPointerDown();
    });
    return zone;
  }

  private layoutBuyQtyHitZone(
    zone: Phaser.GameObjects.Rectangle,
    rect: { width: number; height: number; centerX: number; centerY: number }
  ): void {
    zone.setPosition(rect.centerX, rect.centerY);
    zone.setSize(Math.max(rect.width, 8), Math.max(rect.height, 8));
  }

  private layoutBuyQtyHitZones(): void {
    if (!this.buyMinusHit) return;
    this.layoutBuyQtyHitZone(
      this.buyMinusHit,
      this.buyQtyBtnHitRectFromArt(
        DETAIL_BUY_QTY_MINUS_X0_PX,
        DETAIL_BUY_QTY_MINUS_X1_PX,
        DETAIL_BUY_QTY_ROW_Y0_PX,
        DETAIL_BUY_QTY_ROW_Y1_PX
      )
    );
    this.layoutBuyQtyHitZone(
      this.buyQtyFieldHit,
      this.buyQtyFieldHitRectFromArt(
        DETAIL_BUY_QTY_FIELD_X0_PX,
        DETAIL_BUY_QTY_FIELD_X1_PX,
        DETAIL_BUY_QTY_ROW_Y0_PX,
        DETAIL_BUY_QTY_ROW_Y1_PX
      )
    );
    this.layoutBuyQtyHitZone(
      this.buyPlusHit,
      this.buyQtyBtnHitRectFromArt(
        DETAIL_BUY_QTY_PLUS_X0_PX,
        DETAIL_BUY_QTY_PLUS_X1_PX,
        DETAIL_BUY_QTY_ROW_Y0_PX,
        DETAIL_BUY_QTY_ROW_Y1_PX
      )
    );
  }

  private strokeBuyQtyDebugRegions(
    g: Phaser.GameObjects.Graphics,
    labels: Phaser.GameObjects.Text[],
    scene: Phaser.Scene
  ): void {
    const qtyRegions: { id: string; x0: number; x1: number; y0: number; y1: number }[] = [
      {
        id: 'qtyMinus',
        x0: DETAIL_BUY_QTY_MINUS_X0_PX,
        x1: DETAIL_BUY_QTY_MINUS_X1_PX,
        y0: DETAIL_BUY_QTY_ROW_Y0_PX,
        y1: DETAIL_BUY_QTY_ROW_Y1_PX,
      },
      {
        id: 'qtyField',
        x0: DETAIL_BUY_QTY_FIELD_X0_PX,
        x1: DETAIL_BUY_QTY_FIELD_X1_PX,
        y0: DETAIL_BUY_QTY_ROW_Y0_PX,
        y1: DETAIL_BUY_QTY_ROW_Y1_PX,
      },
      {
        id: 'qtyPlus',
        x0: DETAIL_BUY_QTY_PLUS_X0_PX,
        x1: DETAIL_BUY_QTY_PLUS_X1_PX,
        y0: DETAIL_BUY_QTY_ROW_Y0_PX,
        y1: DETAIL_BUY_QTY_ROW_Y1_PX,
      },
    ];
    g.lineStyle(2, DEBUG_BUY_QTY_HIT_COLOR, DEBUG_ART_GRID_ALPHA);
    for (const region of qtyRegions) {
      const rect =
        region.id === 'qtyField'
          ? this.buyQtyFieldHitRectFromArt(region.x0, region.x1, region.y0, region.y1)
          : this.buyQtyBtnHitRectFromArt(region.x0, region.x1, region.y0, region.y1);
      g.strokeRect(rect.left, rect.top, rect.width, rect.height);
      labels.push(
        scene.add
          .text(rect.centerX, rect.centerY, region.id, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#ffb74d',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setAlpha(0.92)
      );
    }

    const buyRegions: { id: string }[] = [{ id: 'buy' }];
    for (const region of buyRegions) {
      const rect = this.buyMainHitRectFromArt();
      g.strokeRect(rect.left, rect.top, rect.width, rect.height);
      labels.push(
        scene.add
          .text(rect.centerX, rect.centerY, region.id, {
            fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_FONT_BASE_PX, this.typographyScale),
            color: '#ffb74d',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setAlpha(0.92)
      );
    }

    const displayRow = this.buyQtyDisplayRowRect();
    g.lineStyle(1, DEBUG_BUY_QTY_HIT_COLOR, DEBUG_ART_GRID_ALPHA * 0.55);
    g.strokeRect(displayRow.left, displayRow.top, displayRow.width, displayRow.height);
    labels.push(
      scene.add
        .text(displayRow.centerX, displayRow.top - 4, 'qtyRowBg', {
          fontSize: scaledFontSizePx(SHOP_DEBUG_LABEL_SMALL_BASE_PX, this.typographyScale),
          color: '#ffb74d',
          fontFamily: 'Arial',
          align: 'center',
        })
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setAlpha(0.85)
    );
  }

  private updateBuyQtyDisplay(): void {
    if (!this.detailBuyQtyText) return;
    this.layoutDetailBuyQtyRow();
    const field = this.buyQtyFieldHitRectFromArt(
      DETAIL_BUY_QTY_FIELD_X0_PX,
      DETAIL_BUY_QTY_FIELD_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const fontPx = this.buyQtyFontSizePx(field.height);
    applyWarehouseTitleLikeSizing(this.detailBuyQtyText, 'light', fontPx);
    this.detailBuyQtyText.setPosition(field.centerX, field.centerY);
    this.detailBuyQtyText.setText(String(this.buyQuantity));
    this.layoutBuyQtyHitZones();
    this.layoutBuyMainHit();
  }

  private refreshBuyQuantity(): void {
    if (!this.selectedId || !this.economy) {
      this.buyQuantity = 1;
      this.detailBuyQtyText?.setText('');
      this.detailBuyQtyText?.setVisible(false);
      this.detailBuyQtyBg?.setVisible(false);
      this.setBuyQtyControlsEnabled(false);
      return;
    }
    this.detailBuyQtyText?.setVisible(true);
    this.setBuyQtyControlsEnabled(true);
    this.setBuyQuantity(this.buyQuantity);
  }

  private setBuyQtyControlsEnabled(enabled: boolean): void {
    const active = enabled && this.visible;
    for (const zone of [this.buyMainHit, this.buyMinusHit, this.buyQtyFieldHit, this.buyPlusHit]) {
      if (zone?.input) zone.input.enabled = active;
    }
  }

  /** Center coin + amount horizontally inside `detailPriceBox`. */
  private layoutDetailPriceRow(): void {
    const priceBoxCenterX = this.detailPriceBox.x;
    const priceBoxCenterY = this.detailPriceBox.y;
    const priceBoxW = this.detailPriceBox.displayWidth;
    const priceBoxH = this.detailPriceBox.displayHeight;
    const coinIconSize = Math.min(priceBoxH * 0.75, this.artSpanOnPanelH(DETAIL_PRICE_COIN_MAX_SIZE_PX));
    this.detailPriceCoin.setDisplaySize(coinIconSize, coinIconSize);
    applyWarehouseTitleLikeSizing(
      this.detailPriceAmount,
      'dark',
      Math.max(8, this.scaleFont(DETAIL_PRICE_AMOUNT_FONT_SIZE_PX))
    );
    const priceRowGapX = priceBoxW * DETAIL_PRICE_COIN_AMOUNT_GAP_FRAC;
    const textWidth = this.detailPriceAmount.width;
    const groupW = coinIconSize + priceRowGapX + textWidth;
    const groupLeft = priceBoxCenterX - groupW / 2;
    this.detailPriceCoin.setPosition(groupLeft + coinIconSize * 0.5, priceBoxCenterY);
    this.detailPriceAmount.setPosition(groupLeft + coinIconSize + priceRowGapX, priceBoxCenterY);
  }

  private refreshPagination(): void {
    const pages = this.pageCount();
    const label = `${this.currentPage + 1}/${pages}`;
    this.pageLabel.setText(label);
    this.pageLabel.setVisible(pages > 1);
    this.pageTabHits.forEach((hit, i) => {
      const visible = i < pages;
      hit.setVisible(visible);
      this.pageTabHighlights[i]?.setVisible(visible && i === this.currentPage);
    });
  }

  private refreshAll(): void {
    this.layoutShopPanel();
    this.refreshGrid();
    this.refreshDetail();
    this.refreshPagination();
    if (this.visible) this.bringBuyControlsToTop();
  }

  setOnBuy(cb: (result: ShopBuyResult) => void): void {
    this.onBuy = cb;
  }

  show(economy: EconomySystem, inventory: InventorySystem, _hud?: HUDResources): void {
    this.economy = economy;
    this.inventory = inventory;

    this.toastText.setVisible(false);
    this.selectCategory('all');

    this.syncDebugGrid();
    this.bringDebugGridToTop();

    this.container.setDepth(HUD_MODAL_DEPTH);
    this.container.setVisible(true);
    this.scene.children.bringToTop(this.container);
    this.bringBuyControlsToTop();
    this.visible = true;
  }

  private showToast(message: string): void {
    this.toastText.setText(message);
    this.toastText.setVisible(message.length > 0);
  }

  private purchase(itemId: string, qty: number): void {
    if (!this.economy || !this.inventory) return;
    const unitPrice = this.economy.getShopPrice(itemId);
    const total = unitPrice * qty;
    if (!this.economy.canAfford(total)) {
      const result: ShopBuyResult = {
        success: false,
        message: `Cần ${total} xu (có ${this.economy.getCoins()})`,
      };
      this.showToast(result.message);
      this.onBuy?.(result);
      return;
    }
    if (!this.inventory.canAdd(itemId, qty)) {
      const result: ShopBuyResult = { success: false, message: 'Kho đầy' };
      this.showToast(result.message);
      this.onBuy?.(result);
      return;
    }
    this.economy.spend(total);
    this.inventory.add(itemId, qty);
    const result: ShopBuyResult = {
      success: true,
      message: `Đã mua ${qty} với ${total} xu`,
    };
    this.showToast('');
    this.refreshAll();
    this.onBuy?.(result);
  }

  hide(): void {
    this.hideBuyQtyInput();
    this.setBuyQtyControlsEnabled(false);
    this.container.setVisible(false);
    this.visible = false;
    this.toastText.setVisible(false);
  }

  toggle(economy: EconomySystem, inventory: InventorySystem, hud?: HUDResources): void {
    if (this.visible) this.hide();
    else this.show(economy, inventory, hud);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.scene.input.off('wheel', this.boundWheel);
    this.scene.input.off('pointerup', this.boundClearScrollDrag);
    this.scene.input.off('pointerupoutside', this.boundClearScrollDrag);
    this.hideBuyQtyInput();
    this.buyQtyInputEl?.remove();
    this.buyQtyInputEl = null;
    this.scrollViewport?.clearMask(true);
    this.scrollGeometryMask?.destroy();
    this.scrollMaskGraphics?.destroy();
    this.container.destroy();
  }

  /** Dev/e2e: panel fit + grid metrics in screen space. */
  getShopLayoutMetrics(): ShopLayoutMetrics {
    const grid = this.getGridLayoutMetrics();
    const contentCol = resolveShopModalColRect(1, SHOP_MODAL_LAYOUT_COLS, this.panelW);
    const contentRow = resolveShopContentRowRect(this.panelH);
    return {
      viewportW: this.viewportW,
      viewportH: this.viewportH,
      artW: SHOP_ART_W,
      artH: SHOP_ART_H,
      artAspect: SHOP_ART_W / SHOP_ART_H,
      panelAspect: this.panelW / this.panelH,
      panelRight: this.panelLeft + this.panelW,
      panelBottom: this.panelTop + this.panelH,
      bgTargetLeft: this.panelLeft,
      bgTargetTop: this.panelTop,
      bgTargetW: this.panelW,
      bgTargetH: this.panelH,
      contentListsLeft: this.panelLeft + contentCol.leftPanelPx,
      contentListsTop: this.panelTop + contentRow.topPanelPx,
      contentListsW: contentCol.widthPanelPx,
      contentListsH: contentRow.heightPanelPx,
      ...grid,
    };
  }

  /** Dev/e2e: grid + panel metrics in screen space. */
  getGridLayoutMetrics(): ShopGridLayoutMetrics {
    const gridBand = this.modalZoneRect(SHOP_LAYOUT_GRID_COL_START, SHOP_LAYOUT_GRID_COL_SPAN);
    const gridViewportInset = resolveShopProductGridViewportInset(gridBand.height);
    const gridOffsetY = this.artSpanOnPanelH(SHOP_ITEM_GRID_OFFSET_Y_PX);
    const grid = {
      left: gridBand.left,
      top: gridBand.top + gridViewportInset.viewportTopOffsetPx + gridOffsetY,
      width: gridBand.width,
      height: gridViewportInset.viewportHeightPx,
    };
    const contentW = grid.width - this.gridContentPadLeft - this.gridContentPadRight;
    const rowPitch = (grid.height - this.gridContentPadTop) / this.gridRows;
    const row2SlotTop =
      grid.top + this.gridContentPadTop + (this.gridRows - 1) * rowPitch;
    const row2SlotBottom = row2SlotTop + this.cellH;
    const row2IconTop = row2SlotTop + this.cellH * 0.38;
    const row2IconBottom = row2IconTop + this.cellH * GRID_ICON_SIZE_H_FRAC;
    const viewportBottomPx = grid.top + grid.height;
    return {
      panelW: this.panelW,
      panelH: this.panelH,
      panelLeft: this.panelLeft,
      panelTop: this.panelTop,
      gridLeft: this.gridLeft,
      gridTop: this.gridTop,
      gridW: this.gridViewportW,
      gridContentW: contentW,
      gridContentPadLeft: this.gridContentPadLeft,
      gridContentPadRight: this.gridContentPadRight,
      gridContentPadTop: this.gridContentPadTop,
      gridH: this.gridViewportH,
      tabListModalAvailableH: this.tabListModalAvailableH,
      tabListViewportH: this.tabListViewportH,
      tabListViewportW: this.tabListViewportW,
      tabListTop: this.tabListTop,
      tabListLeft: this.tabListLeft,
      tabItemScale: this.tabItemScale,
      tabListContentH: this.tabListContentH,
      tabScrollOffset: 0,
      tabMaxScrollOffset: 0,
      cols: GRID_COLS,
      rows: this.gridRows,
      cellW: this.cellW,
      cellH: rowPitch,
      cardWFrac: GRID_CARD_W_FRAC,
      cardHFrac: GRID_CARD_H_FRAC,
      cardBgScale: GRID_CARD_BG_SCALE,
      cardScale: SHOP_ITEM_CARD_SCALE,
      gridWidthScale: 1,
      gapPxH: (contentW / GRID_COLS) * (1 - GRID_CARD_W_FRAC),
      rowGapPx: GRID_ROW_GAP_PX,
      rowOverlapPx: GRID_ROW_OVERLAP_PX,
      gapPxV: Math.max(0, this.pitchCellH - this.cardDisplayH - GRID_ROW_OVERLAP_PX),
      row2BottomPx: row2SlotBottom,
      row2SlotTopPx: row2SlotTop,
      row2SlotBottomPx: row2SlotBottom,
      row2IconTopPx: row2IconTop,
      row2IconBottomPx: row2IconBottom,
      viewportBottomPx,
      row2FitsViewport: row2SlotBottom <= viewportBottomPx + 1,
      row2IconFitsViewport: row2IconBottom <= viewportBottomPx + 1,
      closeHit: {
        centerX: this.closeHit.x,
        centerY: this.closeHit.y,
        radius: this.closeHit.radius,
        width: this.closeHit.radius * 2,
        height: this.closeHit.radius * 2,
      },
      categoryTabs: this.categoryTabs.map((tab, index) => ({
        index,
        centerX: tab.hit.x,
        centerY: tab.hit.y,
        hitW: tab.hit.width,
        hitH: tab.hit.height,
        glowW: tab.glow.width,
        glowH: tab.glow.height,
        textureKey: tab.bg.texture?.key ?? '',
      })),
      debugGrid: isShopGridDebug(),
      debugGridContainerIndex: this.debugGridContainer
        ? this.container.getIndex(this.debugGridContainer)
        : -1,
      debugGridDepth: this.debugGridContainer?.depth ?? 0,
      scrollOffset: this.scrollOffset,
      maxScrollOffset: this.getMaxScrollOffset(),
      viewportRows: this.gridRows,
    };
  }

  /** Dev/e2e: rebuild layout grid after toggling debug flag. */
  refreshDebugGrid(): void {
    this.syncDebugGrid();
    this.bringDebugGridToTop();
    this.bringBuyControlsToTop();
  }

  /** Dev/e2e: active shop category tab. */
  getActiveCategory(): ShopCategoryId {
    return this.activeCategory;
  }

  /** Dev/e2e: selected product id in detail panel. */
  getSelectedItemId(): string | null {
    return this.selectedId;
  }

  /** Dev/e2e: count of products in the current 4×3 viewport. */
  getVisibleGridCount(): number {
    const ids = this.effectiveFilteredIds();
    const start = this.firstVisibleRow() * GRID_COLS;
    return Math.min(this.gridPageSize, Math.max(0, ids.length - start));
  }

  /** Dev/e2e: viewport slot snapshot (0–11). */
  getGridSlotSnapshot(slotIndex: number): {
    hasCardBg: boolean;
    hasIcon: boolean;
    itemId: string | null;
  } {
    const itemId = this.itemIdAtSlot(slotIndex);
    return {
      hasCardBg: slotIndex >= 0 && slotIndex < this.gridPageSize,
      hasIcon: Boolean(itemId),
      itemId,
    };
  }

  /** Dev/e2e: pagination label visibility (hidden when only one page). */
  isPageLabelVisible(): boolean {
    return this.pageLabel.visible;
  }

  /** Dev/e2e: detail panel + pagination snapshot. */
  /** Dev/e2e: texture keys for detail stat row backgrounds. */
  getDetailStatBgSnapshot(): { visible: boolean; texture: string; width: number; height: number }[] {
    return this.detailStatBgs.map((bg) => ({
      visible: bg.visible,
      texture: bg.texture.key,
      width: bg.displayWidth,
      height: bg.displayHeight,
    }));
  }

  getDetailSnapshot(): {
    title: string;
    priceLine: string;
    unitPriceAmount: string;
    buyQuantity: number;
    maxBuyQuantity: number;
    buyEnabled: boolean;
    pageLabel: string;
    pageCount: number;
    currentPage: number;
  } {
    const unit = this.selectedId && this.economy ? this.economy.getShopPrice(this.selectedId) : 0;
    return {
      title: this.detailTitle.text,
      priceLine: this.detailStatLines[0]?.text ?? '',
      unitPriceAmount: this.detailPriceAmount.text,
      buyQuantity: this.buyQuantity,
      maxBuyQuantity: this.selectedId ? this.getMaxBuyQuantity(this.selectedId) : 1,
      buyEnabled: Boolean(this.selectedId && this.economy?.canAfford(unit)),
      pageLabel: this.pageLabel.text,
      pageCount: this.pageCount(),
      currentPage: this.currentPage,
    };
  }

  /** Dev/e2e: fire pointerdown on category tab by index (0 = all). */
  simulateCategoryTabClick(index: number): void {
    const tab = this.categoryTabs[index];
    if (!tab) return;
    tab.hit.emit('pointerdown');
  }

  /** Dev/e2e: select product by item id. */
  selectItemForTest(itemId: string): void {
    if (this.effectiveFilteredIds().includes(itemId)) {
      this.selectItem(itemId);
    }
  }

  /** Dev/e2e: fire pointerdown on grid slot (0–11). */
  simulateGridSlotClick(slotIndex: number): void {
    const itemId = this.itemIdAtSlot(slotIndex);
    if (itemId) this.selectItem(itemId);
  }

  /** Dev/e2e: jump to pagination page index. */
  simulatePageClick(pageIndex: number): void {
    this.setPage(pageIndex);
  }

  /** Dev/e2e: append duplicate entries to force multi-page grid. */
  padGridForTest(extraCount: number): void {
    this.testGridPadding = Math.max(0, extraCount);
    this.refreshAll();
  }

  /** Dev/e2e: trigger buy for selected item (same as baked BUY hit). */
  simulateBuyClick(): void {
    this.buyMainHit?.emit('pointerdown');
  }

  /** Dev/e2e: current buy quantity in detail panel. */
  getBuyQuantity(): number {
    return this.buyQuantity;
  }

  /** Dev/e2e: fire pointerdown on baked minus hit. */
  simulateBuyMinusClick(): void {
    this.buyMinusHit?.emit('pointerdown');
  }

  /** Dev/e2e: fire pointerdown on baked plus hit. */
  simulateBuyPlusClick(): void {
    this.buyPlusHit?.emit('pointerdown');
  }

  /** Dev/e2e: open qty pill input (same as tap on field). */
  simulateBuyQtyFieldClick(): void {
    this.buyQtyFieldHit?.emit('pointerdown');
  }

  /** Dev/e2e: set buy quantity via DOM input commit (same as type + blur). */
  setBuyQuantityInputForTest(qty: number): void {
    if (!this.selectedId) return;
    const input = this.ensureBuyQtyInput();
    input.value = String(qty);
    this.commitBuyQtyInput();
  }

  /** Dev/e2e: buy CTA + qty − / pill / + hit zones in screen + client space. */
  getBuyControlsSnapshot(): {
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
  } {
    const buy = this.buyMainHitRectFromArt();
    const minus = this.buyQtyBtnHitRectFromArt(
      DETAIL_BUY_QTY_MINUS_X0_PX,
      DETAIL_BUY_QTY_MINUS_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const field = this.buyQtyFieldHitRectFromArt(
      DETAIL_BUY_QTY_FIELD_X0_PX,
      DETAIL_BUY_QTY_FIELD_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const plus = this.buyQtyBtnHitRectFromArt(
      DETAIL_BUY_QTY_PLUS_X0_PX,
      DETAIL_BUY_QTY_PLUS_X1_PX,
      DETAIL_BUY_QTY_ROW_Y0_PX,
      DETAIL_BUY_QTY_ROW_Y1_PX
    );
    const toHit = (rect: typeof minus) => {
      const client = this.gameRectToClient(rect.left, rect.top, rect.width, rect.height);
      return {
        centerX: rect.centerX,
        centerY: rect.centerY,
        width: rect.width,
        height: rect.height,
        clientCenterX: client.left + client.width / 2,
        clientCenterY: client.top + client.height / 2,
      };
    };
    return { buy: toHit(buy), minus: toHit(minus), field: toHit(field), plus: toHit(plus) };
  }

  /** @deprecated Use getBuyControlsSnapshot */
  getBuyQtyControlsSnapshot(): ReturnType<ShopPanel['getBuyControlsSnapshot']> {
    return this.getBuyControlsSnapshot();
  }

  /** @deprecated Use getBuyCanvasClickPosition */
  getBuyQtyCanvasClickPosition(
    target: 'minus' | 'field' | 'plus'
  ): { x: number; y: number } {
    return this.getBuyCanvasClickPosition(target);
  }

  /** Dev/e2e: legacy helper; vector icon overlays were removed from runtime UI. */
  getBuyQtyIconDisplaySizes(): {
    minus: { width: number; height: number };
    plus: { width: number; height: number; armThickness: number };
  } {
    return {
      minus: { width: 0, height: 0 },
      plus: {
        width: 0,
        height: 0,
        armThickness: 0,
      },
    };
  }

  /** Dev/e2e: close-button hit zone. */
  simulateCloseClick(): void {
    this.closeHit.emit('pointerdown');
  }

  /** Dev/e2e: detail price row (`ui_box` + coin + amount) layout. */
  getDetailPriceBoxSnapshot(): {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    texture: string;
    unitPriceAmount: string;
    visible: boolean;
  } | null {
    if (!this.detailPriceBox) return null;
    return {
      centerX: this.detailPriceBox.x,
      centerY: this.detailPriceBox.y,
      width: this.detailPriceBox.displayWidth,
      height: this.detailPriceBox.displayHeight,
      texture: this.detailPriceBox.texture?.key ?? '',
      unitPriceAmount: this.detailPriceAmount.text,
      visible: this.detailPriceBox.visible,
    };
  }

  /** Dev/e2e: top currency bar removed — always null when shop is open. */
  getCurrencyBarSnapshot(): null {
    return null;
  }
}

export interface ShopLayoutMetrics extends ShopGridLayoutMetrics {
  viewportW: number;
  viewportH: number;
  artW: number;
  artH: number;
  artAspect: number;
  panelAspect: number;
  panelRight: number;
  panelBottom: number;
  bgTargetLeft: number;
  bgTargetTop: number;
  bgTargetW: number;
  bgTargetH: number;
  contentListsLeft: number;
  contentListsTop: number;
  contentListsW: number;
  contentListsH: number;
}

export interface ShopGridLayoutMetrics {
  panelW: number;
  panelH: number;
  panelLeft: number;
  panelTop: number;
  gridLeft: number;
  gridTop: number;
  gridW: number;
  /** Usable width inside horizontal padding (gridW − left − right). */
  gridContentW: number;
  gridContentPadLeft: number;
  gridContentPadRight: number;
  gridContentPadTop: number;
  gridH: number;
  tabListModalAvailableH: number;
  tabListViewportH: number;
  tabListViewportW: number;
  tabListTop: number;
  tabListLeft: number;
  tabItemScale: number;
  tabListContentH: number;
  tabScrollOffset: number;
  tabMaxScrollOffset: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  cardWFrac: number;
  cardHFrac: number;
  /** Boost applied to shop-item bg after fit-box sizing. */
  cardBgScale: number;
  cardScale: number;
  gridWidthScale: number;
  /** Approx horizontal gutter between adjacent cards (cell pitch − card width). */
  gapPxH: number;
  /** Target row gap constant (edge-to-edge between card frames). */
  rowGapPx: number;
  rowOverlapPx: number;
  /** Measured vertical gutter between adjacent card rows. */
  gapPxV: number;
  row2BottomPx: number;
  row2SlotTopPx: number;
  row2SlotBottomPx: number;
  row2IconTopPx: number;
  row2IconBottomPx: number;
  viewportBottomPx: number;
  row2FitsViewport: boolean;
  row2IconFitsViewport: boolean;
  closeHit: {
    centerX: number;
    centerY: number;
    radius: number;
    width: number;
    height: number;
  };
  categoryTabs: {
    index: number;
    centerX: number;
    centerY: number;
    hitW: number;
    hitH: number;
    glowW: number;
    glowH: number;
    textureKey: string;
  }[];
  debugGrid: boolean;
  /** Container list index after `bringDebugGridToTop()` (below interactive hits). */
  debugGridContainerIndex: number;
  debugGridDepth: number;
  scrollOffset: number;
  maxScrollOffset: number;
  viewportRows: number;
}

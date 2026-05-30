import { expect, test } from '@playwright/test';

const WAREHOUSE_ART_W = 1536;
const WAREHOUSE_ART_H = 1024;
const TOP_INSET_FRAC = 0.11;
const BOTTOM_INSET_FRAC = 0.112;
const SECTION_GAP_FRAC = 0.014;
const HEADER_SECTION_HEIGHT_FRAC = 0.145;
const BOTTOM_SECTION_HEIGHT_FRAC = 0.22;
const HEADER_SECTION_TOP_FRAC = TOP_INSET_FRAC;
const HEADER_SECTION_BOTTOM_FRAC = HEADER_SECTION_TOP_FRAC + HEADER_SECTION_HEIGHT_FRAC;
const GRID_TOP_NUDGE_UP_FRAC = 0.035;
const GRID_TOP_FRAC =
  HEADER_SECTION_BOTTOM_FRAC + SECTION_GAP_FRAC - GRID_TOP_NUDGE_UP_FRAC;
const GRID_INSET_LEFT_FRAC = 88 / WAREHOUSE_ART_W;
const GRID_INSET_RIGHT_FRAC = 1330 / WAREHOUSE_ART_W;
const GRID_WIDTH_FRAC = GRID_INSET_RIGHT_FRAC - GRID_INSET_LEFT_FRAC;
const GRID_LEFT_FRAC = GRID_INSET_LEFT_FRAC;
/** Matches `ITEMS_LIST_WIDTH_SCALE` in InventoryPanel.ts */
const ITEMS_LIST_WIDTH_SCALE = 1.029169; // 1.034341 × 0.995 — items list container width −0.5%
/** Matches `ITEMS_LIST_OFFSET_*_PANEL_FRAC` in InventoryPanel.ts */
const ITEMS_LIST_OFFSET_X_PANEL_FRAC = -0.005;
const ITEMS_LIST_OFFSET_Y_PANEL_FRAC = -0.002;
/** Matches `ITEM_SLOT_WIDTH_SCALE` in InventoryPanel.ts (renderList slot cards only). */
const ITEM_SLOT_WIDTH_SCALE = 1.086585; // 1.083336 × 1.003 — slot card width +0.3%
/** Matches `WAREHOUSE_INNER_OFFSET_*` in InventoryPanel.ts */
const WAREHOUSE_INNER_OFFSET_X_PX = 0;
const WAREHOUSE_INNER_OFFSET_Y_PX = -10;
const WAREHOUSE_INNER_OFFSET_X_FRAC = 0;
const WAREHOUSE_INNER_OFFSET_Y_FRAC = -0.01;
/** Two visible rows inside beige inset on warehouse art. */
const GRID_HEIGHT_FRAC = 0.33124; // 0.338 × 0.98 — height −2%
const GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX = 10;
const WAREHOUSE_GRID_COLS = 6;
const WAREHOUSE_GRID_ROWS = 2;
const CELL_SLOT_SHRINK_W_ART_PX = 5;
const CELL_SLOT_HEIGHT_EXTRA_ART_PX = 2;
const GRID_TOP_OFFSET_FRAC = 66 / WAREHOUSE_ART_H;

/** Dark-pill text areas (right of icon), measured from `warehouse.png`. */
const BOTTOM_SECTION_BOTTOM_FRAC = 1 - BOTTOM_INSET_FRAC;
const BOTTOM_SECTION_TOP_FRAC = BOTTOM_SECTION_BOTTOM_FRAC - BOTTOM_SECTION_HEIGHT_FRAC;

/** Matches sell footer row constants in InventoryPanel.ts */
const SELL_FOOTER_ROW_WIDTH_FRAC = 0.9;
const SELL_FOOTER_ROW_LEFT_FRAC = (1 - SELL_FOOTER_ROW_WIDTH_FRAC) / 2;
const SELL_FOOTER_COL1_FRAC = 0.35;
const SELL_FOOTER_COL2_FRAC = 0.3;
const SELL_FOOTER_COL3_FRAC = 0.35;
const DETAIL_BOTTOM_FRAC = 0.05;
const DETAIL_HEIGHT_FRAC =
  BOTTOM_SECTION_BOTTOM_FRAC - 0.001 - (BOTTOM_SECTION_TOP_FRAC + 0.005);
const SELL_FOOTER_ROW_Y1 = 1 - DETAIL_BOTTOM_FRAC;
const SELL_FOOTER_ROW_Y0 = SELL_FOOTER_ROW_Y1 - DETAIL_HEIGHT_FRAC;

const UPGRADE_HIT_REGION = {
  x0: 0.638,
  y0: BOTTOM_SECTION_TOP_FRAC + 0.004,
  x1: 0.924,
  y1: BOTTOM_SECTION_BOTTOM_FRAC,
} as const;

/** Legacy art bounding box for center sell controls — maps into footer col2. */
const SELL_COL2_ART = {
  x0: 0.3893,
  x1: 0.6341,
  y0: 0.7031,
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

function sellFooterRowRectPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number
): { left: number; top: number; width: number; height: number; centerX: number } {
  const left = panelLeft + panelW * SELL_FOOTER_ROW_LEFT_FRAC;
  const top = panelTop + panelH * SELL_FOOTER_ROW_Y0;
  const width = panelW * SELL_FOOTER_ROW_WIDTH_FRAC;
  const height = panelH * (SELL_FOOTER_ROW_Y1 - SELL_FOOTER_ROW_Y0);
  return { left, top, width, height, centerX: left + width / 2 };
}

function sellFooterColRectPx(
  row: { left: number; top: number; width: number; height: number },
  col: 1 | 2 | 3
): { left: number; top: number; width: number; height: number } {
  const colStart =
    col === 1 ? 0 : col === 2 ? SELL_FOOTER_COL1_FRAC : SELL_FOOTER_COL1_FRAC + SELL_FOOTER_COL2_FRAC;
  const colWidth =
    col === 1 ? SELL_FOOTER_COL1_FRAC : col === 2 ? SELL_FOOTER_COL2_FRAC : SELL_FOOTER_COL3_FRAC;
  return {
    left: row.left + row.width * colStart,
    top: row.top,
    width: row.width * colWidth,
    height: row.height,
  };
}

function sellFooterColCellRectPx(
  row: { left: number; top: number; width: number; height: number },
  col: 1 | 2 | 3,
  cell: { x0: number; x1: number; y0: number; y1: number }
): { left: number; top: number; width: number; height: number } {
  const colRect = sellFooterColRectPx(row, col);
  return {
    left: colRect.left + colRect.width * cell.x0,
    top: colRect.top + colRect.height * cell.y0,
    width: colRect.width * (cell.x1 - cell.x0),
    height: colRect.height * (cell.y1 - cell.y0),
  };
}

/** Lv1→2 costs from `WAREHOUSE.upgradeCosts[0]`. */
const EXPECTED_UPGRADE_COST = { coins: 200, wood: 10, stone: 5 };

interface WarehouseGridLayout {
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
  upgradePanelCells: { id: string; left: number; top: number; width: number; height: number }[];
  upgradeCostTexts: {
    id: 'coin' | 'wood' | 'stone';
    slotId: string;
    x: number;
    y: number;
    text: string;
  }[];
  sellControlsCells: { id: string; left: number; top: number; width: number; height: number }[];
  headerCells: { id: string; left: number; top: number; width: number; height: number }[];
  activeTab: string;
  capacityFillRatio: number;
  capacityText: { x: number; y: number; originX: number; originY: number };
  tabSprites: {
    id: string;
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
}

const CLOSE_RIGHT_FRAC = 0.05;
const CLOSE_TOP_FRAC = 0.05;
const CLOSE_BTN_RADIUS_ART_PX = 56;

const UPGRADE_BASE_HIT_Y0 = 0.668;
const UPGRADE_BASE_HIT_Y1 = 0.888;
const UPGRADE_BASE_HIT_SPAN = UPGRADE_BASE_HIT_Y1 - UPGRADE_BASE_HIT_Y0;
const upgradeYInBottomSection = (legacyYFrac: number): number => {
  const rel = (legacyYFrac - UPGRADE_BASE_HIT_Y0) / UPGRADE_BASE_HIT_SPAN;
  return UPGRADE_HIT_REGION.y0 + rel * (UPGRADE_HIT_REGION.y1 - UPGRADE_HIT_REGION.y0);
};
const UPGRADE_PANEL_CELLS = [
  { id: 'upgradeIcon', x0: 0.662, y0: upgradeYInBottomSection(0.688), x1: 0.748, y1: upgradeYInBottomSection(0.818) },
  { id: 'levelBox', x0: 0.7572, y0: upgradeYInBottomSection(0.6924), x1: 0.8932, y1: upgradeYInBottomSection(0.7295) },
  { id: 'capacityBox', x0: 0.7572, y0: upgradeYInBottomSection(0.7432), x1: 0.8932, y1: upgradeYInBottomSection(0.7813) },
  { id: 'coinSlot', x0: 0.7044, y0: upgradeYInBottomSection(0.8223), x1: 0.735, y1: upgradeYInBottomSection(0.8584) },
  { id: 'woodSlot', x0: 0.776, y0: upgradeYInBottomSection(0.8223), x1: 0.8118, y1: upgradeYInBottomSection(0.8584) },
  { id: 'stoneSlot', x0: 0.8542, y0: upgradeYInBottomSection(0.8233), x1: 0.89, y1: upgradeYInBottomSection(0.8584) },
] as const;

/** Matches `UPGRADE_COIN_SLOT_EXPAND_LEFT_PX` in InventoryPanel.ts */
const UPGRADE_COIN_SLOT_EXPAND_LEFT_PX = 5;

const COST_SLOT_IDS = ['coinSlot', 'woodSlot', 'stoneSlot'] as const;
const COST_POS_TOLERANCE_PX = 4;

const CAPACITY_TRACK_SLOT_Y0_FRAC = 125 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_SLOT_H_FRAC = 134 / WAREHOUSE_ART_H;
const CAPACITY_TRACK_X0_FRAC = 355 / WAREHOUSE_ART_W;
/** Art slot width for `process-empty` (reference for fill ratio only). */
const CAPACITY_TRACK_W_FRAC = 668 / WAREHOUSE_ART_W;
/** Process bar outer region width as fraction of modal panel width. */
const PROCESS_BAR_WIDTH_FRAC = 0.8;
/** Inner `process-empty` track width as fraction of outer process bar width. */
const PROCESS_INNER_WIDTH_FRAC = 0.7;
/** Nudge process row vertically as fraction of panel height (negative = up). */
const PROCESS_ROW_Y_OFFSET_PANEL_FRAC = -0.001;
const CAPACITY_TRACK_H_FRAC = CAPACITY_TRACK_SLOT_H_FRAC * 0.5;
const CAPACITY_TRACK_Y0_FRAC =
  CAPACITY_TRACK_SLOT_Y0_FRAC + (CAPACITY_TRACK_SLOT_H_FRAC - CAPACITY_TRACK_H_FRAC) / 2;
const CAPACITY_FILL_MAX_W_FRAC = 398 / WAREHOUSE_ART_W;
const CAPACITY_FILL_MAX_TRACK_W_FRAC = CAPACITY_FILL_MAX_W_FRAC / CAPACITY_TRACK_W_FRAC;
const CAPACITY_FILL_OFFSET_ART_PX = 42;
const CAPACITY_FILL_OFFSET_X_PANEL_FRAC = 0.0075;
const CAPACITY_FILL_OFFSET_Y_PANEL_FRAC = -0.0025;
const CAPACITY_FILL_H_FRAC = (82 / WAREHOUSE_ART_H) * 0.5;
const CAPACITY_TEXT_PILL_W_FRAC = 84 / WAREHOUSE_ART_W;
const CAPACITY_TEXT_TRACK_X_FRAC = 0.84;
const CAPACITY_TEXT_OFFSET_X_PANEL_FRAC = -0.055;
const CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC = -0.0015;
const CAPACITY_TEXT_PILL_WIDTH_EXTRA_PX = 80;
const CAPACITY_TEXT_PILL_OFFSET_X = -72;
const CAPACITY_TEXT_OFFSET_X = 4;

type WarehouseCoverCrop = { cropX: number; cropY: number; cropW: number; cropH: number };

function artSpanW(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop?: WarehouseCoverCrop
): number {
  return artFracSpanW(artPx / WAREHOUSE_ART_W, panelLeft, panelTop, panelW, panelH, crop);
}

function artSpanH(
  artPx: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop?: WarehouseCoverCrop
): number {
  return artFracSpanH(artPx / WAREHOUSE_ART_H, panelLeft, panelTop, panelW, panelH, crop);
}

function capacityProcessBgRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number,
  crop: WarehouseCoverCrop
): { left: number; top: number; width: number; height: number } {
  const base = rectFromArtFrac(
    CAPACITY_TRACK_X0_FRAC,
    CAPACITY_TRACK_X0_FRAC + CAPACITY_TRACK_W_FRAC,
    CAPACITY_TRACK_Y0_FRAC,
    CAPACITY_TRACK_Y0_FRAC + CAPACITY_TRACK_H_FRAC,
    panelLeft,
    panelTop,
    panelW,
    panelH,
    crop
  );
  const width = panelW * PROCESS_BAR_WIDTH_FRAC;
  const yOffset = panelH * PROCESS_ROW_Y_OFFSET_PANEL_FRAC;
  return {
    left: panelLeft + panelW * 0.5 - width * 0.5,
    top: base.top + yOffset,
    width,
    height: base.height,
  };
}

function capacityTrackAnchorRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number,
  crop: WarehouseCoverCrop
): { top: number; height: number } {
  return rectFromArtFrac(
    CAPACITY_TRACK_X0_FRAC,
    CAPACITY_TRACK_X0_FRAC + CAPACITY_TRACK_W_FRAC,
    CAPACITY_TRACK_Y0_FRAC,
    CAPACITY_TRACK_Y0_FRAC + CAPACITY_TRACK_H_FRAC,
    panelLeft,
    panelTop,
    panelW,
    panelH,
    crop
  );
}

function capacityTrackRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number,
  crop: WarehouseCoverCrop
): { left: number; top: number; width: number; height: number } {
  const outer = capacityProcessBgRectPx(panelW, panelH, panelLeft, panelTop, crop);
  const width = outer.width * PROCESS_INNER_WIDTH_FRAC;
  return {
    left: panelLeft + panelW * 0.5 - width * 0.5,
    top: outer.top,
    width,
    height: outer.height,
  };
}

function capacityFillRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number,
  crop: WarehouseCoverCrop
): { left: number; top: number; width: number; height: number } {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop, crop);
  const fillHeight = artSpanH(82, panelLeft, panelTop, panelW, panelH, crop) * 0.5;
  const fillCenterY = track.top + track.height / 2 + panelH * CAPACITY_FILL_OFFSET_Y_PANEL_FRAC;
  const fillTop = fillCenterY - fillHeight / 2;
  const fillLeftInset = artSpanW(CAPACITY_FILL_OFFSET_ART_PX, panelLeft, panelTop, panelW, panelH, crop);
  const fillMaxWidth = Math.max(
    0,
    track.width * CAPACITY_FILL_MAX_TRACK_W_FRAC - fillLeftInset
  );
  const fillLeft =
    track.left + fillLeftInset + panelW * CAPACITY_FILL_OFFSET_X_PANEL_FRAC;
  return { left: fillLeft, top: fillTop, width: fillMaxWidth, height: fillHeight };
}

function capacityTextPillRectPx(
  panelW: number,
  panelH: number,
  panelLeft: number,
  panelTop: number,
  crop: WarehouseCoverCrop
): { left: number; top: number; width: number; height: number } {
  const track = capacityTrackRectPx(panelW, panelH, panelLeft, panelTop, crop);
  const pillWidth =
    artSpanW(CAPACITY_TEXT_PILL_W_FRAC * WAREHOUSE_ART_W, panelLeft, panelTop, panelW, panelH, crop) +
    artSpanW(CAPACITY_TEXT_PILL_WIDTH_EXTRA_PX, panelLeft, panelTop, panelW, panelH, crop);
  const centerX =
    track.left +
    track.width * CAPACITY_TEXT_TRACK_X_FRAC +
    artSpanW(CAPACITY_TEXT_PILL_OFFSET_X, panelLeft, panelTop, panelW, panelH, crop) +
    panelW * CAPACITY_TEXT_OFFSET_X_PANEL_FRAC;
  return {
    left: centerX - pillWidth / 2,
    top: track.top,
    width: pillWidth,
    height: track.height,
  };
}

const TAB_DISPLAY_SCALE = 0.5;
/** Vertical scale for tab sprites and tablist background (width unchanged). */
const TAB_HEIGHT_SCALE = 1.01;
const TAB_SPRITE_SCALE = 0.92;
const TAB_EXTRA_W_ART_PX = 68;
const TAB_EXTRA_H_ART_PX = 13;
/** Horizontal gap between adjacent category tab sprites (warehouse art px). */
const TAB_GAP_ART_PX = 24;
const CAPACITY_TAB_MIN_GAP_ART_PX = 8;
const TAB_ROW_LEFT_ART_PX = 473 - 266 / 2;
const TAB_ROW_RIGHT_ART_PX = 1352.5 + 263 / 2;
const TAB_ROW_LEFT_FRAC = TAB_ROW_LEFT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_RIGHT_FRAC = TAB_ROW_RIGHT_ART_PX / WAREHOUSE_ART_W;
const TAB_ROW_BAND_FRAC = TAB_ROW_RIGHT_FRAC - TAB_ROW_LEFT_FRAC;
/** Center of baked tab rail on warehouse art (between first/last tab outer edges). */
const TAB_ROW_CENTER_X_FRAC = (TAB_ROW_LEFT_FRAC + TAB_ROW_RIGHT_FRAC) / 2;
/** Tab row band display width (~10% narrower than prior), fraction of panel W. */
const TAB_ROW_WIDTH_FRAC = TAB_ROW_BAND_FRAC * 0.874 * 0.9;
const TAB_GROUP_CENTER_TOLERANCE_PX = 4;

/** Matches InventoryPanel `computeObjectCoverCrop` / `artPxToScreen`. */
function computeObjectCoverCrop(
  texW: number,
  texH: number,
  targetW: number,
  targetH: number
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const scale = Math.max(targetW / texW, targetH / texH);
  const cropW = targetW / scale;
  const cropH = targetH / scale;
  const cropX = (texW - cropW) / 2;
  const cropY = (texH - cropH) / 2;
  return { cropX, cropY, cropW, cropH };
}

function defaultWarehouseCoverCrop(panelW: number, panelH: number): WarehouseCoverCrop {
  return computeObjectCoverCrop(WAREHOUSE_ART_W, WAREHOUSE_ART_H, panelW, panelH);
}

/** Mirrors InventoryPanel `fracX` / `fracY` (cover crop + inner UI nudge). */
function artFracToScreen(
  xFrac: number,
  yFrac: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop: WarehouseCoverCrop = defaultWarehouseCoverCrop(panelW, panelH)
): { x: number; y: number } {
  const artX = xFrac * WAREHOUSE_ART_W;
  const artY = yFrac * WAREHOUSE_ART_H;
  const u = crop.cropW > 0 ? (artX - crop.cropX) / crop.cropW : 0;
  const v = crop.cropH > 0 ? (artY - crop.cropY) / crop.cropH : 0;
  return {
    x:
      panelLeft +
      u * panelW +
      WAREHOUSE_INNER_OFFSET_X_PX +
      WAREHOUSE_INNER_OFFSET_X_FRAC * panelW,
    y:
      panelTop +
      v * panelH +
      WAREHOUSE_INNER_OFFSET_Y_PX +
      WAREHOUSE_INNER_OFFSET_Y_FRAC * panelH,
  };
}

function artFracSpanW(
  fracW: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop?: WarehouseCoverCrop
): number {
  const cover = crop ?? defaultWarehouseCoverCrop(panelW, panelH);
  return Math.abs(
    artFracToScreen(fracW, 0, panelLeft, panelTop, panelW, panelH, cover).x -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH, cover).x
  );
}

function artFracSpanH(
  fracH: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop?: WarehouseCoverCrop
): number {
  const cover = crop ?? defaultWarehouseCoverCrop(panelW, panelH);
  return Math.abs(
    artFracToScreen(0, fracH, panelLeft, panelTop, panelW, panelH, cover).y -
      artFracToScreen(0, 0, panelLeft, panelTop, panelW, panelH, cover).y
  );
}

function rectFromArtFrac(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop?: WarehouseCoverCrop
): { left: number; top: number; width: number; height: number } {
  const cover = crop ?? defaultWarehouseCoverCrop(panelW, panelH);
  const tl = artFracToScreen(x0, y0, panelLeft, panelTop, panelW, panelH, cover);
  const br = artFracToScreen(x1, y1, panelLeft, panelTop, panelW, panelH, cover);
  return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
}

const WAREHOUSE_TAB_SPECS = [
  { id: 'tabAll', tabId: 'all', centerY: 156 / WAREHOUSE_ART_H, artW: 266, artH: 136 },
  { id: 'tabResources', tabId: 'resources', centerY: 169 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabSeeds', tabId: 'seeds', centerY: 168 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabFood', tabId: 'food', centerY: 156 / WAREHOUSE_ART_H, artW: 260, artH: 136 },
  { id: 'tabMaterials', tabId: 'materials', centerY: 157 / WAREHOUSE_ART_H, artW: 263, artH: 136 },
] as const;

const TAB_ROW_CENTER_Y_FRAC = HEADER_SECTION_TOP_FRAC + HEADER_SECTION_HEIGHT_FRAC * 0.325;
/** Nudge tab row vertically as fraction of panel height (negative = up). */
const TAB_ROW_OFFSET_Y_PANEL_FRAC = -0.01;

function tabDisplaySizePx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  tab: (typeof WAREHOUSE_TAB_SPECS)[number],
  crop: WarehouseCoverCrop
): { w: number; h: number } {
  return {
    w:
      (artSpanW(tab.artW, panelLeft, panelTop, panelW, panelH, crop) * TAB_DISPLAY_SCALE +
        artSpanW(TAB_EXTRA_W_ART_PX, panelLeft, panelTop, panelW, panelH, crop)) *
      TAB_SPRITE_SCALE,
    h:
      (artSpanH(tab.artH, panelLeft, panelTop, panelW, panelH, crop) * TAB_DISPLAY_SCALE +
        artSpanH(TAB_EXTRA_H_ART_PX, panelLeft, panelTop, panelW, panelH, crop)) *
      TAB_SPRITE_SCALE *
      TAB_HEIGHT_SCALE,
  };
}

function tabGapPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop: WarehouseCoverCrop
): number {
  return artSpanW(TAB_GAP_ART_PX, panelLeft, panelTop, panelW, panelH, crop);
}

function tabRowGroupWidthPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop: WarehouseCoverCrop
): number {
  const gapPx = tabGapPx(panelLeft, panelTop, panelW, panelH, crop);
  const tabsWidth = WAREHOUSE_TAB_SPECS.reduce(
    (sum, tab) => sum + tabDisplaySizePx(panelLeft, panelTop, panelW, panelH, tab, crop).w,
    0
  );
  return tabsWidth + Math.max(0, WAREHOUSE_TAB_SPECS.length - 1) * gapPx;
}

function tabRowCenterXPx(
  panelLeft: number,
  _panelTop: number,
  panelW: number,
  _panelH: number,
  _crop: WarehouseCoverCrop
): number {
  // Match InventoryPanel.tabRowCenterXPx: geometric modal panel center.
  return panelLeft + panelW * 0.5;
}

function tabRowGroupLeftPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  crop: WarehouseCoverCrop
): number {
  return tabRowCenterXPx(panelLeft, panelTop, panelW, panelH, crop) - tabRowGroupWidthPx(panelLeft, panelTop, panelW, panelH, crop) / 2;
}

function tabRowLeftPx(
  panelLeft: number,
  panelTop: number,
  panelW: number,
  panelH: number,
  index: number,
  crop: WarehouseCoverCrop
): number {
  const gapPx = tabGapPx(panelLeft, panelTop, panelW, panelH, crop);
  let left = tabRowGroupLeftPx(panelLeft, panelTop, panelW, panelH, crop);
  for (let i = 0; i < index; i++) {
    left +=
      tabDisplaySizePx(panelLeft, panelTop, panelW, panelH, WAREHOUSE_TAB_SPECS[i], crop).w + gapPx;
  }
  return left;
}

function expectedTabListBgRect(
  layout: WarehouseGridLayout,
  panelLeft: number,
  panelTop: number
): { left: number; top: number; width: number; height: number } {
  const crop = layout.warehouseCoverCrop;
  const tabH = tabDisplaySizePx(
    panelLeft,
    panelTop,
    layout.panelW,
    layout.panelH,
    WAREHOUSE_TAB_SPECS[0],
    crop
  ).h;
  const anchor = capacityTrackAnchorRectPx(layout.panelW, layout.panelH, panelLeft, panelTop, crop);
  const minCenterY =
    anchor.top +
    anchor.height +
    artSpanH(CAPACITY_TAB_MIN_GAP_ART_PX, panelLeft, panelTop, layout.panelW, layout.panelH, crop) +
    tabH / 2;
  const artRowY = artFracToScreen(0, TAB_ROW_CENTER_Y_FRAC, panelLeft, panelTop, layout.panelW, layout.panelH, crop).y;
  const centerY = Math.max(artRowY, minCenterY) + layout.panelH * TAB_ROW_OFFSET_Y_PANEL_FRAC;
  const width = tabRowGroupWidthPx(panelLeft, panelTop, layout.panelW, layout.panelH, crop);
  const height = tabH;
  const centerX = tabRowCenterXPx(panelLeft, panelTop, layout.panelW, layout.panelH, crop);
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

function expectedTabRect(
  layout: WarehouseGridLayout,
  panelLeft: number,
  panelTop: number,
  index: number,
  tab: (typeof WAREHOUSE_TAB_SPECS)[number]
): { left: number; top: number; width: number; height: number } {
  const crop = layout.warehouseCoverCrop;
  const size = tabDisplaySizePx(panelLeft, panelTop, layout.panelW, layout.panelH, tab, crop);
  const left = tabRowLeftPx(panelLeft, panelTop, layout.panelW, layout.panelH, index, crop);
  const anchor = capacityTrackAnchorRectPx(layout.panelW, layout.panelH, panelLeft, panelTop, crop);
  const minCenterY =
    anchor.top +
    anchor.height +
    artSpanH(CAPACITY_TAB_MIN_GAP_ART_PX, panelLeft, panelTop, layout.panelW, layout.panelH, crop) +
    size.h / 2;
  const artRowY = artFracToScreen(0, TAB_ROW_CENTER_Y_FRAC, panelLeft, panelTop, layout.panelW, layout.panelH, crop).y;
  const sharedCenterY =
    Math.max(artRowY, minCenterY) + layout.panelH * TAB_ROW_OFFSET_Y_PANEL_FRAC;
  return {
    left,
    top: sharedCenterY - size.h / 2,
    width: size.w,
    height: size.h,
  };
}

function buildExpectedHeaderCells(
  layout: WarehouseGridLayout,
  panelLeft: number,
  panelTop: number
): { id: string; left: number; top: number; width: number; height: number }[] {
  const crop = layout.warehouseCoverCrop;
  const track = capacityTrackRectPx(layout.panelW, layout.panelH, panelLeft, panelTop, crop);
  const fill = capacityFillRectPx(layout.panelW, layout.panelH, panelLeft, panelTop, crop);
  const pill = capacityTextPillRectPx(layout.panelW, layout.panelH, panelLeft, panelTop, crop);

  const capacityCells = [
    { id: 'capacityTrack', ...track },
    { id: 'capacityFill', ...fill },
    { id: 'capacityTextPill', ...pill },
  ];

  const tabCells = WAREHOUSE_TAB_SPECS.map((tab, index) => ({
    id: tab.id,
    ...expectedTabRect(layout, panelLeft, panelTop, index, tab),
  }));

  return [...capacityCells, ...tabCells];
}

const TAB_TEXTURE_KEYS: Record<(typeof WAREHOUSE_TAB_SPECS)[number]['tabId'], { inactive: string; active: string }> = {
  all: { inactive: 'ui_tab_all', active: 'ui_tab_all_active' },
  resources: { inactive: 'ui_tab_resources', active: 'ui_tab_resources_active' },
  seeds: { inactive: 'ui_tab_seeds', active: 'ui_tab_seeds_active' },
  food: { inactive: 'ui_tab_food', active: 'ui_tab_food_active' },
  materials: { inactive: 'ui_tab_materials', active: 'ui_tab_materials_active' },
};

function panelOrigin(layout: WarehouseGridLayout): { left: number; top: number } {
  return { left: layout.panelLeft, top: layout.panelTop };
}

function slotRect(
  layout: WarehouseGridLayout,
  slotId: string
): { left: number; top: number; width: number; height: number; centerX: number; centerY: number } {
  const cell = layout.upgradePanelCells.find((c) => c.id === slotId);
  if (!cell) throw new Error(`missing slot ${slotId}`);
  return {
    ...cell,
    centerX: cell.left + cell.width / 2,
    centerY: cell.top + cell.height / 2,
  };
}

function pointInRect(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  tolerance = COST_POS_TOLERANCE_PX
): boolean {
  return (
    x >= rect.left - tolerance &&
    x <= rect.left + rect.width + tolerance &&
    y >= rect.top - tolerance &&
    y <= rect.top + rect.height + tolerance
  );
}

async function waitForTestApi(page: import('@playwright/test').Page) {
  await page.goto('/?debugWarehouse=1');
  await page.waitForSelector('#game-container canvas', { timeout: 30_000 });
  await page.waitForFunction(
    () => typeof window.__FARMER_WORLD_TEST__ !== 'undefined',
    undefined,
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    () => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.clickBag();
      return api?.isWarehouseOpen() === true;
    },
    undefined,
    { timeout: 30_000 }
  );
  await page.evaluate(() => window.__FARMER_WORLD_TEST__?.closeModals());
}

test.describe('Warehouse grid layout', () => {
  test('opens warehouse and exposes grid metrics aligned to art fractions', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout).not.toBeNull();

    expect(layout!.cols).toBe(WAREHOUSE_GRID_COLS);
    expect(layout!.visibleRows).toBe(WAREHOUSE_GRID_ROWS);
    expect(layout!.debugGrid).toBe(true);
    expect(layout!.modalSectionCells?.length).toBe(3);
    for (const id of ['headerSection', 'gridSection', 'bottomSection']) {
      expect(layout!.modalSectionCells.find((c) => c.id === id), `missing ${id}`).toBeDefined();
    }

    const aspect = WAREHOUSE_ART_W / WAREHOUSE_ART_H;
    expect(layout!.panelW / layout!.panelH).toBeCloseTo(aspect, 2);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const crop = layout!.warehouseCoverCrop;
    const gridBand = rectFromArtFrac(
      GRID_LEFT_FRAC,
      GRID_LEFT_FRAC + GRID_WIDTH_FRAC,
      GRID_TOP_FRAC,
      GRID_TOP_FRAC + GRID_HEIGHT_FRAC,
      panelLeft,
      panelTop,
      layout!.panelW,
      layout!.panelH,
      crop
    );
    expect(layout!.itemsListWidthScale).toBe(ITEMS_LIST_WIDTH_SCALE);
    expect(layout!.itemSlotWidthScale).toBe(ITEM_SLOT_WIDTH_SCALE);
    expect(layout!.gridViewportW).toBeCloseTo(gridBand.width * ITEMS_LIST_WIDTH_SCALE, 1);
    expect(layout!.gridViewportH).toBeCloseTo(
      gridBand.height +
        artSpanH(GRID_VIEWPORT_HEIGHT_EXTRA_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop),
      1
    );

    expect(layout!.gridContentW).toBeCloseTo(gridBand.width, 1);
    expect(layout!.gridViewportW).toBeGreaterThan(layout!.gridContentW);

    const pitchCellW = layout!.gridContentW / WAREHOUSE_GRID_COLS;
    const pitchCellH = layout!.gridViewportH / WAREHOUSE_GRID_ROWS;
    expect(layout!.cellW).toBeCloseTo(
      pitchCellW - artSpanW(CELL_SLOT_SHRINK_W_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop),
      1
    );
    expect(layout!.cellH).toBeCloseTo(
      pitchCellH + artSpanH(CELL_SLOT_HEIGHT_EXTRA_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop),
      1
    );
    expect(layout!.slotDisplayWidth).toBeCloseTo(layout!.cellW * ITEM_SLOT_WIDTH_SCALE, 1);

    const totalGridWidth = layout!.cols * layout!.cellW;
    expect(layout!.gridContentOffsetX).toBeCloseTo(
      (layout!.gridViewportW - totalGridWidth) / 2,
      1
    );

    expect(panelLeft).toBeGreaterThanOrEqual(0);
    expect(panelTop).toBeGreaterThanOrEqual(0);
    const gridBandCenterX = gridBand.left + gridBand.width / 2;
    const itemsListOffsetX = layout!.panelW * ITEMS_LIST_OFFSET_X_PANEL_FRAC;
    const itemsListOffsetY = layout!.panelH * ITEMS_LIST_OFFSET_Y_PANEL_FRAC;
    expect(layout!.gridLeft).toBeCloseTo(
      gridBandCenterX - layout!.gridViewportW / 2 + itemsListOffsetX,
      1
    );
    expect(layout!.gridTop).toBeCloseTo(
      gridBand.top +
        artFracSpanH(GRID_TOP_OFFSET_FRAC, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop) +
        itemsListOffsetY,
      1
    );

    expect(layout!.gridLeft + layout!.gridViewportW / 2).toBeCloseTo(
      gridBandCenterX + itemsListOffsetX,
      1
    );
  });

  test('scrolls when more than 12 visible slots need extra rows', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItems(20);
      api?.clickBag();
      api?.setWarehouseMinScrollRows(8);
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const before = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.scrollOffset ?? -1
    );
    expect(before).toBe(0);

    const maxScroll = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.maxScrollOffset ?? 0
    );
    expect(maxScroll).toBeGreaterThan(0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.warehouseScrollBy(400));

    const after = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.scrollOffset ?? 0
    );
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(maxScroll);

    const slotCount = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout()?.slotCount ?? 0
    );
    expect(slotCount).toBeGreaterThan(0);
  });

  test('upgrade panel cells align to footer col3 layout', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.upgradePanelCells?.length).toBe(UPGRADE_PANEL_CELLS.length);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const row = sellFooterRowRectPx(panelLeft, panelTop, layout!.panelW, layout!.panelH);

    expect(layout!.sellFooterRow).toBeDefined();
    expect(layout!.sellFooterRow.width).toBeCloseTo(layout!.panelW * SELL_FOOTER_ROW_WIDTH_FRAC, 0);
    expect(layout!.sellFooterRow.left).toBeCloseTo(panelLeft + layout!.panelW * SELL_FOOTER_ROW_LEFT_FRAC, 0);
    expect(layout!.sellFooterRow.left + layout!.sellFooterRow.width / 2).toBeCloseTo(row.centerX, 0);

    expect(layout!.sellFooterCols?.length).toBe(3);
    for (const col of [1, 2, 3] as const) {
      const expCol = sellFooterColRectPx(row, col);
      const actual = layout!.sellFooterCols.find((c) => c.id === `col${col}`);
      expect(actual, `missing col${col}`).toBeDefined();
      expect(actual!.left).toBeCloseTo(expCol.left, 0);
      expect(actual!.top).toBeCloseTo(expCol.top, 0);
      expect(actual!.width).toBeCloseTo(expCol.width, 0);
      expect(actual!.height).toBeCloseTo(expCol.height, 0);
    }

    for (const expected of UPGRADE_PANEL_CELLS) {
      const actual = layout!.upgradePanelCells.find((c) => c.id === expected.id);
      expect(actual, `missing upgrade cell ${expected.id}`).toBeDefined();

      const local = artRectToCol3Local(expected.x0, expected.x1, expected.y0, expected.y1);
      const expRect = sellFooterColCellRectPx(row, 3, local);
      let expLeft = expRect.left;
      const expTop = expRect.top;
      let expW = expRect.width;
      const expH = expRect.height;
      if (expected.id === 'coinSlot') {
        const expand = artSpanW(
          UPGRADE_COIN_SLOT_EXPAND_LEFT_PX,
          panelLeft,
          panelTop,
          layout!.panelW,
          layout!.panelH,
          layout!.warehouseCoverCrop
        );
        expLeft -= expand;
        expW += expand;
      }

      expect(actual!.left).toBeCloseTo(expLeft, 0);
      expect(actual!.top).toBeCloseTo(expTop, 0);
      expect(actual!.width).toBeCloseTo(expW, 0);
      expect(actual!.height).toBeCloseTo(expH, 0);
    }
  });

  test('upgrade cost texts sit in correct slots and match upgrade cost', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const cost = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseUpgradeCost());
    expect(cost).toEqual(EXPECTED_UPGRADE_COST);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.upgradeCostTexts?.length).toBe(3);

    const slots = Object.fromEntries(
      COST_SLOT_IDS.map((id) => [id, slotRect(layout!, id)])
    ) as Record<(typeof COST_SLOT_IDS)[number], ReturnType<typeof slotRect>>;

    for (const costText of layout!.upgradeCostTexts) {
      const own = slots[costText.slotId as (typeof COST_SLOT_IDS)[number]];
      expect(own, `missing slot ${costText.slotId}`).toBeDefined();
      expect(
        pointInRect(costText.x, costText.y, own),
        `${costText.id} at (${costText.x},${costText.y}) outside ${costText.slotId}`
      ).toBe(true);
      expect(costText.x).toBeCloseTo(own.centerX, 0);
      expect(costText.y).toBeCloseTo(own.centerY, 0);

      for (const otherId of COST_SLOT_IDS) {
        if (otherId === costText.slotId) continue;
        const other = slots[otherId];
        expect(
          pointInRect(costText.x, costText.y, other, 0),
          `${costText.id} overlaps ${otherId}`
        ).toBe(false);
      }
    }

    const coin = layout!.upgradeCostTexts.find((c) => c.id === 'coin');
    const wood = layout!.upgradeCostTexts.find((c) => c.id === 'wood');
    const stone = layout!.upgradeCostTexts.find((c) => c.id === 'stone');
    expect(coin?.text).toBe(String(EXPECTED_UPGRADE_COST.coins));
    expect(wood?.text).toBe(String(EXPECTED_UPGRADE_COST.wood));
    expect(stone?.text).toBe(String(EXPECTED_UPGRADE_COST.stone));

    expect(coin!.x).toBeLessThan(slots.woodSlot.left);
    expect(wood!.x).toBeGreaterThan(slots.coinSlot.left + slots.coinSlot.width);
    expect(wood!.x).toBeLessThan(slots.stoneSlot.left);
    expect(stone!.x).toBeGreaterThan(slots.woodSlot.left + slots.woodSlot.width);
  });

  test('close button hit zone aligns to art and closes warehouse', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.closeHit).toBeDefined();

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const expRadius = layout!.panelW * (CLOSE_BTN_RADIUS_ART_PX / WAREHOUSE_ART_W);
    const expCenterX = panelLeft + layout!.panelW * (1 - CLOSE_RIGHT_FRAC);
    const expCenterY = panelTop + layout!.panelH * CLOSE_TOP_FRAC + expRadius;

    expect(layout!.closeHit.centerX).toBeCloseTo(expCenterX, 0);
    expect(layout!.closeHit.centerY).toBeCloseTo(expCenterY, 0);
    expect(layout!.closeHit.radius).toBeCloseTo(expRadius, 0);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(false);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseClose());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(false);
  });

  test('warehouse header cells align to art fractions', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.headerCells?.length).toBe(3 + WAREHOUSE_TAB_SPECS.length);

    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const crop = layout!.warehouseCoverCrop;
    const expectedHeaderCells = buildExpectedHeaderCells(layout!, panelLeft, panelTop);

    for (const expected of expectedHeaderCells) {
      const actual = layout!.headerCells.find((c) => c.id === expected.id);
      expect(actual, `missing header cell ${expected.id}`).toBeDefined();

      expect(Math.abs(actual!.left - expected.left)).toBeLessThan(2);
      expect(Math.abs(actual!.top - expected.top)).toBeLessThan(2);
      expect(Math.abs(actual!.width - expected.width)).toBeLessThan(2);
      expect(Math.abs(actual!.height - expected.height)).toBeLessThan(2);
    }

    const trackCell = layout!.headerCells.find((c) => c.id === 'capacityTrack');
    const processBg = capacityProcessBgRectPx(
      layout!.panelW,
      layout!.panelH,
      panelLeft,
      panelTop,
      crop
    );
    expect(trackCell).toBeDefined();
    expect(trackCell!.width).toBeCloseTo(processBg.width * PROCESS_INNER_WIDTH_FRAC, 0);
    expect(trackCell!.left + trackCell!.width / 2).toBeCloseTo(
      processBg.left + processBg.width / 2,
      0
    );

    for (const tab of WAREHOUSE_TAB_SPECS) {
      const wFrac = (tab.artW / WAREHOUSE_ART_W) * TAB_DISPLAY_SCALE;
      expect(wFrac).toBeGreaterThan(0.08);
      expect(wFrac).toBeLessThan(0.095);
    }

    WAREHOUSE_TAB_SPECS.forEach((tab, index) => {
      const cell = layout!.headerCells.find((c) => c.id === tab.id);
      expect(cell, `missing tab cell ${tab.id}`).toBeDefined();
      const exp = expectedTabRect(layout!, panelLeft, panelTop, index, tab);
      const expCenterX = exp.left + exp.width / 2;
      const actualCenterX = cell!.left + cell!.width / 2;
      expect(actualCenterX).toBeCloseTo(expCenterX, 0);
    });

    const tabCells = WAREHOUSE_TAB_SPECS.map((tab) => layout!.headerCells.find((c) => c.id === tab.id)!);
    const tabGroupLeft = Math.min(...tabCells.map((c) => c.left));
    const tabGroupRight = Math.max(...tabCells.map((c) => c.left + c.width));
    const tabGroupCenterX = (tabGroupLeft + tabGroupRight) / 2;
    const panelScreenCenterX = panelLeft + layout!.panelW / 2;
    const tabRowScreenCenterX = tabRowCenterXPx(
      panelLeft,
      panelTop,
      layout!.panelW,
      layout!.panelH,
      crop
    );
    const tabRailLeftX = artFracToScreen(TAB_ROW_LEFT_FRAC, 0, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop).x;
    const tabRailRightX = artFracToScreen(TAB_ROW_RIGHT_FRAC, 0, panelLeft, panelTop, layout!.panelW, layout!.panelH, crop).x;
    const tabRailCenterX = (tabRailLeftX + tabRailRightX) / 2;

    expect(Math.abs(tabGroupCenterX - tabRowScreenCenterX)).toBeLessThanOrEqual(
      TAB_GROUP_CENTER_TOLERANCE_PX
    );
    expect(Math.abs(tabGroupCenterX - panelScreenCenterX)).toBeLessThanOrEqual(
      TAB_GROUP_CENTER_TOLERANCE_PX
    );
    // Baked rail art center (~0.594) differs from modal panel center (~0.5).
    expect(Math.abs(tabGroupCenterX - tabRailCenterX)).toBeGreaterThan(
      TAB_GROUP_CENTER_TOLERANCE_PX
    );

    expect(layout!.tabListBg?.textureKey).toBe('ui_warehouse_tablist_bg');
    const expTabListBg = expectedTabListBgRect(layout!, panelLeft, panelTop);
    expect(Math.abs(layout!.tabListBg.left - expTabListBg.left)).toBeLessThan(2);
    expect(Math.abs(layout!.tabListBg.top - expTabListBg.top)).toBeLessThan(2);
    expect(Math.abs(layout!.tabListBg.width - expTabListBg.width)).toBeLessThan(2);
    expect(Math.abs(layout!.tabListBg.height - expTabListBg.height)).toBeLessThan(2);
    const tabListBgCenterX = layout!.tabListBg.left + layout!.tabListBg.width / 2;
    expect(Math.abs(tabListBgCenterX - tabGroupCenterX)).toBeLessThanOrEqual(
      TAB_GROUP_CENTER_TOLERANCE_PX
    );
    expect(Math.abs(tabListBgCenterX - tabRowScreenCenterX)).toBeLessThanOrEqual(
      TAB_GROUP_CENTER_TOLERANCE_PX
    );
  });

  test('tab sprites align to header cells and tab click switches texture', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layoutBefore = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layoutBefore?.tabSprites?.length).toBe(WAREHOUSE_TAB_SPECS.length);

    for (const sprite of layoutBefore!.tabSprites) {
      const cell = layoutBefore!.headerCells.find((c) => c.id === sprite.cellId);
      expect(cell, `missing header cell for ${sprite.id}`).toBeDefined();
      expect(sprite.left).toBeCloseTo(cell!.left, 0);
      expect(sprite.top).toBeCloseTo(cell!.top, 0);
      expect(sprite.width).toBeCloseTo(cell!.width, 0);
      expect(sprite.height).toBeCloseTo(cell!.height, 0);
      const tabWFrac = sprite.width / layoutBefore!.panelW;
      const tabCrop = layoutBefore!.warehouseCoverCrop;
      const maxTabW =
        Math.max(
          ...WAREHOUSE_TAB_SPECS.map((t) =>
            tabDisplaySizePx(
              layoutBefore!.panelLeft,
              layoutBefore!.panelTop,
              layoutBefore!.panelW,
              layoutBefore!.panelH,
              t,
              tabCrop
            ).w
          )
        );
      const minTabW =
        Math.min(
          ...WAREHOUSE_TAB_SPECS.map((t) =>
            tabDisplaySizePx(
              layoutBefore!.panelLeft,
              layoutBefore!.panelTop,
              layoutBefore!.panelW,
              layoutBefore!.panelH,
              t,
              tabCrop
            ).w
          )
        );
      expect(sprite.width).toBeGreaterThan(minTabW * 0.98);
      expect(sprite.width).toBeLessThan(maxTabW * 1.02);
    }

    expect(layoutBefore!.activeTab).toBe('all');
    const allSprite = layoutBefore!.tabSprites.find((s) => s.id === 'all');
    expect(allSprite?.textureKey).toBe(TAB_TEXTURE_KEYS.all.active);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseTab('seeds'));

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseActiveTab()))
      .toBe('seeds');

    const layoutAfter = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    const seedsSprite = layoutAfter!.tabSprites.find((s) => s.id === 'seeds');
    const allAfter = layoutAfter!.tabSprites.find((s) => s.id === 'all');
    expect(seedsSprite?.textureKey).toBe(TAB_TEXTURE_KEYS.seeds.active);
    expect(seedsSprite?.active).toBe(true);
    expect(allAfter?.textureKey).toBe(TAB_TEXTURE_KEYS.all.inactive);
    expect(allAfter?.active).toBe(false);

    for (const sprite of layoutAfter!.tabSprites) {
      expect(sprite.displayWidth).toBeCloseTo(sprite.width, 0);
      expect(sprite.displayHeight).toBeCloseTo(sprite.height, 0);
    }
  });

  test('tab display size stays equal when toggling active/inactive', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickBag());
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const tabIds = WAREHOUSE_TAB_SPECS.map((t) => t.tabId);
    const sizesByTab: Record<string, { w: number; h: number }> = {};

    for (const tabId of tabIds) {
      await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.clickWarehouseTab(id), tabId);
      await expect
        .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseActiveTab()))
        .toBe(tabId);

      const layout = await page.evaluate(
        () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
      );
      const activeSprite = layout!.tabSprites.find((s) => s.id === tabId);
      expect(activeSprite).toBeDefined();
      sizesByTab[tabId] = {
        w: activeSprite!.displayWidth,
        h: activeSprite!.displayHeight,
      };

      for (const sprite of layout!.tabSprites) {
        expect(sprite.displayWidth).toBeCloseTo(sprite.width, 0);
        expect(sprite.displayHeight).toBeCloseTo(sprite.height, 0);
      }
    }

    // Click back through tabs and verify inactive sprites keep the same display size.
    for (const tabId of tabIds) {
      const otherTab = tabIds.find((id) => id !== tabId)!;
      await page.evaluate((id) => window.__FARMER_WORLD_TEST__?.clickWarehouseTab(id), otherTab);
      await expect
        .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseActiveTab()))
        .toBe(otherTab);

      const layout = await page.evaluate(
        () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
      );
      const inactiveSprite = layout!.tabSprites.find((s) => s.id === tabId);
      expect(inactiveSprite?.textureKey).toBe(TAB_TEXTURE_KEYS[tabId as keyof typeof TAB_TEXTURE_KEYS].inactive);
      expect(inactiveSprite!.displayWidth).toBeCloseTo(sizesByTab[tabId].w, 0);
      expect(inactiveSprite!.displayHeight).toBeCloseTo(sizesByTab[tabId].h, 0);
    }
  });

  test('capacity fill ratio matches warehouse usage', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItems(5);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    const ratio = await page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseCapacityFillRatio());

    expect(ratio).not.toBeNull();
    expect(layout?.capacityFillRatio).toBeCloseTo(ratio!, 4);
    expect(ratio!).toBeGreaterThan(0);
    expect(ratio!).toBeLessThanOrEqual(1);

    const fillCell = layout!.headerCells.find((c) => c.id === 'capacityFill');
    expect(fillCell).toBeDefined();
    const trackCell = layout!.headerCells.find((c) => c.id === 'capacityTrack');
    expect(trackCell).toBeDefined();
    const { left: panelLeft, top: panelTop } = panelOrigin(layout!);
    const expectedInset =
      artSpanW(CAPACITY_FILL_OFFSET_ART_PX, panelLeft, panelTop, layout!.panelW, layout!.panelH, layout!.warehouseCoverCrop) +
      layout!.panelW * CAPACITY_FILL_OFFSET_X_PANEL_FRAC;
    expect(fillCell!.left - trackCell!.left).toBeGreaterThan(expectedInset - 2);
    expect(fillCell!.left).toBeGreaterThan(trackCell!.left + 1);
    expect(fillCell!.top).toBeGreaterThanOrEqual(trackCell!.top);
    expect(fillCell!.top + fillCell!.height).toBeLessThanOrEqual(trackCell!.top + trackCell!.height + 2);

    const pillCell = layout!.headerCells.find((c) => c.id === 'capacityTextPill');
    expect(pillCell).toBeDefined();
    const pillCenterX = pillCell!.left + pillCell!.width / 2;
    const pillCenterY = pillCell!.top + pillCell!.height / 2;
    expect(layout!.capacityText.originX).toBeCloseTo(0.5, 4);
    expect(layout!.capacityText.originY).toBeCloseTo(0.5, 4);
    expect(layout!.capacityText.x).toBeCloseTo(
      pillCenterX +
        artSpanW(CAPACITY_TEXT_OFFSET_X, panelLeft, panelTop, layout!.panelW, layout!.panelH, layout!.warehouseCoverCrop),
      0
    );
    expect(layout!.capacityText.y).toBeCloseTo(
      pillCenterY + layout!.panelH * CAPACITY_TEXT_OFFSET_Y_PANEL_FRAC,
      0
    );
  });

  test('sell qty minus/plus and set quantity API', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseSellable(8);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    const layout = await page.evaluate(
      () => window.__FARMER_WORLD_TEST__?.getWarehouseGridLayout() as WarehouseGridLayout | null
    );
    expect(layout?.sellControlsCells?.some((c) => c.id === 'qtyPlus')).toBe(true);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseSellControl('qtyPlus'));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(2);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.clickWarehouseSellControl('qtyMinus'));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(1);

    await page.evaluate(() => window.__FARMER_WORLD_TEST__?.setWarehouseSellQuantity(5));
    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellQuantity()))
      .toBe(5);
  });

  test('selecting seed or food shows sell footer name and owned', async ({ page }) => {
    await waitForTestApi(page);
    await page.evaluate(() => {
      const api = window.__FARMER_WORLD_TEST__;
      api?.seedWarehouseItem('wheat_seed', 3);
      api?.seedWarehouseItem('candy', 2);
      api?.clickBag();
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.isWarehouseOpen()))
      .toBe(true);

    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickWarehouseTab('seeds');
      window.__FARMER_WORLD_TEST__?.selectWarehouseItem('wheat_seed');
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.name))
      .toBe('WHEAT SEEDS');

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.owned ?? 0))
      .toBeGreaterThanOrEqual(3);

    await page.evaluate(() => {
      window.__FARMER_WORLD_TEST__?.clickWarehouseTab('food');
      window.__FARMER_WORLD_TEST__?.selectWarehouseItem('candy');
    });

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.name))
      .toBe('CANDY');

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.owned ?? 0))
      .toBeGreaterThanOrEqual(2);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.sellable))
      .toBe(false);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.useVisible))
      .toBe(true);

    await expect
      .poll(() => page.evaluate(() => window.__FARMER_WORLD_TEST__?.getWarehouseSellFooter()?.useLabel))
      .toBe('USE');
  });
});

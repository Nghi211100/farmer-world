/**
 * Orthographic 2:1 isometric tiles (classic diamond rhombus).
 * Projection: screenX = (x - y) * tileW/2, screenY = (x + y) * tileH/2
 * gridToScreen / cartToIso return the **top vertex** of each diamond.
 */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_ASPECT = TILE_WIDTH / TILE_HEIGHT;

/** Origin for ground tile sprites: anchor at diamond top vertex */
export const ISO_TILE_ORIGIN = { x: 0.5, y: 0 } as const;

/** Origin for crop sprites: bottom edge at diamond bottom vertex */
export const ISO_CROP_ORIGIN = { x: 0.5, y: 1 } as const;

/** Farmer sprite scale vs legacy size (1.5× smaller on screen) */
export const PLAYER_DISPLAY_SCALE = 1 / 1.5;

/** Enlarge water ground sprites so adjacent iso diamonds overlap (hides seam lines). */
export const WATER_GROUND_DISPLAY_SCALE = 1.27;

/**
 * Default overlap for grass, path, and farm soil ground tiles (hides dark diamond gaps).
 * Applied to the full farm map ground layer; water uses {@link WATER_GROUND_DISPLAY_SCALE}.
 */
export const GROUND_TILE_SEAM_SCALE = 1.15;

/** @deprecated Use {@link GROUND_TILE_SEAM_SCALE}; kept for farm-island / water max(). */
export const FARM_SOIL_GROUND_DISPLAY_SCALE = GROUND_TILE_SEAM_SCALE;

/** Extra scale on north path ring + first soil row so tiles cover island cliff art at the apex. */
export const FARM_NORTH_EDGE_GROUND_SCALE = 1.42;

/**
 * `water_2_borders_top` only — width footprint (horizontal diamond span).
 * Larger than WATER_GROUND_DISPLAY_SCALE.
 */
export const WATER_TOP_BORDER_SIZE_SCALE = 1.29;

/**
 * `water_2_borders_top` only — vertical diamond squeeze (méo).
 * Applied to tile height independently of SIZE_SCALE.
 */
export const WATER_TOP_BORDER_MEO_SCALE = 1.3;
export const WATER_BOTTOM_BORDER_SIZE_SCALE = WATER_TOP_BORDER_SIZE_SCALE;
export const WATER_BOTTOM_BORDER_MEO_SCALE = WATER_TOP_BORDER_MEO_SCALE;

/** Walk-to / farm-tap destination pin (ui/coming.png is high-res; always scale down). */
export const MOVE_DESTINATION_MARKER_MAX_PX = TILE_WIDTH * 0.55;

/**
 * Fraction from diamond bottom toward center for walk destination pin anchor (origin 0.5, 1).
 * 0 = feet at bottom vertex; 1 = feet at geometric center.
 */
export const MOVE_DESTINATION_MARKER_TILE_LIFT = 0.3;

/** Pin anchor between tile bottom and center (see {@link MOVE_DESTINATION_MARKER_TILE_LIFT}). */
export function moveDestinationMarkerPositionFromTop(top: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const bottom = tileBottomFromTop(top);
  const center = tileCenterFromTop(top);
  const t = MOVE_DESTINATION_MARKER_TILE_LIFT;
  return {
    x: bottom.x + (center.x - bottom.x) * t,
    y: bottom.y + (center.y - bottom.y) * t,
  };
}

/** Target on-screen sizes (tiles/crops use exact diamond footprint; others may aspect-fit) */
export const DISPLAY_SIZE = {
  tileW: TILE_WIDTH,
  tileH: TILE_HEIGHT,
  playerW: 52 * PLAYER_DISPLAY_SCALE,
  playerH: 72 * PLAYER_DISPLAY_SCALE,
  treeH: 56,
  rockH: 28,
  buildingH: 64,
} as const;

/** Map nature decorations (trees, rocks, bushes) — applied in Decoration.ts only */
export const NATURE_DISPLAY_SCALE = 1.75;

/** Scale sprite to fit within max width/height while preserving aspect ratio */
export function fitSpriteDisplay(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  maxW: number,
  maxH: number
): void {
  const frame = sprite.frame;
  const tw = frame.width;
  const th = frame.height;
  if (tw <= 0 || th <= 0) return;
  const scale = Math.min(maxW / tw, maxH / th);
  sprite.setDisplaySize(tw * scale, th * scale);
}

/** Apply standard isometric ground-tile anchor; stretch to 64×32 diamond cell (optional scale). */
export function applyIsoTileSprite(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  displayScale = 1
): void {
  if ('resetCrop' in sprite && typeof sprite.resetCrop === 'function') {
    sprite.resetCrop();
  }
  sprite.setOrigin(ISO_TILE_ORIGIN.x, ISO_TILE_ORIGIN.y);
  sprite.setDisplaySize(TILE_WIDTH * displayScale, TILE_HEIGHT * displayScale);
}

/**
 * `water_2_borders_top` at diamond top: width uses SIZE_SCALE, height uses MEO_SCALE
 * (méo = vertical squeeze; size = overall width footprint).
 */
export function applyIsoTopBorderWaterSprite(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
): void {
  if ('resetCrop' in sprite && typeof sprite.resetCrop === 'function') {
    sprite.resetCrop();
  }
  sprite.setOrigin(ISO_TILE_ORIGIN.x, ISO_TILE_ORIGIN.y);
  sprite.setDisplaySize(
    TILE_WIDTH * WATER_TOP_BORDER_SIZE_SCALE,
    TILE_HEIGHT * WATER_TOP_BORDER_MEO_SCALE
  );
}

/** `water_2_borders_bottom` mirrors top-border size/méo footprint. */
export function applyIsoBottomBorderWaterSprite(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
): void {
  if ('resetCrop' in sprite && typeof sprite.resetCrop === 'function') {
    sprite.resetCrop();
  }
  sprite.setOrigin(ISO_TILE_ORIGIN.x, ISO_TILE_ORIGIN.y);
  sprite.setDisplaySize(
    TILE_WIDTH * WATER_BOTTOM_BORDER_SIZE_SCALE,
    TILE_HEIGHT * WATER_BOTTOM_BORDER_MEO_SCALE
  );
}

/** Ground tile at diamond top vertex; fit within 64×32 without non-uniform stretch (optional scale). */
export function applyIsoTileSpriteAspectFit(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  displayScale = 1
): void {
  if ('resetCrop' in sprite && typeof sprite.resetCrop === 'function') {
    sprite.resetCrop();
  }
  sprite.setOrigin(ISO_TILE_ORIGIN.x, ISO_TILE_ORIGIN.y);
  fitSpriteDisplay(sprite, TILE_WIDTH * displayScale, TILE_HEIGHT * displayScale);
}

/** Center of diamond from its top vertex (cartToIso / gridToScreen point) */
export function tileCenterFromTop(top: { x: number; y: number }): { x: number; y: number } {
  return { x: top.x, y: top.y + TILE_HEIGHT / 2 };
}

/** Diamond center in grid space (cell center, not bottom vertex) */
export function tileCenterFromGrid(
  cartX: number,
  cartY: number,
  originX = 0,
  originY = 0
): { x: number; y: number } {
  return cartToIso(cartX + 0.5, cartY + 0.5, originX, originY);
}

/** Player feet anchor: diamond center from top vertex. Never use tile bottom. */
export function playerTilePositionFromTop(top: { x: number; y: number }): { x: number; y: number } {
  return tileCenterFromTop(top);
}

/** Bottom vertex of diamond from its top vertex */
export function tileBottomFromTop(top: { x: number; y: number }): { x: number; y: number } {
  return { x: top.x, y: top.y + TILE_HEIGHT };
}

/** Trace a 2:1 diamond path from its top vertex */
function traceIsoDiamondPath(graphics: Phaser.GameObjects.Graphics, topX: number, topY: number): void {
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  graphics.beginPath();
  graphics.moveTo(topX, topY);
  graphics.lineTo(topX + hw, topY + hh);
  graphics.lineTo(topX, topY + TILE_HEIGHT);
  graphics.lineTo(topX - hw, topY + hh);
  graphics.closePath();
}

/** Filled 2:1 isometric ground diamond (top vertex anchor). */
export function fillIsoTileDiamond(
  graphics: Phaser.GameObjects.Graphics,
  topX: number,
  topY: number,
  color = 0xffffff,
  alpha = 1
): void {
  graphics.fillStyle(color, alpha);
  traceIsoDiamondPath(graphics, topX, topY);
  graphics.fillPath();
}

/** Draw a 2:1 diamond outline for debug verification (all tiles) */
export function drawIsoTileDebug(
  graphics: Phaser.GameObjects.Graphics,
  topX: number,
  topY: number,
  color = 0x00ff88,
  alpha = 0.85
): void {
  graphics.lineStyle(1, color, alpha);
  traceIsoDiamondPath(graphics, topX, topY);
  graphics.strokePath();
}

/** Red semi-transparent fill + stroke for last pointer pick (click debug) */
export function drawIsoTileClickPick(
  graphics: Phaser.GameObjects.Graphics,
  topX: number,
  topY: number,
  color = 0xff2222,
  fillAlpha = 0.45,
  strokeAlpha = 1
): void {
  graphics.fillStyle(color, fillAlpha);
  traceIsoDiamondPath(graphics, topX, topY);
  graphics.fillPath();
  graphics.lineStyle(2, color, strokeAlpha);
  traceIsoDiamondPath(graphics, topX, topY);
  graphics.strokePath();
}

/** Convert cartesian grid coordinates to isometric screen position (diamond top vertex) */
export function cartToIso(cartX: number, cartY: number, originX = 0, originY = 0): { x: number; y: number } {
  const x = (cartX - cartY) * (TILE_WIDTH / 2) + originX;
  const y = (cartX + cartY) * (TILE_HEIGHT / 2) + originY;
  return { x, y };
}

/** Convert isometric screen position to cartesian grid coordinates */
export function isoToCart(isoX: number, isoY: number, originX = 0, originY = 0): { x: number; y: number } {
  const relX = isoX - originX;
  const relY = isoY - originY;
  const cartX = (relX / (TILE_WIDTH / 2) + relY / (TILE_HEIGHT / 2)) / 2;
  const cartY = (relY / (TILE_HEIGHT / 2) - relX / (TILE_WIDTH / 2)) / 2;
  return { x: cartX, y: cartY };
}

/** Snap cartesian coords to nearest grid cell */
export function snapToGrid(cartX: number, cartY: number): { x: number; y: number } {
  return { x: Math.round(cartX), y: Math.round(cartY) };
}

/**
 * Point-in-rhombus test aligned with ground tiles (top vertex anchor, 64×32 diamond).
 */
export function pointInIsoDiamond(
  worldX: number,
  worldY: number,
  gx: number,
  gy: number,
  originX = 0,
  originY = 0
): boolean {
  const top = cartToIso(gx, gy, originX, originY);
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  const relX = worldX - top.x;
  const relY = worldY - top.y;
  if (relY < 0 || relY > TILE_HEIGHT) return false;
  const maxAbsX = hw * (1 - Math.abs(relY - hh) / hh);
  return Math.abs(relX) <= maxAbsX + 1e-4;
}

/**
 * Pick the grid cell whose rendered diamond contains the world point.
 * When edges overlap, prefers the visually front tile (higher gx + gy).
 */
export function pickIsoTileAt(
  worldX: number,
  worldY: number,
  originX: number,
  originY: number,
  gridSize: number,
  inBounds: (gx: number, gy: number) => boolean
): { x: number; y: number } {
  const approx = isoToCart(worldX, worldY, originX, originY);
  const cx = Math.floor(approx.x);
  const cy = Math.floor(approx.y);

  let best: { x: number; y: number; depth: number } | null = null;
  for (let gy = cy - 2; gy <= cy + 2; gy++) {
    for (let gx = cx - 2; gx <= cx + 2; gx++) {
      if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) continue;
      if (!inBounds(gx, gy)) continue;
      if (!pointInIsoDiamond(worldX, worldY, gx, gy, originX, originY)) continue;
      const depth = gx + gy;
      if (!best || depth > best.depth) {
        best = { x: gx, y: gy, depth };
      }
    }
  }

  if (best) return { x: best.x, y: best.y };
  return snapToGrid(approx.x, approx.y);
}

/**
 * Depth for isometric Y-sort: higher (gx + gy) draws in front (closer to camera).
 * Layer offset is a small tie-breaker when gx+gy matches (e.g. nature > player on same tile).
 */
export function isoDepth(cartX: number, cartY: number, layer = 0): number {
  return (cartX + cartY) * 10 + layer;
}

/** Format growth countdown as hh:mm:ss */
export function formatGrowthTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import {
  applyIsoBottomBorderWaterSprite,
  applyIsoFaceToFaceWaterSprite,
  applyIsoTileSprite,
  applyIsoTopBorderWaterSprite,
  applyIsoWater1BorderSprite,
  applyIsoWater2BordersLeftRightSprite,
  getWater2BordersTopBottomDisplayOffset,
  getWater1BorderDisplayOffset,
  isWater1BorderTextureKey,
  GROUND_TILE_SEAM_SCALE,
  isWater2BordersLeftRightTextureKey,
  isWaterFaceToFaceTextureKey,
  TILE_HEIGHT,
  TILE_WIDTH,
  WATER_1_BORDER_DISPLAY_SCALE,
  WATER_FLAT_DISPLAY_SCALE,
  WATER_GROUND_DISPLAY_SCALE,
} from './iso';

/**
 * Water shore autotiling for 2:1 isometric diamonds on a square grid.
 *
 * Each diamond has four slant edges (asset names use screen corners):
 *   TL (top-left slant)     — bit T = 8
 *   TR (top-right slant)    — bit R = 4
 *   BR (bottom-right slant) — bit B = 2
 *   BL (bottom-left slant)  — bit L = 1
 *
 * Bit set = draw shore on that slant; no connecting water on that edge.
 *
 * Neighbor checks use the four cardinal grid cells (same as path ring), plus
 * diagonal corner fills when both adjacent cardinals are water/bridge but the
 * diagonal cell is placed land (grass, path, soil — not void or bridge):
 *   top    (gx, gy - 1)
 *   right  (gx + 1, gy)
 *   bottom (gx, gy + 1)
 *   left   (gx - 1, gy)
 *
 * Diagonal insets (both cardinals water, diagonal is placed land):
 *   NW → TL (8)   NE → TR (4)   SW → BL (1)   SE → BR (2)
 *
 * Iso view inverts screen vs grid north/south and east/west, so each slant bit
 * is driven by the opposite cardinal (south → TL, north → BR, west → TR, east → BL).
 *
 * Out-of-map probes return false (land) so the map rim gets shores.
 *
 * Asset mapping (mask → texture key):
 * | Mask | Open slants (water) | Borders        | Asset key |
 * |------|---------------------|----------------|-----------|
 * | 0    | all four            | none           | water |
 * | 8    | TR, BR, BL          | TL             | water_1_border_bottom-left * |
 * | 4    | TL, BR, BL          | TR             | water_1_border_top-left * |
 * | 2    | TL, TR, BL          | BR             | water_1_border_top-right |
 * | 1    | TL, TR, BR          | BL             | water_1_border_bottom-right |
 * | 12   | BL, BR              | TL + TR        | water_2_borders_top → `water_2_borders_left` * |
 * | 9    | TR, BR              | TL + BL        | water_2_borders_right |
 * | 6    | TL, BL              | TR + BR        | water_2_borders_left |
 * | 3    | TL, TR              | BL + BR        | water_2_borders_bottom |
 * | 10   | TR, BL              | TL + BR        | water_2_borders_face_to_face_right |
 * | 5    | TL, BR              | TR + BL        | water_2_borders_face_to_face_left |
 * | 7    | TL                  | TR + BR + BL   | water_3_border_left_top → `water_3_border_right_top` * |
 * | 11   | TR                  | TL + BR + BL   | water_3_border_right_top → `water_3_border_right_bottom` * |
 * | 13   | BR                  | TL + TR + BL   | water_3_border_right_bottom → `water_3_border_left_bottom` * |
 * | 14   | BL                  | TL + TR + BR   | water_3_border_left_bottom → `water_3_border_left_top` * |
 * | 15   | none                | all four       | water (isolated pond) |
 *
 * * `water_1_border_top-left` art is the screen top-left shore (grid west neighbor).
 *   Mask 12 (grid west + south land, water on north + east) uses the two-border
 *   left shore after iso key remap (see `remapWater2BorderTextureKey`).
 *
 * One-border keys rotate clockwise in iso view via `remapWater1BorderTextureKey`
 * (bottom-left→bottom-right→top-right→top→…), matching screen corner names to
 * grid cardinals (west→top-left, north→top-right, east→bottom-right, south→bottom-left).
 *
 * Two-border texture keys are rotated in `waterTextureKeyFromMask` to match iso
 * art orientation: left→top, bottom→right, right→bottom, top→left.
 *
 * Three-border corner keys rotate clockwise in iso view via
 * `remapWater3BorderTextureKey` (left_top→right_top→right_bottom→left_bottom→…),
 * applied in `waterTextureKeyFromMask` after the two- and one-border remaps.
 */

export const WATER_EDGE_TOP = 8;
export const WATER_EDGE_RIGHT = 4;
export const WATER_EDGE_BOTTOM = 2;
export const WATER_EDGE_LEFT = 1;

export type WaterEdgeMask = number;

export type WaterNeighborProbe = (gx: number, gy: number) => boolean;

export type WaterAutotileCell = {
  type: string;
  pathVariant?: string;
} | null | undefined;

/** True when a cell connects like water for shore autotile (includes bridge path). */
export function cellCountsAsWaterForAutotile(cell: WaterAutotileCell): boolean {
  if (!cell) return false;
  if (cell.type === 'water') return true;
  return cell.type === 'path' && cell.pathVariant === 'bridge_tile';
}

/** Placed decor land that should trigger a diagonal inset shore (grass / path bank). */
export function cellCountsAsLandForWaterDiagonalShore(cell: WaterAutotileCell): boolean {
  if (!cell) return false;
  if (cell.type === 'grass') return true;
  return cell.type === 'path' && cell.pathVariant !== 'bridge_tile';
}

export type WaterDiagonalContext = {
  inBounds: (gx: number, gy: number) => boolean;
  getCell: (gx: number, gy: number) => WaterAutotileCell;
};

function isDiagonalLandShore(
  gx: number,
  gy: number,
  ctx: WaterDiagonalContext
): boolean {
  if (!ctx.inBounds(gx, gy)) return false;
  return cellCountsAsLandForWaterDiagonalShore(ctx.getCell(gx, gy));
}

function isBridgeTileCell(cell: WaterAutotileCell): boolean {
  return cell?.type === 'path' && cell.pathVariant === 'bridge_tile';
}

function applyDiagonalCornerBits(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe,
  mask: WaterEdgeMask,
  ctx: WaterDiagonalContext
): WaterEdgeMask {
  if (mask !== 0) return mask;

  const cardinalCell = (x: number, y: number): WaterAutotileCell => {
    if (!ctx.inBounds(x, y)) return null;
    return ctx.getCell(x, y);
  };

  const tryInset = (
    cornerX: number,
    cornerY: number,
    flankAX: number,
    flankAY: number,
    flankBX: number,
    flankBY: number,
    bit: WaterEdgeMask
  ): void => {
    if (!isWaterNeighbor(flankAX, flankAY, probe)) return;
    if (!isWaterNeighbor(flankBX, flankBY, probe)) return;
    if (isBridgeTileCell(cardinalCell(flankAX, flankAY))) return;
    if (isBridgeTileCell(cardinalCell(flankBX, flankBY))) return;
    if (!isDiagonalLandShore(cornerX, cornerY, ctx)) return;
    mask |= bit;
  };

  tryInset(gx - 1, gy - 1, gx, gy - 1, gx - 1, gy, WATER_EDGE_TOP);
  tryInset(gx + 1, gy - 1, gx, gy - 1, gx + 1, gy, WATER_EDGE_RIGHT);
  tryInset(gx - 1, gy + 1, gx, gy + 1, gx - 1, gy, WATER_EDGE_LEFT);
  tryInset(gx + 1, gy + 1, gx, gy + 1, gx + 1, gy, WATER_EDGE_BOTTOM);
  return mask;
}

/** Cardinal-neighbor probe from grid cells (water + bridge_tile path). */
export function gridWaterNeighborProbe(
  inBounds: (gx: number, gy: number) => boolean,
  getCell: (gx: number, gy: number) => WaterAutotileCell
): WaterNeighborProbe {
  return (nx, ny) => {
    if (!inBounds(nx, ny)) return false;
    return cellCountsAsWaterForAutotile(getCell(nx, ny));
  };
}

/** True when the cell should connect without a shore (another water tile). */
export function isWaterNeighbor(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe
): boolean {
  return probe(gx, gy);
}

export function computeWaterEdgeMask(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe,
  diagonalContext?: WaterDiagonalContext
): WaterEdgeMask {
  let mask = 0;
  // Iso direction flip: opposite cardinal sets each slant bit (T↔B, R↔L on grid).
  if (!isWaterNeighbor(gx, gy + 1, probe)) mask |= WATER_EDGE_TOP;
  if (!isWaterNeighbor(gx - 1, gy, probe)) mask |= WATER_EDGE_RIGHT;
  if (!isWaterNeighbor(gx, gy - 1, probe)) mask |= WATER_EDGE_BOTTOM;
  if (!isWaterNeighbor(gx + 1, gy, probe)) mask |= WATER_EDGE_LEFT;
  if (diagonalContext) {
    mask = applyDiagonalCornerBits(gx, gy, probe, mask, diagonalContext);
  }
  return mask;
}

const WATER_TEXTURE_BY_MASK: Record<number, string> = {
  0: 'water',
  1: 'water_1_border_bottom-left',
  2: 'water_1_border_bottom-right',
  4: 'water_1_border_top-right',
  8: 'water_1_border_top-left',
  3: 'water_2_borders_bottom',
  // Left/right and face-to-face pairs are swapped vs raw bitmask labels: art names
  // describe land side in iso view, while bits follow grid cardinals (see header).
  5: 'water_2_borders_face_to_face_left',
  6: 'water_2_borders_left',
  7: 'water_3_border_left_top',
  9: 'water_2_borders_right',
  10: 'water_2_borders_face_to_face_right',
  11: 'water_3_border_right_top',
  12: 'water_2_borders_top',
  13: 'water_3_border_right_bottom',
  14: 'water_3_border_left_bottom',
  15: 'water',
};

/** Clockwise iso corner rotation for one-border shore keys (mask slot → loaded file). */
export function remapWater1BorderTextureKey(textureKey: string): string {
  switch (textureKey) {
    case 'water_1_border_bottom-left':
      return 'water_1_border_bottom-right';
    case 'water_1_border_bottom-right':
      return 'water_1_border_top-right';
    case 'water_1_border_top-right':
      return 'water_1_border_top-left';
    case 'water_1_border_top-left':
      return 'water_1_border_bottom-left';
    default:
      return textureKey;
  }
}

/** Cyclic iso orientation fix for two-border shore keys (mask slot → loaded file). */
export function remapWater2BorderTextureKey(textureKey: string): string {
  switch (textureKey) {
    case 'water_2_borders_left':
      return 'water_2_borders_top';
    case 'water_2_borders_bottom':
      return 'water_2_borders_right';
    case 'water_2_borders_right':
      return 'water_2_borders_bottom';
    case 'water_2_borders_top':
      return 'water_2_borders_left';
    default:
      return textureKey;
  }
}

/** Clockwise iso corner rotation for three-border shore keys (mask slot → loaded file). */
export function remapWater3BorderTextureKey(textureKey: string): string {
  switch (textureKey) {
    case 'water_3_border_left_top':
      return 'water_3_border_right_top';
    case 'water_3_border_right_top':
      return 'water_3_border_right_bottom';
    case 'water_3_border_right_bottom':
      return 'water_3_border_left_bottom';
    case 'water_3_border_left_bottom':
      return 'water_3_border_left_top';
    default:
      return textureKey;
  }
}

export function waterTextureKeyFromMask(mask: WaterEdgeMask): string {
  const rawKey = WATER_TEXTURE_BY_MASK[mask] ?? 'water';
  return remapWater3BorderTextureKey(
    remapWater2BorderTextureKey(remapWater1BorderTextureKey(rawKey))
  );
}

export const WATER_TOP_BORDER_TEXTURE_KEY = 'water_2_borders_top';
export const WATER_BOTTOM_BORDER_TEXTURE_KEY = 'water_2_borders_bottom';
/** Uniform scale for flat `water` ground tiles (tiles/water.png). */
export function getWaterFlatDisplayScale(): number {
  return WATER_FLAT_DISPLAY_SCALE;
}

/** Uniform scale for single-edge `water_1_border_*` shore tiles. */
export function getWater1BorderDisplayScale(): number {
  return WATER_1_BORDER_DISPLAY_SCALE;
}

/** Scale for shore / border water variants; not flat `water` (see applyIsoTopBorderWaterSprite). */
export function getWaterGroundDisplayScale(): number {
  return WATER_GROUND_DISPLAY_SCALE;
}

/**
 * Uniform iso scale for a water ground texture key.
 * Matches {@link applyGroundTileAt} and build-mode ghost sizing.
 */
export function getWaterTextureUniformDisplayScale(textureKey: string): number {
  if (
    isWaterFaceToFaceTextureKey(textureKey) ||
    isWater2BordersLeftRightTextureKey(textureKey)
  ) {
    return getWaterGroundDisplayScale();
  }
  if (isWater1BorderTextureKey(textureKey)) {
    return getWater1BorderDisplayScale();
  }
  return getWaterFlatDisplayScale();
}

/** Farm-island cells bump water scale to at least {@link GROUND_TILE_SEAM_SCALE}. */
export function resolveWaterGroundDisplayScale(
  textureKey: string,
  underFarmIsland: boolean
): number {
  const base = getWaterTextureUniformDisplayScale(textureKey);
  return underFarmIsland ? Math.max(base, GROUND_TILE_SEAM_SCALE) : base;
}

/** Apply the same water ground sprite sizing as placed tiles. */
export function applyWaterGroundTileSprite(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  textureKey: string,
  displayScale: number
): void {
  if (textureKey === WATER_TOP_BORDER_TEXTURE_KEY) {
    applyIsoTopBorderWaterSprite(sprite);
  } else if (textureKey === WATER_BOTTOM_BORDER_TEXTURE_KEY) {
    applyIsoBottomBorderWaterSprite(sprite);
  } else if (isWaterFaceToFaceTextureKey(textureKey)) {
    applyIsoFaceToFaceWaterSprite(sprite, displayScale);
  } else if (isWater2BordersLeftRightTextureKey(textureKey)) {
    applyIsoWater2BordersLeftRightSprite(sprite, displayScale, textureKey);
  } else if (isWater1BorderTextureKey(textureKey)) {
    applyIsoWater1BorderSprite(sprite, displayScale, textureKey);
  } else {
    applyIsoTileSprite(sprite, displayScale);
  }
}

/** Screen-space nudge as a fraction of the iso diamond (applied in px). */
export const WATER_LEFT_CORNER_NUDGE = 0.10;
/** Shift mask 6 (`water_2_borders_left`) slightly toward bottom-right. */
export const WATER_MASK6_OFFSET_X = 0.05;
export const WATER_MASK6_OFFSET_Y = 0.04;

export type WaterCornerDisplayOffset = { dx: number; dy: number };

/**
 * Position tweak for the two left-side L corners only (not a full corner table).
 * - Mask 6: map / outer top-left L (`water_2_borders_left`) — nudge bottom-right.
 * - Mask 3: bottom-left L where water continues south + west (`water_2_borders_bottom`);
 *   horizontal shift is handled by texture-key offset.
 */
export function getWaterLeftCornerDisplayOffset(
  mask: WaterEdgeMask
): WaterCornerDisplayOffset | null {
  switch (mask) {
    case 6:
      return {
        dx: WATER_MASK6_OFFSET_X * TILE_WIDTH,
        dy: WATER_MASK6_OFFSET_Y * TILE_HEIGHT,
      };
    case 3:
      return {
        dx: 0,
        dy: WATER_LEFT_CORNER_NUDGE * TILE_HEIGHT,
      };
    default:
      return null;
  }
}

export function getWaterCornerDisplayOffset(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe,
  diagonalContext?: WaterDiagonalContext
): WaterCornerDisplayOffset | null {
  return getWaterLeftCornerDisplayOffset(
    computeWaterEdgeMask(gx, gy, probe, diagonalContext)
  );
}

export function getWaterTextureDisplayOffset(textureKey: string): WaterCornerDisplayOffset | null {
  if (!isWater1BorderTextureKey(textureKey)) {
    return null;
  }
  return getWater1BorderDisplayOffset(textureKey);
}

export function waterTextureKeyAt(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe,
  diagonalContext?: WaterDiagonalContext
): string {
  return waterTextureKeyFromMask(
    computeWaterEdgeMask(gx, gy, probe, diagonalContext)
  );
}

/** Probe that treats `(gx, gy)` as water (build ghost / placement preview). */
export function waterPlacementPreviewProbe(
  gx: number,
  gy: number,
  baseProbe: WaterNeighborProbe
): WaterNeighborProbe {
  return (nx, ny) => {
    if (nx === gx && ny === gy) return true;
    return baseProbe(nx, ny);
  };
}

export function waterTextureKeyForPlacementPreview(
  gx: number,
  gy: number,
  baseProbe: WaterNeighborProbe
): string {
  return waterTextureKeyAt(gx, gy, waterPlacementPreviewProbe(gx, gy, baseProbe));
}

/** Lightweight self-check for slant masks (run via test script). */
export function runWaterAutotileSelfTest(): void {
  const water = new Set(['5,4', '5,6', '1,0', '0,0', '2,0', '0,1']);
  const probe = (x: number, y: number) => water.has(`${x},${y}`);

  // Iso diagonal chain (cardinal N+S water): shores on E/W slants only → mask 5
  expectMask(
    computeWaterEdgeMask(5, 5, probe),
    WATER_EDGE_RIGHT | WATER_EDGE_LEFT,
    'diagonal face-to-face'
  );
  expectKey(waterTextureKeyFromMask(5), 'water_2_borders_face_to_face_left');

  // Map top-left outer corner (land N+W, water S+E) → mask 6 uses left shore art
  const borderProbe = (x: number, y: number) => {
    const size = 20;
    return x >= 0 && y >= 0 && x < size && y < size && (y === 0 || y === size - 1 || x === 0 || x === size - 1);
  };
  expectMask(computeWaterEdgeMask(0, 0, borderProbe), 6, 'map top-left water corner');
  expectKey(waterTextureKeyFromMask(6), 'water_2_borders_top');

  // All four cardinal neighbors water → no shores
  const probeInterior = (x: number, y: number) =>
    ['6,5', '6,4', '6,6', '5,5', '7,5'].includes(`${x},${y}`);
  expectMask(computeWaterEdgeMask(6, 5, probeInterior), 0, 'cardinal interior');
  expectKey(waterTextureKeyFromMask(0), 'water');

  // Isolated pond (no cardinal water neighbors)
  expectMask(computeWaterEdgeMask(9, 9, probe), 15, 'isolated cell');
  expectKey(waterTextureKeyFromMask(15), 'water');

  // Land to grid north only → screen top-right bank (mask 2)
  const landNorthProbe2: WaterNeighborProbe = (x, y) => {
    if (x === 5 && y === 5) return true;
    if (x === 5 && y === 4) return false;
    if (x === 5 && y === 6) return true;
    if (x === 4 && y === 5) return true;
    if (x === 6 && y === 5) return true;
    return false;
  };
  expectMask(computeWaterEdgeMask(5, 5, landNorthProbe2), 2, 'land north → BR shore');
  expectKey(waterTextureKeyFromMask(2), 'water_1_border_top-right');

  const grassNorthBase: WaterNeighborProbe = (x, y) => {
    if (x === 5 && y === 5) return false;
    if (x === 5 && y === 4) return false;
    if (x === 5 && y === 6) return true;
    if (x === 4 && y === 5) return true;
    if (x === 6 && y === 5) return true;
    return false;
  };
  expectKey(
    waterTextureKeyForPlacementPreview(5, 5, grassNorthBase),
    'water_1_border_top-right'
  );

  const narrowChannelProbe: WaterNeighborProbe = (x, y) =>
    ['10,9', '10,11', '9,10', '11,10'].includes(`${x},${y}`);
  const narrowChannelCtx: WaterDiagonalContext = {
    inBounds: (x, y) => x >= 0 && y >= 0 && x < 20 && y < 20,
    getCell: (x, y) => {
      if (x === 9 && y === 9) return { type: 'grass' };
      if (x === 11 && y === 9) {
        return { type: 'path', pathVariant: 'stone_path' };
      }
      if (x === 9 && y === 11) {
        return { type: 'path', pathVariant: 'bridge_tile' };
      }
      return { type: 'void' };
    },
  };
  expectMask(
    computeWaterEdgeMask(10, 10, narrowChannelProbe, narrowChannelCtx),
    WATER_EDGE_TOP | WATER_EDGE_RIGHT,
    'narrow channel diagonal grass/path insets'
  );
  expectKey(waterTextureKeyFromMask(12), 'water_2_borders_left');
  expectKey(
    waterTextureKeyFromMask(WATER_EDGE_TOP | WATER_EDGE_RIGHT),
    'water_2_borders_left'
  );

  const topLeft = getWaterLeftCornerDisplayOffset(6);
  if (!topLeft || topLeft.dx <= 0 || topLeft.dy <= 0) {
    throw new Error('mask 6 nudge should shift bottom-right (positive dx, positive dy)');
  }
  const bottomLeft = getWaterLeftCornerDisplayOffset(3);
  if (!bottomLeft || bottomLeft.dx !== 0 || bottomLeft.dy <= 0) {
    throw new Error('mask 3 nudge should offset down only (zero dx, positive dy)');
  }

  const bottomTextureOffset = getWater2BordersTopBottomDisplayOffset('water_2_borders_bottom');
  if (!bottomTextureOffset || bottomTextureOffset.dx !== 0 || bottomTextureOffset.dy <= 0) {
    throw new Error('bottom-border texture offset should offset down only (zero dx, positive dy)');
  }

  const topTextureOffset = getWater2BordersTopBottomDisplayOffset('water_2_borders_top');
  if (!topTextureOffset || topTextureOffset.dx >= 0 || topTextureOffset.dy >= 0) {
    throw new Error('top-border texture offset should nudge toward top-left (negative dx, negative dy)');
  }

}

function expectMask(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected mask ${expected}, got ${actual}`);
  }
}

function expectKey(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`expected texture ${expected}, got ${actual}`);
  }
}

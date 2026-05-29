import { TILE_HEIGHT, TILE_WIDTH, WATER_GROUND_DISPLAY_SCALE } from './iso';

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
 * Neighbor checks use the four cardinal grid cells only (same as path ring):
 *   top    (gx, gy - 1)
 *   right  (gx + 1, gy)
 *   bottom (gx, gy + 1)
 *   left   (gx - 1, gy)
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
 * | 8    | TR, BR, BL          | TL             | water_1_border_top * |
 * | 4    | TL, BR, BL          | TR             | water_1_border_top-right |
 * | 2    | TL, TR, BL          | BR             | water_1_border_bottom-right |
 * | 1    | TL, TR, BR          | BL             | water_1_border_bottom-left |
 * | 12   | BL, BR              | TL + TR        | water_2_borders_top |
 * | 9    | TR, BR              | TL + BL        | water_2_borders_right |
 * | 6    | TL, BL              | TR + BR        | water_2_borders_left |
 * | 3    | TL, TR              | BL + BR        | water_2_borders_bottom |
 * | 10   | TR, BL              | TL + BR        | water_2_borders_face_to_face_right |
 * | 5    | TL, BR              | TR + BL        | water_2_borders_face_to_face_left |
 * | 7    | TL                  | TR + BR + BL   | water_3_border_left_top |
 * | 14   | BR                  | TL + TR + BL   | water_3_border_left_bottom |
 * | 13   | TR                  | TL + BL + BR   | water_3_border_right_bottom |
 * | 11   | BL                  | TL + TR + BR   | water_3_border_right_top |
 * | 15   | none                | all four       | water_2_borders_bottom |
 *
 * * `water_1_border_top` art includes both TL and TR shores; used when only the
 *   TL bit is set (uncommon). Mask 12 uses the same asset family via
 *   `water_2_borders_top`.
 */

export const WATER_EDGE_TOP = 8;
export const WATER_EDGE_RIGHT = 4;
export const WATER_EDGE_BOTTOM = 2;
export const WATER_EDGE_LEFT = 1;

export type WaterEdgeMask = number;

export type WaterNeighborProbe = (gx: number, gy: number) => boolean;

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
  probe: WaterNeighborProbe
): WaterEdgeMask {
  let mask = 0;
  // Iso direction flip: opposite cardinal sets each slant bit (T↔B, R↔L on grid).
  if (!isWaterNeighbor(gx, gy + 1, probe)) mask |= WATER_EDGE_TOP;
  if (!isWaterNeighbor(gx - 1, gy, probe)) mask |= WATER_EDGE_RIGHT;
  if (!isWaterNeighbor(gx, gy - 1, probe)) mask |= WATER_EDGE_BOTTOM;
  if (!isWaterNeighbor(gx + 1, gy, probe)) mask |= WATER_EDGE_LEFT;
  return mask;
}

const WATER_TEXTURE_BY_MASK: Record<number, string> = {
  0: 'water',
  1: 'water_1_border_bottom-left',
  2: 'water_1_border_bottom-right',
  4: 'water_1_border_top-right',
  8: 'water_1_border_top',
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
  15: 'water_2_borders_bottom',
};

export function waterTextureKeyFromMask(mask: WaterEdgeMask): string {
  return WATER_TEXTURE_BY_MASK[mask] ?? 'water';
}

export const WATER_TOP_BORDER_TEXTURE_KEY = 'water_2_borders_top';
export const WATER_BOTTOM_BORDER_TEXTURE_KEY = 'water_2_borders_bottom';
/** Uniform scale for all water ground tiles except `water_2_borders_top` (see applyIsoTopBorderWaterSprite). */
export function getWaterGroundDisplayScale(): number {
  return WATER_GROUND_DISPLAY_SCALE;
}

/** Screen-space nudge as a fraction of the iso diamond (applied in px). */
export const WATER_LEFT_CORNER_NUDGE = 0.10;
/** Shift `water_2_borders_bottom` toward top-right (fraction of tile diamond). */
export const WATER_BOTTOM_BORDER_OFFSET_X = 0.08;
export const WATER_BOTTOM_BORDER_OFFSET_Y = -0.14;
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
  probe: WaterNeighborProbe
): WaterCornerDisplayOffset | null {
  return getWaterLeftCornerDisplayOffset(computeWaterEdgeMask(gx, gy, probe));
}

export function getWaterTextureDisplayOffset(textureKey: string): WaterCornerDisplayOffset | null {
  if (textureKey === WATER_BOTTOM_BORDER_TEXTURE_KEY) {
    return {
      dx: WATER_BOTTOM_BORDER_OFFSET_X * TILE_WIDTH,
      dy: WATER_BOTTOM_BORDER_OFFSET_Y * TILE_HEIGHT,
    };
  }
  return null;
}

export function waterTextureKeyAt(
  gx: number,
  gy: number,
  probe: WaterNeighborProbe
): string {
  return waterTextureKeyFromMask(computeWaterEdgeMask(gx, gy, probe));
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
  expectKey(waterTextureKeyFromMask(6), 'water_2_borders_left');

  // All four cardinal neighbors water → no shores
  const probeInterior = (x: number, y: number) =>
    ['6,5', '6,4', '6,6', '5,5', '7,5'].includes(`${x},${y}`);
  expectMask(computeWaterEdgeMask(6, 5, probeInterior), 0, 'cardinal interior');
  expectKey(waterTextureKeyFromMask(0), 'water');

  // Isolated pond (no water touching any slant)
  expectMask(computeWaterEdgeMask(9, 9, probe), 15, 'isolated cell');
  expectKey(waterTextureKeyFromMask(15), 'water_2_borders_bottom');

  const topLeft = getWaterLeftCornerDisplayOffset(6);
  if (!topLeft || topLeft.dx <= 0 || topLeft.dy <= 0) {
    throw new Error('mask 6 nudge should shift bottom-right (positive dx, positive dy)');
  }
  const bottomLeft = getWaterLeftCornerDisplayOffset(3);
  if (!bottomLeft || bottomLeft.dx !== 0 || bottomLeft.dy <= 0) {
    throw new Error('mask 3 nudge should offset down only (zero dx, positive dy)');
  }

  const bottomTextureOffset = getWaterTextureDisplayOffset('water_2_borders_bottom');
  if (!bottomTextureOffset || bottomTextureOffset.dx >= 0 || bottomTextureOffset.dy >= 0) {
    throw new Error('bottom-border texture offset should move top-left');
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

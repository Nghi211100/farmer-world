import Phaser from 'phaser';
import { FARM_SOIL_BOUNDS } from './config/gameConfig';
import { computeCoverDisplaySize } from './backgroundLayout';

/**
 * Uniform scale past the farm soil screen rhombus (1 = flush with soil diamond).
 * ~1.65+ pulls island.png foliage, moat, and cliff art past the 8×8 patch edges.
 */
export const FARM_ISLAND_SCALE_BOOST = 3.95;

/**
 * Render farm_island this many depth units below the shallowest farm soil ground tile in the
 * soil patch plus its outer path ring (iso gx+gy can be as low as 8 at (3,5)).
 */
export const FARM_ISLAND_DEPTH_BELOW_GROUND = 28;

/**
 * Minimum ground depth above farm_island for soil bounds + path ring footprint cells.
 * Prevents north apex ring tiles (gx+gy≈8) from losing to island art.
 */
export const FARM_LAND_DEPTH_BOOST = 40;

/** Extra depth floor for the north farm edge row so island art can never overdraw it. */
export const FARM_NORTH_EDGE_DEPTH_BOOST = 12;

/**
 * Extra depth to push farm_island further behind ground tiles.
 * This prevents island.png cliff/foliage pixels from covering north-apex
 * playable tiles where the image still overlaps beyond the logical footprint.
 */
export const FARM_ISLAND_EXTRA_BELOW_GROUND = 50;

/** One-cell margin around FARM_SOIL_BOUNDS for path ring tiles included in footprint depth. */
export const FARM_ISLAND_RING_MARGIN = 1;

/**
 * Deterministic z-order safety margin for the north apex:
 * ground tiles on the topmost north edge row(s) must render at least this many depth units
 * above farm_island.
 */
export const ISLAND_GROUND_MIN_SEP = 90;

/** Minimum gx+gy in the farm footprint (soil bounds + path ring). */
export function getFarmFootprintMinSum(ringMargin = FARM_ISLAND_RING_MARGIN): number {
  return (
    FARM_SOIL_BOUNDS.minX -
    ringMargin +
    (FARM_SOIL_BOUNDS.minY - ringMargin)
  );
}

/** Northernmost gy included in the farm footprint ring (path + soil). */
export function getFarmNorthEdgeMinGy(ringMargin = FARM_ISLAND_RING_MARGIN): number {
  return FARM_SOIL_BOUNDS.minY - ringMargin;
}

/** Soil/path ring cells on the north edge or iso north-apex band (gx+gy at footprint minimum). */
export function isFarmNorthEdgeCell(
  gx: number,
  gy: number,
  ringMargin = FARM_ISLAND_RING_MARGIN
): boolean {
  const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
  if (
    gx < minX - ringMargin ||
    gx > maxX + ringMargin ||
    gy < getFarmNorthEdgeMinGy(ringMargin) ||
    gy > maxY + ringMargin
  ) {
    return false;
  }
  const northEdgeRow = gy >= getFarmNorthEdgeMinGy(ringMargin) && gy <= minY;
  const northApexBand = gx + gy <= getFarmFootprintMinSum(ringMargin) + 1;
  return northEdgeRow || northApexBand;
}

export function computeFarmIslandWorldDepth(
  belowGround = FARM_ISLAND_DEPTH_BELOW_GROUND,
  ringMargin = FARM_ISLAND_RING_MARGIN
): number {
  const { minX, maxX, minY, maxY } = FARM_SOIL_BOUNDS;
  let minSum = Infinity;

  for (let gy = minY - ringMargin; gy <= maxY + ringMargin; gy++) {
    for (let gx = minX - ringMargin; gx <= maxX + ringMargin; gx++) {
      const sum = gx + gy;
      if (sum < minSum) minSum = sum;
    }
  }

  // minDepth (minSum * 10) - belowGround - extra offset
  return minSum * 10 - belowGround - FARM_ISLAND_EXTRA_BELOW_GROUND;
}

/**
 * Ground depth for farm footprint tiles — never below island + {@link FARM_LAND_DEPTH_BOOST}.
 */
export function getFarmLandGroundDepth(
  _gx: number,
  gy: number,
  baseGroundDepth: number,
  isFootprint: boolean
): number {
  if (!isFootprint) return baseGroundDepth;

  const islandDepth = computeFarmIslandWorldDepth();
  const footprintFloor = islandDepth + FARM_LAND_DEPTH_BOOST;

  // Keep the top playable edge (north row + north path ring + apex band) above island overdraw.
  const northEdgeFloor = isFarmNorthEdgeCell(_gx, gy)
    ? islandDepth + FARM_LAND_DEPTH_BOOST + FARM_NORTH_EDGE_DEPTH_BOOST
    : -Infinity;

  return Math.max(baseGroundDepth, footprintFloor, northEdgeFloor);
}

/** Horizontal island.png screen offset, as fraction of rhombus W–E span. */
export const FARM_ISLAND_OFFSET_X_FRAC = 0.06;

/** Vertical island.png screen offset, as fraction of rhombus N–S span. */
export const FARM_ISLAND_OFFSET_Y_FRAC = 0.28;

export type FarmSoilScreenRhombus = {
  north: { x: number; y: number };
  east: { x: number; y: number };
  south: { x: number; y: number };
  west: { x: number; y: number };
  center: { x: number; y: number };
};

export type FarmIslandLayoutOptions = {
  scaleBoost?: number;
  offsetXFrac?: number;
  offsetYFrac?: number;
};

/**
 * Cover-fit island.png to the farm soil iso diamond (rhombus) with uniform scale only.
 * Uses rhombus N–S / W–E spans so the image aligns with the tile diamond.
 */
export function layoutFarmIslandImage(
  image: Phaser.GameObjects.Image,
  rhombus: FarmSoilScreenRhombus,
  texW: number,
  texH: number,
  options: FarmIslandLayoutOptions = {}
): void {
  const scaleBoost = options.scaleBoost ?? FARM_ISLAND_SCALE_BOOST;
  const offsetXFrac = options.offsetXFrac ?? FARM_ISLAND_OFFSET_X_FRAC;
  const offsetYFrac = options.offsetYFrac ?? FARM_ISLAND_OFFSET_Y_FRAC;

  const spanW = Math.max(1, rhombus.east.x - rhombus.west.x);
  const spanH = Math.max(1, rhombus.south.y - rhombus.north.y);

  const targetW = spanW * scaleBoost;
  const targetH = spanH * scaleBoost;

  const { displayW, displayH } = computeCoverDisplaySize(texW, texH, targetW, targetH);

  if (typeof (image as unknown as { setCrop?: unknown }).setCrop === 'function') {
    image.setCrop();
  }

  image.setOrigin(0.5, 0.5);
  image.setPosition(rhombus.center.x + spanW * offsetXFrac, rhombus.center.y + spanH * offsetYFrac);
  image.setScrollFactor(1);
  image.setDisplaySize(displayW, displayH);
}


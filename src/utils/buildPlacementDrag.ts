import type { GridSystem } from '../systems/GridSystem';

/** Extra touch slop around ghost sprite / footprint screen bounds. */
export const PLACEMENT_GHOST_HIT_SLOP_PX = 12;

type BoundsLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type SpriteBoundsSource = {
  visible: boolean;
  getBounds: () => BoundsLike;
};

export function isWorldPointInScreenBounds(
  worldX: number,
  worldY: number,
  bounds: BoundsLike,
  slopPx = 0
): boolean {
  return (
    worldX >= bounds.left - slopPx &&
    worldX <= bounds.right + slopPx &&
    worldY >= bounds.top - slopPx &&
    worldY <= bounds.bottom + slopPx
  );
}

export function isWorldPointOnMapFootprint(
  worldX: number,
  worldY: number,
  anchorGx: number,
  anchorGy: number,
  tilesW: number,
  tilesH: number,
  grid: GridSystem,
  slopPx = 0
): boolean {
  const b = grid.getRectMapFootprintScreenBounds(anchorGx, anchorGy, tilesW, tilesH);
  return isWorldPointInScreenBounds(
    worldX,
    worldY,
    { left: b.minX, right: b.maxX, top: b.minY, bottom: b.maxY },
    slopPx
  );
}

export function isWorldPointOnSpriteBounds(
  worldX: number,
  worldY: number,
  sprite: SpriteBoundsSource | null | undefined,
  slopPx = 0
): boolean {
  if (!sprite?.visible) return false;
  return isWorldPointInScreenBounds(worldX, worldY, sprite.getBounds(), slopPx);
}

export type PlacementGhostDragHitOpts = {
  pointerWorldX: number;
  pointerWorldY: number;
  gridPickGx: number;
  gridPickGy: number;
  ghostGx: number;
  ghostGy: number;
  footprintW: number;
  footprintH: number;
  grid: GridSystem;
  isGridOnFootprint: (gx: number, gy: number) => boolean;
  ghostSprite?: SpriteBoundsSource | null;
  ghostOverlay?: SpriteBoundsSource | null;
  slopPx?: number;
};

/**
 * True when a locked placement ghost should begin drag on pointerdown.
 * Grid diamond picks can miss tall/wide ghost art (field border, trees, buildings).
 */
export function canBeginPlacementGhostDrag(opts: PlacementGhostDragHitOpts): boolean {
  const slop = opts.slopPx ?? PLACEMENT_GHOST_HIT_SLOP_PX;
  if (opts.isGridOnFootprint(opts.gridPickGx, opts.gridPickGy)) {
    return true;
  }
  if (
    isWorldPointOnMapFootprint(
      opts.pointerWorldX,
      opts.pointerWorldY,
      opts.ghostGx,
      opts.ghostGy,
      opts.footprintW,
      opts.footprintH,
      opts.grid,
      slop
    )
  ) {
    return true;
  }
  if (isWorldPointOnSpriteBounds(opts.pointerWorldX, opts.pointerWorldY, opts.ghostSprite, slop)) {
    return true;
  }
  if (isWorldPointOnSpriteBounds(opts.pointerWorldX, opts.pointerWorldY, opts.ghostOverlay, slop)) {
    return true;
  }
  return false;
}

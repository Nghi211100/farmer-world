import Phaser from 'phaser';
import type { GridSystem } from '../systems/GridSystem';
import { TOOL_MODAL_VISUAL_SCALE } from '../ui/toolModalLayout';
import { TILE_HEIGHT } from './iso';

/** Farm main camera zoom (exposed for e2e visual metrics). */
export function farmMainCameraZoom(scene: Phaser.Scene): number {
  const z = scene.cameras.main.zoom;
  return z > 0 ? z : 1;
}

/**
 * World position → coordinates for scrollFactor(0) HUD objects.
 *
 * Phaser renders scrollFactor 0 sprites as: cameraMatrix × (x, y), while world
 * sprites use cameraMatrix × (x − scrollX, y − scrollY). HUD x/y must therefore
 * be (world − scroll), not the fully transformed screen pixel position.
 */
export function worldToUiScreen(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldX: number,
  worldY: number
): { x: number; y: number } {
  return {
    x: worldX - camera.scrollX,
    y: worldY - camera.scrollY,
  };
}

export interface PopupPlacement {
  cx: number;
  cy: number;
}

export interface TilePopupPlaceOptions {
  panelW: number;
  panelH: number;
  /** On-screen scale applied to the panel container (default {@link TOOL_MODAL_VISUAL_SCALE}). */
  containerVisualScale?: number;
  /** Gap above tile anchor in canvas pixels. Default 12. */
  aboveOffsetPx?: number;
  /** Use top of isometric diamond instead of tile center. */
  anchorTop?: boolean;
  topInset?: number;
  bottomInset?: number;
}

const HUD_TOP = 56;
const HUD_BOTTOM = 72;

/**
 * Position a popup centered on a farm tile, above the tile.
 * Returned `cx`/`cy` are scrollFactor-0 local coords (world − camera scroll).
 */
export function placePopupAboveTile(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  opts: TilePopupPlaceOptions
): PopupPlacement {
  const cam = scene.cameras.main;
  const { width, height } = scene.scale;
  const { panelW, panelH } = opts;
  const visualScale = opts.containerVisualScale ?? TOOL_MODAL_VISUAL_SCALE;
  const onScreenW = panelW * visualScale;
  const onScreenH = panelH * visualScale;
  const topInset = opts.topInset ?? HUD_TOP;
  const bottomInset = opts.bottomInset ?? HUD_BOTTOM;
  const gapPx = opts.aboveOffsetPx ?? 12;

  const top = grid.gridToMapScreen(gx, gy);
  const anchorY = opts.anchorTop ? top.y : top.y + TILE_HEIGHT / 2;
  const { x: tileX, y: tileY } = worldToUiScreen(cam, top.x, anchorY);

  const cx = Phaser.Math.Clamp(tileX, onScreenW / 2 + 8, width - onScreenW / 2 - 8);
  const cy = Phaser.Math.Clamp(
    tileY - gapPx - onScreenH / 2,
    topInset + onScreenH / 2,
    height - bottomInset - onScreenH / 2
  );

  return { cx, cy };
}

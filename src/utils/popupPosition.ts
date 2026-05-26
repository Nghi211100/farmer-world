import Phaser from 'phaser';
import type { GridSystem } from '../systems/GridSystem';
import { TILE_HEIGHT } from './iso';

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
  /** Gap above tile anchor in screen pixels (scaled for zoom). Default 12. */
  aboveOffsetPx?: number;
  /** Use top of isometric diamond instead of tile center. */
  anchorTop?: boolean;
  topInset?: number;
  bottomInset?: number;
}

const HUD_TOP = 56;
const HUD_BOTTOM = 72;

/**
 * Position a popup centered on a farm tile, above the tile in screen space.
 * Uses FarmScene main camera scroll/zoom via scrollFactor-0 placement rules.
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
  const topInset = opts.topInset ?? HUD_TOP;
  const bottomInset = opts.bottomInset ?? HUD_BOTTOM;
  const gapPx = opts.aboveOffsetPx ?? 12;
  const gap = cam.zoom > 0 ? gapPx / cam.zoom : gapPx;

  const top = grid.gridToScreen(gx, gy);
  const anchorY = opts.anchorTop ? top.y : top.y + TILE_HEIGHT / 2;
  const screen = worldToUiScreen(cam, top.x, anchorY);

  const cx = Phaser.Math.Clamp(screen.x, panelW / 2 + 8, width - panelW / 2 - 8);
  const cy = Phaser.Math.Clamp(
    screen.y - gap - panelH / 2,
    topInset + panelH / 2,
    height - bottomInset - panelH / 2
  );

  return { cx, cy };
}

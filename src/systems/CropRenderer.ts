import type { CropId } from '../config/CropConfig';
import {
  getCropAnchorY,
  getCropDisplaySize,
  lifecycleStageToRenderStage,
  type CropRenderStage,
} from '../config/CropRenderConfig';
import { CropLifecycleState, isDebugMode } from '../config/gameConfig';
import { drawIsoTileDebug, ISO_CROP_ORIGIN, TILE_HEIGHT } from '../utils/iso';
import type { GridSystem } from './GridSystem';

export type CropSpriteTarget = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/**
 * Y-sort by tile (gx, gy) via iso depth; small height bias for growth stages only.
 * Do not add full displayHeight — that exceeds the +10 neighbor step and draws
 * crops in front of southern tiles (higher gy) that should occlude them.
 */
export function computeCropDepth(
  grid: GridSystem,
  gx: number,
  gy: number,
  displayHeight: number
): number {
  const capped = Math.min(displayHeight, TILE_HEIGHT);
  const heightBias = Math.floor(capped * 0.25);
  return grid.getDepth(gx, gy, 'crops') + heightBias;
}

function resolveRenderStage(
  stage: CropLifecycleState | CropRenderStage | number
): CropRenderStage {
  if (typeof stage === 'number') {
    return Math.min(4, Math.max(1, Math.round(stage))) as CropRenderStage;
  }
  return lifecycleStageToRenderStage(stage);
}

/**
 * Apply config display size to a crop sprite (scales from texture frame, not native PNG pixels).
 */
export function applyCropDisplaySize(
  sprite: CropSpriteTarget,
  width: number,
  height: number
): void {
  const frame = sprite.frame;
  const fw = frame.realWidth || frame.width;
  const fh = frame.realHeight || frame.height;
  if (fw <= 0 || fh <= 0) {
    sprite.setDisplaySize(width, height);
    return;
  }
  sprite.setScale(width / fw, height / fh);
}

function assertCropDisplaySize(
  sprite: CropSpriteTarget,
  cropType: CropId,
  stage: CropRenderStage,
  expectedW: number,
  expectedH: number
): void {
  if (!isDebugMode()) return;
  const dw = Math.round(sprite.displayWidth);
  const dh = Math.round(sprite.displayHeight);
  if (Math.abs(dw - expectedW) > 1 || Math.abs(dh - expectedH) > 1) {
    console.warn(
      `[CropRenderer] ${cropType} stage ${stage}: expected ${expectedW}×${expectedH}, sprite ${dw}×${dh}`
    );
  }
}

/**
 * Anchor crop at tile bottom center.
 * Ground footprint stays 64×32 (green debug diamond); plant art uses config display size (yellow box).
 */
export function renderCrop(
  sprite: CropSpriteTarget,
  cropType: CropId,
  stage: CropLifecycleState | CropRenderStage | number,
  gridX: number,
  gridY: number,
  grid: GridSystem
): { width: number; height: number } {
  const stageNumber = resolveRenderStage(stage);
  const { width, height } = getCropDisplaySize(cropType, stageNumber);
  const foot = grid.gridToTileBottom(gridX, gridY);

  sprite.setOrigin(ISO_CROP_ORIGIN.x, ISO_CROP_ORIGIN.y);
  sprite.setPosition(foot.x, getCropAnchorY(foot.y, cropType, stageNumber));
  applyCropDisplaySize(sprite, width, height);
  assertCropDisplaySize(sprite, cropType, stageNumber, width, height);
  sprite.setDepth(computeCropDepth(grid, gridX, gridY, height));

  return { width, height };
}

export interface CropDebugOverlayHandles {
  footprint?: Phaser.GameObjects.Graphics;
  anchor?: Phaser.GameObjects.Graphics;
  bounds?: Phaser.GameObjects.Graphics;
  sizeLabel?: Phaser.GameObjects.Text;
}

/**
 * Debug (?debug=1): green = 64×32 ground tile; yellow = crop display bounds (from config / sprite).
 */
export function drawCropDebugOverlay(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  cropType: CropId,
  stage: CropLifecycleState | CropRenderStage | number,
  handles: CropDebugOverlayHandles,
  sprite?: CropSpriteTarget
): CropDebugOverlayHandles {
  handles.footprint?.destroy();
  handles.anchor?.destroy();
  handles.bounds?.destroy();
  handles.sizeLabel?.destroy();

  const stageNumber = resolveRenderStage(stage);
  const configSize = getCropDisplaySize(cropType, stageNumber);
  const top = grid.gridToScreen(gx, gy);
  const foot = grid.gridToTileBottom(gx, gy);
  const anchorY = getCropAnchorY(foot.y, cropType, stageNumber);
  const width = sprite ? sprite.displayWidth : configSize.width;
  const height = sprite ? sprite.displayHeight : configSize.height;
  const baseDepth = computeCropDepth(grid, gx, gy, height) + 2;

  const footprint = scene.add.graphics();
  footprint.setDepth(baseDepth);
  drawIsoTileDebug(footprint, top.x, top.y, 0x00ff88, 0.9);

  const anchor = scene.add.graphics();
  anchor.setDepth(baseDepth + 1);
  anchor.fillStyle(0xff3366, 1);
  anchor.fillCircle(foot.x, anchorY, 3);

  const bounds = scene.add.graphics();
  bounds.setDepth(baseDepth + 1);
  const left = foot.x - width / 2;
  const topBound = anchorY - height;
  bounds.lineStyle(1, 0xffcc00, 0.95);
  bounds.strokeRect(left, topBound, width, height);

  const sizeLabel = scene.add
    .text(foot.x, topBound - 2, `${Math.round(width)}×${Math.round(height)}`, {
      fontSize: '9px',
      color: '#ffcc00',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(baseDepth + 2);

  return { footprint, anchor, bounds, sizeLabel };
}

export function clearCropDebugOverlay(handles: CropDebugOverlayHandles): void {
  handles.footprint?.destroy();
  handles.anchor?.destroy();
  handles.bounds?.destroy();
  handles.sizeLabel?.destroy();
  handles.footprint = undefined;
  handles.anchor = undefined;
  handles.bounds = undefined;
  handles.sizeLabel = undefined;
}

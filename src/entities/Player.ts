import Phaser from 'phaser';
import { PlayerFarmAction } from '../config/gameConfig';
import type { GridSystem } from '../systems/GridSystem';
import { DISPLAY_SIZE, fitSpriteDisplay } from '../utils/iso';
import {
  findPlayerWalkPath,
  isPlayerWalkCell,
  type GridCoord,
} from '../utils/playerWalk';

const ACTION_TEXTURES: Partial<Record<PlayerFarmAction, string>> = {
  [PlayerFarmAction.DIGGING]: 'farmer_digging',
  [PlayerFarmAction.WATERING]: 'farmer_watering',
  [PlayerFarmAction.HARVESTING]: 'farmer_harvesting',
  [PlayerFarmAction.PLANTING]: 'seed',
};

export type FarmerFacing = 'front' | 'back' | 'left' | 'right';

const IDLE_TEXTURE: Record<FarmerFacing, string> = {
  front: 'farmer_idle_front',
  back: 'farmer_idle_back',
  left: 'farmer_idle_left',
  right: 'farmer_idle_right',
};

const WALK_TEXTURES: Record<FarmerFacing, [string, string] | null> = {
  front: ['farmer_walk_front_1', 'farmer_walk_front_2'],
  back: ['farmer_walk_back_1', 'farmer_walk_back_2'],
  left: ['farmer_walk_left_1', 'farmer_walk_left_2'],
  right: ['farmer_walk_right_1', 'farmer_walk_right_2'],
};

const WALK_ANIM: Record<FarmerFacing, string> = {
  front: 'farmer-walk-front',
  back: 'farmer-walk-back',
  left: 'farmer-walk-left',
  right: 'farmer-walk-right',
};

function walkFramesExist(scene: Phaser.Scene, frames: [string, string]): boolean {
  return frames.every((key) => scene.textures.exists(key));
}

function idleTextureForFacing(scene: Phaser.Scene, facing: FarmerFacing): string {
  const preferred = IDLE_TEXTURE[facing];
  if (scene.textures.exists(preferred)) return preferred;
  if (facing !== 'front' && scene.textures.exists(IDLE_TEXTURE.front)) return IDLE_TEXTURE.front;
  if (facing !== 'left' && scene.textures.exists(IDLE_TEXTURE.left)) return IDLE_TEXTURE.left;
  return preferred;
}

function walkTextureForFacing(scene: Phaser.Scene, facing: FarmerFacing): string {
  const frames = WALK_TEXTURES[facing];
  if (frames) {
    const existing = frames.find((key) => scene.textures.exists(key));
    if (existing) return existing;
  }
  if (facing === 'back' && scene.textures.exists(IDLE_TEXTURE.back)) return IDLE_TEXTURE.back;
  const frontFrames = WALK_TEXTURES.front;
  if (frontFrames) {
    const existing = frontFrames.find((key) => scene.textures.exists(key));
    if (existing) return existing;
  }
  return idleTextureForFacing(scene, facing);
}

export function ensureFarmerWalkAnims(scene: Phaser.Scene): void {
  for (const facing of Object.keys(WALK_TEXTURES) as FarmerFacing[]) {
    const animKey = WALK_ANIM[facing];
    if (scene.anims.exists(animKey)) continue;

    const frames = WALK_TEXTURES[facing];
    if (frames && walkFramesExist(scene, frames)) {
      scene.anims.create({
        key: animKey,
        frames: frames.map((key) => ({ key })),
        frameRate: 8,
        repeat: -1,
      });
      continue;
    }

    if (facing === 'back') {
      const idleKey = idleTextureForFacing(scene, 'back');
      if (scene.textures.exists(idleKey)) {
        scene.anims.create({
          key: animKey,
          frames: [{ key: idleKey }],
          frameRate: 1,
          repeat: -1,
        });
      }
    }
  }
}

/**
 * Map one grid step (cart dx, dy) to farmer facing on the isometric map.
 *
 * Dominant |dx| → `right` (+dx) or `left` (−dx); dominant |dy| → `front` (+dy) or `back` (−dy).
 * Examples: +cartX only → `right`; +cartY only → `front`; +cartX +cartY → `front` (tie keeps current).
 *
 * When both axes change equally (diagonal), keep `current` so left↔front does not flip during
 * sub-tile interpolation.
 */
const AXIS_DOMINANCE_RATIO = 1.25;

export function resolveFacingFromDelta(dx: number, dy: number, current: FarmerFacing): FarmerFacing {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 0.01 && ady < 0.01) return current;

  if (adx > ady * AXIS_DOMINANCE_RATIO) return dx > 0 ? 'right' : 'left';
  if (ady > adx * AXIS_DOMINANCE_RATIO) return dy > 0 ? 'front' : 'back';
  return current;
}

export class Player {
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  private targetX: number;
  private targetY: number;
  private moving = false;
  private moveSpeed = 4;
  private facing: FarmerFacing = 'front';
  private farmAction: PlayerFarmAction = PlayerFarmAction.IDLE;
  private actionTimer = 0;
  private actionOnComplete?: () => void;
  private onReachCallback?: () => void;
  private walkPath: GridCoord[] = [];
  private readonly walkAnimReady = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    grid: GridSystem,
    startX: number,
    startY: number
  ) {
    this.gridX = startX;
    this.gridY = startY;
    this.targetX = startX;
    this.targetY = startY;

    ensureFarmerWalkAnims(scene);
    for (const facing of Object.keys(WALK_ANIM) as FarmerFacing[]) {
      if (scene.anims.exists(WALK_ANIM[facing])) {
        this.walkAnimReady.add(WALK_ANIM[facing]);
      }
    }

    const center = grid.gridToPlayerTile(startX, startY);
    const idleKey = idleTextureForFacing(scene, this.facing);
    this.sprite = scene.add.sprite(center.x, center.y, idleKey);
    this.sprite.setOrigin(0.5, 1);
    fitSpriteDisplay(this.sprite, DISPLAY_SIZE.playerW, DISPLAY_SIZE.playerH);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(grid.getDepth(startX, startY, 'entities'));
  }

  moveTo(gx: number, gy: number, grid: GridSystem, onReach?: () => void): boolean {
    if (!isPlayerWalkCell(grid, gx, gy)) return false;

    const fromX = Math.round(this.gridX);
    const fromY = Math.round(this.gridY);
    const path = findPlayerWalkPath(grid, fromX, fromY, gx, gy);
    if (path === null) return false;

    if (path.length === 0) {
      this.gridX = gx;
      this.gridY = gy;
      this.targetX = gx;
      this.targetY = gy;
      this.walkPath = [];
      this.moving = false;
      this.onReachCallback = undefined;
      onReach?.();
      return true;
    }

    const first = path[0];
    const stepDx = first.gx - fromX;
    const stepDy = first.gy - fromY;
    const nextFacing = resolveFacingFromDelta(stepDx, stepDy, this.facing);
    const facingChanged = nextFacing !== this.facing;
    const wasMoving = this.moving;

    this.walkPath = path;
    this.targetX = first.gx;
    this.targetY = first.gy;
    this.facing = nextFacing;
    this.moving = true;
    this.onReachCallback = onReach;

    if (!wasMoving || facingChanged) {
      this.applySpriteState(true);
    }
    return true;
  }

  clearOnReach(): void {
    this.onReachCallback = undefined;
    this.walkPath = [];
  }

  private cancelWalk(grid: GridSystem): void {
    this.moving = false;
    this.walkPath = [];
    this.onReachCallback = undefined;
    this.applySpriteState(false);
    this.syncTilePosition(grid);
  }

  private advanceWalkPath(): void {
    if (this.walkPath.length === 0) {
      this.moving = false;
      this.applySpriteState(false);
      if (this.onReachCallback) {
        const cb = this.onReachCallback;
        this.onReachCallback = undefined;
        cb();
      }
      return;
    }

    const next = this.walkPath.shift()!;
    const fromX = Math.round(this.gridX);
    const fromY = Math.round(this.gridY);
    const stepDx = next.gx - fromX;
    const stepDy = next.gy - fromY;
    this.facing = resolveFacingFromDelta(stepDx, stepDy, this.facing);
    this.targetX = next.gx;
    this.targetY = next.gy;
    this.applySpriteState(true);
  }

  update(grid: GridSystem, deltaMs: number): void {
    if (this.actionTimer > 0) {
      this.actionTimer -= deltaMs;
      if (this.actionTimer <= 0) {
        this.farmAction = PlayerFarmAction.IDLE;
        this.applySpriteState(this.moving);
        if (this.actionOnComplete) {
          const cb = this.actionOnComplete;
          this.actionOnComplete = undefined;
          cb();
        }
      }
      this.syncTilePosition(grid);
      return;
    }

    if (!this.moving) return;

    const nextGx = Math.round(this.targetX);
    const nextGy = Math.round(this.targetY);
    if (!isPlayerWalkCell(grid, nextGx, nextGy)) {
      this.cancelWalk(grid);
      return;
    }

    const dx = this.targetX - this.gridX;
    const dy = this.targetY - this.gridY;

    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      this.gridX = this.targetX;
      this.gridY = this.targetY;
      this.advanceWalkPath();
    } else {
      const step = (this.moveSpeed * deltaMs) / 1000;
      const prevGx = Math.round(this.gridX);
      const prevGy = Math.round(this.gridY);
      if (Math.abs(dx) >= Math.abs(dy)) {
        this.gridX += Math.sign(dx) * Math.min(step, Math.abs(dx));
      } else {
        this.gridY += Math.sign(dy) * Math.min(step, Math.abs(dy));
      }
      const steppedGx = Math.round(this.gridX);
      const steppedGy = Math.round(this.gridY);
      if (
        (steppedGx !== prevGx || steppedGy !== prevGy) &&
        !isPlayerWalkCell(grid, steppedGx, steppedGy)
      ) {
        this.gridX = prevGx;
        this.gridY = prevGy;
        this.cancelWalk(grid);
        return;
      }
    }

    this.syncTilePosition(grid);
  }

  /** Diamond center anchor — must not use gridToTileBottom */
  private syncTilePosition(grid: GridSystem): void {
    const center = grid.gridToPlayerTile(this.gridX, this.gridY);
    this.sprite.setPosition(center.x, center.y);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(
      grid.getDepth(Math.round(this.gridX), Math.round(this.gridY), 'entities')
    );
  }

  playFarmAction(
    action: PlayerFarmAction,
    durationMs = 500,
    onComplete?: () => void
  ): void {
    this.farmAction = action;
    this.actionTimer = durationMs;
    this.actionOnComplete = onComplete;
    const scene = this.sprite.scene;
    const tex = ACTION_TEXTURES[action];
    if (tex && scene.textures.exists(tex)) {
      if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
      this.sprite.setTexture(tex);
      fitSpriteDisplay(this.sprite, DISPLAY_SIZE.playerW, DISPLAY_SIZE.playerH);
      this.sprite.setOrigin(0.5, 1);
    } else {
      this.playActionTween();
    }
  }

  playActionTween(): void {
    const baseY = this.sprite.y;
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      y: baseY - 6,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  isBusyFarming(): boolean {
    return this.farmAction !== PlayerFarmAction.IDLE;
  }

  private applySpriteState(moving: boolean): void {
    this.sprite.setFlipX(false);
    const scene = this.sprite.scene;

    if (moving) {
      const animKey = WALK_ANIM[this.facing];
      if (this.walkAnimReady.has(animKey)) {
        const currentKey = this.sprite.anims.currentAnim?.key;
        if (currentKey !== animKey || !this.sprite.anims.isPlaying) {
          this.sprite.anims.play(animKey, true);
        }
      } else {
        const tex = walkTextureForFacing(scene, this.facing);
        if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
        if (this.sprite.texture.key !== tex) {
          this.sprite.setTexture(tex);
        }
      }
    } else {
      const tex = idleTextureForFacing(scene, this.facing);
      if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
      if (this.sprite.texture.key !== tex) {
        this.sprite.setTexture(tex);
      }
    }

    fitSpriteDisplay(this.sprite, DISPLAY_SIZE.playerW, DISPLAY_SIZE.playerH);
    this.sprite.setOrigin(0.5, 1);
  }

  getGridPosition(): { x: number; y: number } {
    return { x: Math.round(this.gridX), y: Math.round(this.gridY) };
  }

  isMoving(): boolean {
    return this.moving;
  }
}

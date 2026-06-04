import Phaser from 'phaser';
import type { CropId } from '../config/CropConfig';
import { getCropDef } from '../config/CropConfig';
import {
  resolveCropRenderStage,
  type CropRenderStage,
} from '../config/CropRenderConfig';
import { CropLifecycleState, isDebugMode } from '../config/gameConfig';
import type { FarmingSystem } from '../systems/FarmingSystem';
import {
  clearCropDebugOverlay,
  drawCropDebugOverlay,
  renderCrop,
  type CropDebugOverlayHandles,
} from '../systems/CropRenderer';
import type { GridSystem } from '../systems/GridSystem';
import { formatGrowthTime } from '../utils/iso';

export class CropSprite {
  sprite: Phaser.GameObjects.Image;
  private cropType: CropId;
  gridX: number;
  gridY: number;
  private waterIcon?: Phaser.GameObjects.Image;
  private progressBg?: Phaser.GameObjects.Rectangle;
  private progressFill?: Phaser.GameObjects.Rectangle;
  private timerText?: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private debugOverlay: CropDebugOverlayHandles = {};

  constructor(
    scene: Phaser.Scene,
    grid: GridSystem,
    gx: number,
    gy: number,
    cropType: CropId,
    textureKey: string,
    stage: CropLifecycleState,
    renderStage: CropRenderStage
  ) {
    this.gridX = gx;
    this.gridY = gy;
    this.cropType = cropType;
    const foot = grid.gridToTileBottom(gx, gy);
    this.sprite = scene.add.image(foot.x, foot.y, textureKey);
    this.applyLayout(grid, textureKey, stage, renderStage);
    this.sprite.disableInteractive();
  }

  private applyLayout(
    grid: GridSystem,
    textureKey: string,
    _stage: CropLifecycleState,
    renderStage: CropRenderStage
  ): void {
    this.sprite.setTexture(textureKey);
    // Re-bind frame without resetting origin/size; renderCrop sets scale from config.
    this.sprite.setFrame(this.sprite.frame.name, false, false);
    renderCrop(this.sprite, this.cropType, renderStage, this.gridX, this.gridY, grid);
    if (isDebugMode()) {
      this.debugOverlay = drawCropDebugOverlay(
        this.sprite.scene,
        grid,
        this.gridX,
        this.gridY,
        this.cropType,
        renderStage,
        this.debugOverlay,
        this.sprite
      );
    } else {
      clearCropDebugOverlay(this.debugOverlay);
    }
  }

  updateTexture(
    key: string,
    grid: GridSystem,
    cropType: CropId,
    stage: CropLifecycleState,
    renderStage: CropRenderStage
  ): void {
    this.cropType = cropType;
    this.applyLayout(grid, key, stage, renderStage);
  }

  /** Progress bar bottom edge above tile diamond top (px) */
  private static readonly BAR_ABOVE_TILE = 2;
  /** Timer text below bar top edge (px) */
  private static readonly TIMER_ABOVE_BAR = 6;

  private addSoilIdleDryIcon(
    scene: Phaser.Scene,
    x: number,
    y: number,
    depth: number,
    tint = 0xc0392b
  ): void {
    const iconKey = scene.textures.exists('watering_can') ? 'watering_can' : 'seed';
    this.waterIcon = scene.add.image(x, y, iconKey);
    this.waterIcon.setDisplaySize(14, 14);
    this.waterIcon.setTint(tint);
    this.waterIcon.disableInteractive();
    this.waterIcon.setDepth(depth);
    scene.tweens.add({
      targets: this.waterIcon,
      y: this.waterIcon.y - 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  updateOverlays(
    scene: Phaser.Scene,
    grid: GridSystem,
    farming: FarmingSystem
  ): void {
    const crop = farming.getCrop(this.gridX, this.gridY);
    const tileTop = grid.gridToMapScreen(this.gridX, this.gridY);
    const anchorX = tileTop.x;
    const tileTopY = tileTop.y;
    const depth = grid.getDepth(this.gridX, this.gridY, 'crops') + 20;

    this.waterIcon?.destroy();
    this.waterIcon = undefined;
    this.progressBg?.destroy();
    this.progressBg = undefined;
    this.progressFill?.destroy();
    this.progressFill = undefined;
    this.timerText?.destroy();
    this.timerText = undefined;
    this.debugText?.destroy();
    this.debugText = undefined;

    if (!crop) return;

    const info = farming.getGrowthInfo(crop);
    const growing = crop.stage !== CropLifecycleState.EMPTY &&
      crop.stage !== CropLifecycleState.HARVESTED &&
      crop.stage !== CropLifecycleState.DIGGING;

    const barW = 36;
    const barH = 4;
    const barY = tileTopY - CropSprite.BAR_ABOVE_TILE - barH / 2;
    const timerY = barY - barH / 2 - CropSprite.TIMER_ABOVE_BAR;

    if (crop.stage === CropLifecycleState.READY) {
      this.timerText = scene.add
        .text(anchorX, timerY, 'Ready', {
          fontSize: '10px',
          color: '#f1c40f',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(depth);
      this.timerText.disableInteractive();
      if (farming.isSoilIdleDry(this.gridX, this.gridY)) {
        this.addSoilIdleDryIcon(scene, anchorX, barY, depth);
      }
      return;
    }

    if (info && growing) {
      const bx = anchorX - barW / 2;
      const by = barY;

      this.progressBg = scene.add
        .rectangle(bx + barW / 2, by, barW, barH, 0x000000, 0.5)
        .setOrigin(0.5);
      this.progressBg.disableInteractive();
      this.progressBg.setDepth(depth);

      const growRatio = info.progress;
      const fillColor = info.slowGrowth ? 0xe67e22 : 0x27ae60;

      this.progressFill = scene.add
        .rectangle(bx + (barW * growRatio) / 2, by, barW * growRatio, barH - 1, fillColor, 0.9)
        .setOrigin(0, 0.5);
      this.progressFill.disableInteractive();
      this.progressFill.setDepth(depth + 1);

      const slowPct = Math.round(info.growthRate * 100);
      const timerLabel = info.slowGrowth
        ? `${formatGrowthTime(info.remainingSec)} (${slowPct}%)`
        : formatGrowthTime(info.remainingSec);
      this.timerText = scene.add
        .text(anchorX, timerY, timerLabel, {
          fontSize: '10px',
          color: info.slowGrowth ? '#e67e22' : '#ecf0f1',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(depth + 2);
      this.timerText.disableInteractive();

      if (info.needsWater || farming.isSoilIdleDry(this.gridX, this.gridY)) {
        this.addSoilIdleDryIcon(
          scene,
          anchorX + barW / 2 + 4,
          barY - 2,
          depth + 2,
          info.needsWater ? 0x3498db : 0xc0392b
        );
      }

      if (isDebugMode()) {
        const kind = crop.cropType ?? crop.kind;
        const def = kind ? getCropDef(kind) : null;
        this.debugText = scene.add
          .text(
            anchorX,
            timerY - CropSprite.TIMER_ABOVE_BAR - 2,
            `${crop.stage}\nW:${Math.round(info.waterLevel)} G:${Math.round(info.progress * 100)}%\n${Math.ceil(info.remainingSec)}s`,
            { fontSize: '9px', color: '#fff', backgroundColor: '#00000099', fontFamily: 'Arial' }
          )
          .setOrigin(0.5)
          .setDepth(depth + 3);
        if (def && info.slowGrowth) {
          const next =
            def.waterMilestonesSec[crop.wateredMilestoneCount ?? 0] ?? '—';
          this.debugText.setText(
            `${crop.stage} SLOW ${Math.round(info.growthRate * 100)}%\nneed water @ ${next}s / ${def.growTimeSec}s grow`
          );
        }
      }
    }
  }

  destroy(): void {
    clearCropDebugOverlay(this.debugOverlay);
    this.waterIcon?.destroy();
    this.progressBg?.destroy();
    this.progressFill?.destroy();
    this.timerText?.destroy();
    this.debugText?.destroy();
    this.sprite.destroy();
  }
}

export function cropKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

const VISIBLE_STAGES = new Set([
  CropLifecycleState.PLANTED,
  CropLifecycleState.STAGE1,
  CropLifecycleState.STAGE2,
  CropLifecycleState.STAGE3,
  CropLifecycleState.READY,
]);

export function syncCropSprites(
  scene: Phaser.Scene,
  grid: GridSystem,
  farming: FarmingSystem,
  sprites: Map<string, CropSprite>
): void {
  const activeKeys = new Set<string>();

  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      const crop = farming.getCrop(x, y);
      if (!crop || !VISIBLE_STAGES.has(crop.stage)) continue;

      const kind = crop.cropType ?? crop.kind;
      if (!kind) continue;

      const tex = farming.getTextureKey(crop);
      if (!tex) continue;

      const growth = farming.getGrowthInfo(crop);
      const renderStage = resolveCropRenderStage(crop.stage, growth?.visualStage);

      const k = cropKey(x, y);
      activeKeys.add(k);
      let cs = sprites.get(k);
      if (!cs) {
        cs = new CropSprite(scene, grid, x, y, kind, tex, crop.stage, renderStage);
        sprites.set(k, cs);
      } else {
        cs.updateTexture(tex, grid, kind, crop.stage, renderStage);
      }
      cs.updateOverlays(scene, grid, farming);
    }
  }

  for (const [k, cs] of sprites) {
    if (!activeKeys.has(k)) {
      cs.destroy();
      sprites.delete(k);
    }
  }
}

import Phaser from 'phaser';
import { getCropDef, type CropId } from '../config/CropConfig';
import type { GridSystem } from './GridSystem';
import type { CropSprite } from '../entities/Crop';

export function playDigDust(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number
): void {
  const center = grid.gridToTileCenter(gx, gy);
  const x = center.x;
  const y = center.y;
  const depth = grid.getDepth(gx, gy, 'crops') + 12;

  for (let i = 0; i < 5; i++) {
    const dust = scene.add.circle(x + Phaser.Math.Between(-12, 12), y, 4, 0x8d6e63, 0.7);
    dust.setDepth(depth);
    scene.tweens.add({
      targets: dust,
      x: dust.x + Phaser.Math.Between(-20, 20),
      y: dust.y - Phaser.Math.Between(8, 24),
      alpha: 0,
      scale: 0.3,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => dust.destroy(),
    });
  }
}

export function playPlantEffect(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number
): void {
  const center = grid.gridToTileCenter(gx, gy);
  const x = center.x;
  const y = center.y;
  const depth = grid.getDepth(gx, gy, 'crops') + 12;

  const seedIcon = scene.add.image(x, y + 8, 'seed');
  seedIcon.setDisplaySize(22, 22);
  seedIcon.setDepth(depth);
  scene.tweens.add({
    targets: seedIcon,
    y: y - 20,
    alpha: 0,
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 500,
    ease: 'Quad.easeOut',
    onComplete: () => seedIcon.destroy(),
  });

  const puff = scene.add.circle(x, y, 6, 0x7cb342, 0.5);
  puff.setDepth(depth - 1);
  scene.tweens.add({
    targets: puff,
    scaleX: 2.5,
    scaleY: 1.2,
    alpha: 0,
    duration: 350,
    ease: 'Quad.easeOut',
    onComplete: () => puff.destroy(),
  });
}

export function playWaterDrop(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number
): void {
  const center = grid.gridToTileCenter(gx, gy);
  const x = center.x;
  const y = center.y;
  const depth = grid.getDepth(gx, gy, 'crops') + 15;

  const hasIcon = scene.textures.exists('watering_can');
  for (let i = 0; i < 4; i++) {
    const drop = hasIcon
      ? scene.add.image(x + (i - 1.5) * 8, y, 'watering_can').setDisplaySize(10, 10)
      : scene.add.circle(x + (i - 1.5) * 8, y, 3, 0x3498db, 0.9);
    drop.setDepth(depth);
    scene.tweens.add({
      targets: drop,
      y: y + 28,
      alpha: 0,
      duration: 450 + i * 40,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}

export function playHarvestStar(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  cropSprite?: CropSprite
): void {
  const center = grid.gridToTileCenter(gx, gy);
  const x = center.x;
  const y = center.y;

  if (cropSprite) {
    scene.tweens.add({
      targets: cropSprite.sprite,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 350,
      ease: 'Back.easeIn',
    });
  }

  for (let i = 0; i < 6; i++) {
    const star = scene.add.star(x, y, 5, 3, 6, 0xf1c40f, 0.95);
    star.setDepth(grid.getDepth(gx, gy, 'crops') + 10);
    const angle = (Math.PI * 2 * i) / 6;
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * 28,
      y: y + Math.sin(angle) * 20 - 12,
      alpha: 0,
      scale: 0.2,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}

export function playCoinPop(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  coinReward: number
): void {
  const center = grid.gridToTileCenter(gx, gy);
  const x = center.x;
  const y = center.y;

  const floatText = scene.add
    .text(x, y - 24, `+${coinReward} 🪙`, {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial',
      stroke: '#000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(grid.getDepth(gx, gy, 'crops') + 20);

  scene.tweens.add({
    targets: floatText,
    y: y - 56,
    alpha: 0,
    duration: 900,
    ease: 'Cubic.easeOut',
    onComplete: () => floatText.destroy(),
  });

  if (scene.textures.exists('coin')) {
    const coinIcon = scene.add
      .image(x - 20, y, 'coin')
      .setDepth(grid.getDepth(gx, gy, 'crops') + 15);
    coinIcon.setScale(0.6);
    scene.tweens.add({
      targets: coinIcon,
      y: y - 48,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => coinIcon.destroy(),
    });
  }
}

export function playHarvestFloat(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  cropId: CropId,
  amount: number
): void {
  const name = getCropDef(cropId).name.toLowerCase();
  const center = grid.gridToTileCenter(gx, gy);
  const txt = scene.add
    .text(center.x, center.y - 24, `+${amount} ${name}`, {
      fontSize: '14px',
      color: '#a8e6cf',
      fontFamily: 'Arial',
      stroke: '#1a1a1a',
      strokeThickness: 2,
    })
    .setOrigin(0.5)
    .setDepth(grid.getDepth(gx, gy, 'crops') + 22);

  scene.tweens.add({
    targets: txt,
    y: center.y - 56,
    alpha: 0,
    duration: 1100,
    ease: 'Cubic.easeOut',
    onComplete: () => txt.destroy(),
  });
}

export function playHarvestEffects(
  scene: Phaser.Scene,
  grid: GridSystem,
  gx: number,
  gy: number,
  cropId: CropId,
  yieldAmt: number,
  cropSprite?: CropSprite
): void {
  playHarvestStar(scene, grid, gx, gy, cropSprite);
  playHarvestFloat(scene, grid, gx, gy, cropId, yieldAmt);
}

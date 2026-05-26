import Phaser from 'phaser';
import type { BuildingData } from '../config/gameConfig';
import type { GridSystem } from '../systems/GridSystem';
import { DISPLAY_SIZE, fitSpriteDisplay } from '../utils/iso';

export class BuildingSprite {
  sprite: Phaser.GameObjects.Sprite;
  data: BuildingData;

  constructor(scene: Phaser.Scene, grid: GridSystem, data: BuildingData) {
    this.data = data;
    const foot = grid.gridToTileBottom(data.gridX, data.gridY);
    this.sprite = scene.add.sprite(foot.x, foot.y, data.textureKey);
    this.sprite.setOrigin(0.5, 1);
    fitSpriteDisplay(this.sprite, DISPLAY_SIZE.tileW * 1.4, DISPLAY_SIZE.buildingH);
    this.sprite.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings'));
    if (data.level >= 3) this.sprite.setTint(0xffd699);
  }

  updateData(data: BuildingData, grid: GridSystem): void {
    this.data = data;
    this.sprite.setTexture(data.textureKey);
    fitSpriteDisplay(this.sprite, DISPLAY_SIZE.tileW * 1.4, DISPLAY_SIZE.buildingH);
    const foot = grid.gridToTileBottom(data.gridX, data.gridY);
    this.sprite.setPosition(foot.x, foot.y);
    if (data.level >= 3) this.sprite.setTint(0xffd699);
    else this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

export function renderBuildings(
  scene: Phaser.Scene,
  grid: GridSystem,
  buildings: BuildingData[],
  cache: Map<string, BuildingSprite>
): void {
  const keys = new Set<string>();
  for (const b of buildings) {
    const k = `${b.gridX},${b.gridY}`;
    keys.add(k);
    const existing = cache.get(k);
    if (!existing) {
      cache.set(k, new BuildingSprite(scene, grid, b));
    } else {
      existing.updateData(b, grid);
    }
  }
  for (const [k, spr] of cache) {
    if (!keys.has(k)) {
      spr.destroy();
      cache.delete(k);
    }
  }
}

import Phaser from 'phaser';
import { getLivestockPenTextureKeyForPen, type LivestockPenData } from '../config/LivestockConfig';
import { penFootprintTiles, penHouseDisplaySize } from '../config/livestockAssets';
import type { GridSystem } from '../systems/GridSystem';
import { DISPLAY_SIZE, fitSpriteDisplay, fitSpriteToIsoFootprint } from '../utils/iso';

const READY_TINT = 0xa8e6cf;

function resolvePenTexture(scene: Phaser.Scene, data: LivestockPenData): string {
  const key = getLivestockPenTextureKeyForPen(data, data.level);
  if (scene.textures.exists(key)) return key;
  return scene.textures.exists('coop_lv1') ? 'coop_lv1' : key;
}

function footprintLayout(grid: GridSystem, data: LivestockPenData) {
  const { w, h } = penFootprintTiles(data.level ?? 1);
  const screen = grid.getRectMapFootprintScreenBounds(data.gridX, data.gridY, w, h);
  const display = penHouseDisplaySize(data.level ?? 1, DISPLAY_SIZE.tileW, DISPLAY_SIZE.tileH);
  return { screen, display };
}

export class LivestockPenSprite {
  container: Phaser.GameObjects.Container;
  data: LivestockPenData;
  private penImage: Phaser.GameObjects.Image;
  private animalImage: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, grid: GridSystem, data: LivestockPenData) {
    this.data = data;
    const { screen, display } = footprintLayout(grid, data);
    this.container = scene.add.container(screen.centerX, screen.bottomY);

    const penKey = resolvePenTexture(scene, data);
    this.penImage = scene.add.image(0, 0, penKey).setOrigin(0.5, 1);
    this.layoutPenHouse(display.width, display.height);

    this.animalImage = scene.add.image(0, -display.height * 0.42, 'chicken_child');
    this.animalImage.setOrigin(0.5, 1);
    this.animalImage.setVisible(false);

    this.container.add([this.penImage, this.animalImage]);
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    this.applyStateVisual(scene);
  }

  updateData(data: LivestockPenData, grid: GridSystem, scene: Phaser.Scene): void {
    this.data = data;
    const { screen, display } = footprintLayout(grid, data);
    this.container.setPosition(screen.centerX, screen.bottomY);
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    const penKey = resolvePenTexture(scene, data);
    if (scene.textures.exists(penKey)) {
      this.penImage.setTexture(penKey);
    }
    this.layoutPenHouse(display.width, display.height);
    this.animalImage.setY(-display.height * 0.42);
    this.applyStateVisual(scene);
  }

  private layoutPenHouse(footprintWidth: number, footprintHeight: number): void {
    fitSpriteToIsoFootprint(this.penImage, footprintWidth, footprintHeight);
  }

  private applyStateVisual(scene: Phaser.Scene): void {
    if (this.data.state === 'unstocked') {
      this.penImage.setAlpha(0.85);
      this.animalImage.setVisible(false);
      this.penImage.clearTint();
      return;
    }
    this.penImage.setAlpha(1);
    const tex =
      this.data.animalTextureKey && scene.textures.exists(this.data.animalTextureKey)
        ? this.data.animalTextureKey
        : null;
    if (!tex) {
      this.animalImage.setVisible(false);
    } else {
      this.animalImage.setTexture(tex);
      this.animalImage.setVisible(true);
      fitSpriteDisplay(
        this.animalImage,
        DISPLAY_SIZE.tileW * 0.9,
        DISPLAY_SIZE.buildingH * 0.5
      );
    }
    if (this.data.state === 'ready') {
      this.penImage.setTint(READY_TINT);
    } else {
      this.penImage.clearTint();
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

export function renderLivestockPens(
  scene: Phaser.Scene,
  grid: GridSystem,
  pens: LivestockPenData[],
  cache: Map<string, LivestockPenSprite>
): void {
  const keys = new Set<string>();
  for (const p of pens) {
    keys.add(p.id);
    const existing = cache.get(p.id);
    if (!existing) {
      cache.set(p.id, new LivestockPenSprite(scene, grid, p));
    } else {
      existing.updateData(p, grid, scene);
    }
  }
  for (const [k, spr] of cache) {
    if (!keys.has(k)) {
      spr.destroy();
      cache.delete(k);
    }
  }
}

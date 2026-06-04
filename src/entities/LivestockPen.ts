import Phaser from 'phaser';
import {
  getLivestockPenTextureKeyForPen,
  type AnimalType,
  livestockPenCapacity,
  type LivestockPenData,
  type RuminantOccupantData,
} from '../config/LivestockConfig';
import {
  getLivestockAnimalRenderBox,
  lifecycleStateToTextureStage,
  penFootprintTiles,
  penHouseDisplaySize,
  penHouseYOffsetPx,
  resolveLivestockAnimalTextureKey,
} from '../config/livestockAssets';
import {
  LIVESTOCK_WARNING_TEXTURE_KEY,
  LIVESTOCK_WARNING_WIDTH_SCALE,
} from '../config/assets';
import {
  livestockRenderSlotPositions,
  visibleLivestockRenderCount,
} from '../config/livestockPenRenderSlots';
import type { GridSystem } from '../systems/GridSystem';
import { isRuminantPen, penStockCount } from '../systems/livestockLogic';
import { DISPLAY_SIZE, computeSpriteFitScale } from '../utils/iso';

const READY_TINT = 0xa8e6cf;
const HUNGRY_TINT = 0xffd3b0;

function resolvePenTexture(scene: Phaser.Scene, data: LivestockPenData): string {
  const key = getLivestockPenTextureKeyForPen(data, data.level);
  if (scene.textures.exists(key)) return key;
  return scene.textures.exists('coop_lv1') ? 'coop_lv1' : key;
}

function footprintLayout(grid: GridSystem, data: LivestockPenData) {
  const { w, h } = penFootprintTiles(data.level ?? 1);
  const screen = grid.getRectMapFootprintScreenBounds(data.gridX, data.gridY, w, h);
  const display = penHouseDisplaySize(
    data.level ?? 1,
    DISPLAY_SIZE.tileW,
    DISPLAY_SIZE.tileH,
    undefined,
    undefined,
    undefined,
    data.animalType
  );
  const yOffset = penHouseYOffsetPx(data.level ?? 1, DISPLAY_SIZE.tileW, DISPLAY_SIZE.tileH, data.animalType);
  return { screen, display, yOffset };
}

function snapToWholePixel(value: number): number {
  return Math.round(value);
}

function applyNearestTextureFilter(scene: Phaser.Scene, textureKey: string): void {
  const texture = scene.textures.get(textureKey);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function fitSpriteDisplayRounded(
  sprite: Phaser.GameObjects.Image,
  maxW: number,
  maxH: number
): void {
  // Prefer cut dimensions to avoid oversized transparent/source canvas artifacts.
  const frameW = sprite.frame.cutWidth || sprite.frame.width;
  const frameH = sprite.frame.cutHeight || sprite.frame.height;
  if (frameW <= 0 || frameH <= 0) return;
  const scale = computeSpriteFitScale(frameW, frameH, maxW, maxH, 'contain');
  const displayW = Math.max(1, Math.round(frameW * scale));
  const displayH = Math.max(1, Math.round(frameH * scale));
  sprite.setDisplaySize(displayW, displayH);
}

export class LivestockPenSprite {
  container: Phaser.GameObjects.Container;
  data: LivestockPenData;
  private penImage: Phaser.GameObjects.Image;
  private animalImages: Phaser.GameObjects.Image[] = [];
  private hungryWarningImage: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, grid: GridSystem, data: LivestockPenData) {
    this.data = data;
    const { screen, display, yOffset } = footprintLayout(grid, data);
    this.container = scene.add.container(
      snapToWholePixel(screen.centerX),
      snapToWholePixel(screen.bottomY + yOffset)
    );
    this.container.setAlpha(1);

    const penKey = resolvePenTexture(scene, data);
    applyNearestTextureFilter(scene, penKey);
    this.penImage = scene.add.image(0, 0, penKey).setOrigin(0.5, 1);
    this.hungryWarningImage = scene.add
      .image(0, 0, LIVESTOCK_WARNING_TEXTURE_KEY)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.layoutPenHouse(display.width, display.height);

    // Keep animals above house so stocked livestock remains visible in-pen.
    this.container.add([this.penImage, this.hungryWarningImage]);
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    this.applyStateVisual(scene);
  }

  updateData(data: LivestockPenData, grid: GridSystem, scene: Phaser.Scene): void {
    this.data = data;
    const { screen, display, yOffset } = footprintLayout(grid, data);
    this.container.setPosition(
      snapToWholePixel(screen.centerX),
      snapToWholePixel(screen.bottomY + yOffset)
    );
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    this.container.setAlpha(1);
    const penKey = resolvePenTexture(scene, data);
    if (scene.textures.exists(penKey)) {
      applyNearestTextureFilter(scene, penKey);
      this.penImage.setTexture(penKey);
    }
    this.layoutPenHouse(display.width, display.height);
    this.applyStateVisual(scene);
  }

  private layoutPenHouse(footprintWidth: number, footprintHeight: number): void {
    // Apply explicit visual box so X/Y pen-house scales are both visible.
    const displayW = Math.max(1, Math.round(footprintWidth));
    const displayH = Math.max(1, Math.round(footprintHeight));
    this.penImage.setDisplaySize(displayW, displayH);
    this.layoutHungryIndicator(displayW, displayH);
  }

  private layoutHungryIndicator(displayW: number, displayH: number): void {
    const warningHeight = Math.max(24, Math.round(Math.min(displayW, displayH) * 0.22 * 0.7));
    const warningWidth = Math.max(1, Math.round(warningHeight * LIVESTOCK_WARNING_WIDTH_SCALE));
    this.hungryWarningImage.setDisplaySize(warningWidth, warningHeight);
    this.hungryWarningImage.setPosition(0, -displayH - Math.round(warningHeight * 0.15));
  }

  private ensureAnimalImagePool(scene: Phaser.Scene, count: number): void {
    while (this.animalImages.length < count) {
      const image = scene.add.image(0, 0, 'chicken_child');
      image.setOrigin(0.5, 1);
      image.setAlpha(1);
      image.setVisible(false);
      this.animalImages.push(image);
      this.container.add(image);
    }
    for (let i = count; i < this.animalImages.length; i++) {
      this.animalImages[i]?.setVisible(false);
    }
  }

  private resolvedRuminantOccupants(): RuminantOccupantData[] {
    if (!isRuminantPen(this.data)) return [];
    const normalized = (this.data.ruminantOccupants ?? [])
      .filter((o): o is RuminantOccupantData => !!o && (o.animalType === 'goat' || o.animalType === 'sheep'))
      .sort((a, b) => (a.animalType === b.animalType ? 0 : a.animalType === 'goat' ? -1 : 1));
    if (normalized.length > 0) return normalized;
    if (this.data.state === 'unstocked') return [];
    if (this.data.animalType === 'goat' || this.data.animalType === 'sheep') {
      return [
        {
          animalType: this.data.animalType,
          stage: this.data.stage,
          variant: this.data.variant,
          animalTextureKey: this.data.animalTextureKey,
        },
      ];
    }
    return [];
  }

  private resolvedRenderSlots(): Array<{
    animalType: AnimalType;
    stage?: RuminantOccupantData['stage'];
    variant?: RuminantOccupantData['variant'];
    animalTextureKey?: string;
  }> {
    const count = visibleLivestockRenderCount(
      penStockCount(this.data),
      livestockPenCapacity(this.data.level ?? 1)
    );
    if (count <= 0) return [];
    if (isRuminantPen(this.data)) {
      const occupants = this.resolvedRuminantOccupants();
      if (occupants.length >= count) return occupants.slice(0, count);
      const fallback = occupants[0] ?? {
        animalType: this.data.animalType === 'goat' ? 'goat' : 'sheep',
        stage: this.data.stage,
        variant: this.data.variant,
        animalTextureKey: this.data.animalTextureKey,
      };
      return Array.from({ length: count }, (_, i) => occupants[i] ?? fallback);
    }
    return Array.from({ length: count }, () => ({
      animalType: this.data.animalType,
      stage: this.data.stage,
      variant: this.data.variant,
      animalTextureKey: this.data.animalTextureKey,
    }));
  }

  private applyStateVisual(scene: Phaser.Scene): void {
    this.container.setAlpha(1);
    this.penImage.setAlpha(1);
    for (const image of this.animalImages) image.setAlpha(1);
    if (this.data.state === 'unstocked') {
      for (const image of this.animalImages) image.setVisible(false);
      this.hungryWarningImage.setVisible(false);
      this.penImage.clearTint();
      return;
    }
    this.penImage.setAlpha(1);
    const slots = this.resolvedRenderSlots();
    this.ensureAnimalImagePool(scene, slots.length);
    const positions = livestockRenderSlotPositions(
      slots.length,
      this.penImage.displayWidth,
      this.penImage.displayHeight,
      this.data.animalType
    );
    for (let i = 0; i < slots.length; i++) {
      const image = this.animalImages[i];
      const slot = slots[i];
      const pos = positions[i];
      if (!image || !slot || !pos) continue;
      const mappedStage = lifecycleStateToTextureStage(this.data.lifecycleState, slot.stage ?? 'adult');
      const mappedTexture = resolveLivestockAnimalTextureKey(
        slot.animalType,
        mappedStage,
        slot.variant ?? 0
      );
      const tex = scene.textures.exists(mappedTexture)
        ? mappedTexture
        : slot.animalTextureKey && scene.textures.exists(slot.animalTextureKey)
          ? slot.animalTextureKey
          : null;
      if (!tex) {
        image.setVisible(false);
        continue;
      }
      image.setTexture(tex);
      applyNearestTextureFilter(scene, tex);
      const box = getLivestockAnimalRenderBox(slot.animalType, mappedStage);
      fitSpriteDisplayRounded(image, box.width, box.height);
      image.setPosition(snapToWholePixel(pos.x), snapToWholePixel(pos.y));
      image.setVisible(true);
    }
    if (this.data.lifecycleState === 'hungry') {
      this.penImage.setTint(HUNGRY_TINT);
    } else if (this.data.state === 'ready') {
      this.penImage.setTint(READY_TINT);
    } else {
      this.penImage.clearTint();
    }
    this.hungryWarningImage.setVisible(
      this.data.lifecycleState === 'hungry' && this.container.visible && scene.textures.exists(LIVESTOCK_WARNING_TEXTURE_KEY)
    );
  }

  destroy(): void {
    this.container.destroy();
  }

  getHouseBounds(): Phaser.Geom.Rectangle {
    return this.penImage.getBounds();
  }

  isHungryWarningVisibleForTest(): boolean {
    return this.hungryWarningImage.visible;
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

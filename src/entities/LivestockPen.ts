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
  penHouseFootprintLayout,
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
import {
  getLivestockTimerInfoForSlot,
  isRuminantPen,
  penStockCount,
  tickLivestockPen,
} from '../systems/livestockLogic';
import type { AnimalLifecycleState } from '../config/LivestockConfig';
import { computeSpriteFitScale } from '../utils/iso';

const BAR_W = 36;
const BAR_H = 4;
const BAR_ABOVE_ANIMAL = 2;
const TIMER_ABOVE_BAR = 6;

function resolvePenTexture(scene: Phaser.Scene, data: LivestockPenData): string {
  const key = getLivestockPenTextureKeyForPen(data, data.level);
  if (scene.textures.exists(key)) return key;
  return scene.textures.exists('coop_lv1') ? 'coop_lv1' : key;
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
  private progressBgs: Phaser.GameObjects.Rectangle[] = [];
  private progressFills: Phaser.GameObjects.Rectangle[] = [];
  private timerTexts: Phaser.GameObjects.Text[] = [];
  private hungryWarningImage: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, grid: GridSystem, data: LivestockPenData) {
    this.data = data;
    const layout = penHouseFootprintLayout(
      grid,
      data.gridX,
      data.gridY,
      data.level ?? 1,
      data.animalType
    );
    this.container = scene.add.container(
      snapToWholePixel(layout.x),
      snapToWholePixel(layout.y)
    );
    this.container.setAlpha(1);

    const penKey = resolvePenTexture(scene, data);
    applyNearestTextureFilter(scene, penKey);
    this.penImage = scene.add.image(0, 0, penKey).setOrigin(0.5, 1);
    this.hungryWarningImage = scene.add
      .image(0, 0, LIVESTOCK_WARNING_TEXTURE_KEY)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.layoutPenHouse(layout.displayWidth, layout.displayHeight);

    // Keep animals above house so stocked livestock remains visible in-pen.
    this.container.add([this.penImage, this.hungryWarningImage]);
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    this.applyStateVisual(scene);
    this.updateOverlays(scene);
  }

  updateData(data: LivestockPenData, grid: GridSystem, scene: Phaser.Scene): void {
    this.data = data;
    const layout = penHouseFootprintLayout(
      grid,
      data.gridX,
      data.gridY,
      data.level ?? 1,
      data.animalType
    );
    this.container.setPosition(snapToWholePixel(layout.x), snapToWholePixel(layout.y));
    this.container.setDepth(grid.getDepth(data.gridX, data.gridY, 'buildings') + 2);
    this.container.setAlpha(1);
    const penKey = resolvePenTexture(scene, data);
    if (scene.textures.exists(penKey)) {
      applyNearestTextureFilter(scene, penKey);
      this.penImage.setTexture(penKey);
    }
    this.layoutPenHouse(layout.displayWidth, layout.displayHeight);
    this.applyStateVisual(scene);
    this.updateOverlays(scene);
  }

  updateOverlays(scene: Phaser.Scene, nowMs: number = Date.now()): void {
    this.clearGrowthOverlays();
    if (this.data.state === 'unstocked') return;

    const slots = this.resolvedRenderSlots();
    if (slots.length === 0) return;

    const tickedPen = tickLivestockPen(this.data, nowMs);

    const positions = livestockRenderSlotPositions(
      slots.length,
      this.penImage.displayWidth,
      this.penImage.displayHeight,
      this.data.animalType
    );

    this.ensureGrowthOverlayPools(scene, slots.length);

    for (let i = 0; i < slots.length; i++) {
      const pos = positions[i];
      const slot = slots[i];
      if (!pos || !slot) continue;
      const timerInfo = getLivestockTimerInfoForSlot(tickedPen, i, nowMs);
      if (!timerInfo) continue;
      const mappedStage = lifecycleStateToTextureStage(
        slot.lifecycleState ?? this.data.lifecycleState,
        slot.stage ?? 'adult'
      );
      const box = getLivestockAnimalRenderBox(slot.animalType, mappedStage);
      const anchorX = snapToWholePixel(pos.x);
      const animalTopY = snapToWholePixel(pos.y - box.height);
      const barY = animalTopY - BAR_ABOVE_ANIMAL - BAR_H / 2;
      const timerY = barY - BAR_H / 2 - TIMER_ABOVE_BAR;

      const bg = this.progressBgs[i];
      const fill = this.progressFills[i];
      const text = this.timerTexts[i];
      if (!bg || !fill || !text) continue;

      const ratio = Math.max(0, Math.min(1, timerInfo.hungerProgress));
      const fillColor =
        timerInfo.kind === 'hungry' || ratio <= 0.25
          ? 0xc0392b
          : ratio <= 0.5
            ? 0xe67e22
            : 0x27ae60;

      bg.setPosition(anchorX, barY);
      bg.setSize(BAR_W, BAR_H);
      bg.setVisible(true);

      const fillW = Math.max(0, Math.round(BAR_W * ratio));
      fill.setPosition(anchorX - BAR_W / 2, barY);
      fill.setSize(fillW, BAR_H - 1);
      fill.setFillStyle(fillColor, 0.9);
      fill.setVisible(fillW > 0);

      const label = timerInfo.growthTimeText;
      if (!label) {
        text.setVisible(false);
      } else {
        text.setText(label);
        text.setColor(timerInfo.kind === 'ready' ? '#f1c40f' : '#ecf0f1');
        text.setFontStyle(timerInfo.kind === 'ready' ? 'bold' : '');
        text.setPosition(anchorX, timerY);
        text.setVisible(true);
      }
    }
  }

  private clearGrowthOverlays(): void {
    for (const bg of this.progressBgs) bg.setVisible(false);
    for (const fill of this.progressFills) fill.setVisible(false);
    for (const text of this.timerTexts) text.setVisible(false);
  }

  private ensureGrowthOverlayPools(scene: Phaser.Scene, count: number): void {
    while (this.progressBgs.length < count) {
      const bg = scene.add.rectangle(0, 0, BAR_W, BAR_H, 0x000000, 0.5).setOrigin(0.5);
      bg.disableInteractive();
      this.progressBgs.push(bg);
      this.container.add(bg);
    }
    while (this.progressFills.length < count) {
      const fill = scene.add.rectangle(0, 0, 1, BAR_H - 1, 0x27ae60, 0.9).setOrigin(0, 0.5);
      fill.disableInteractive();
      this.progressFills.push(fill);
      this.container.add(fill);
    }
    while (this.timerTexts.length < count) {
      const text = scene.add
        .text(0, 0, '', {
          fontSize: '10px',
          color: '#ecf0f1',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1);
      text.disableInteractive();
      this.timerTexts.push(text);
      this.container.add(text);
    }
    for (let i = count; i < this.progressBgs.length; i++) {
      this.progressBgs[i]?.setVisible(false);
      this.progressFills[i]?.setVisible(false);
      this.timerTexts[i]?.setVisible(false);
    }
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
    lifecycleState?: AnimalLifecycleState;
    growthStartAt?: number;
    growthDurationMs?: number;
    productionProgressMs?: number;
    hungerSinceFeedMs?: number;
    hungrySince?: number;
    happiness?: number;
    lastUpdatedAt?: number;
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
        lifecycleState: this.data.lifecycleState,
        growthStartAt: this.data.growthStartAt,
        growthDurationMs: this.data.growthDurationMs,
        productionProgressMs: this.data.productionProgressMs,
        hungerSinceFeedMs: this.data.hungerSinceFeedMs,
        hungrySince: this.data.hungrySince,
        happiness: this.data.happiness,
        lastUpdatedAt: this.data.lastUpdatedAt,
      };
      return Array.from({ length: count }, (_, i) => occupants[i] ?? fallback);
    }
    const penAnimals = this.data.penAnimals;
    if (penAnimals && penAnimals.length > 0) {
      return penAnimals.slice(0, count);
    }
    return Array.from({ length: count }, () => ({
      animalType: this.data.animalType,
      stage: this.data.stage,
      variant: this.data.variant,
      animalTextureKey: this.data.animalTextureKey,
      lifecycleState: this.data.lifecycleState,
      growthStartAt: this.data.growthStartAt,
      growthDurationMs: this.data.growthDurationMs,
      productionProgressMs: this.data.productionProgressMs,
      hungerSinceFeedMs: this.data.hungerSinceFeedMs,
      hungrySince: this.data.hungrySince,
      happiness: this.data.happiness,
      lastUpdatedAt: this.data.lastUpdatedAt,
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
      const mappedStage = lifecycleStateToTextureStage(
        slot.lifecycleState ?? this.data.lifecycleState,
        slot.stage ?? 'adult'
      );
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
    this.penImage.clearTint();
    const anyHungry = slots.some((s) => s.lifecycleState === 'hungry');
    this.hungryWarningImage.setVisible(
      anyHungry && this.container.visible && scene.textures.exists(LIVESTOCK_WARNING_TEXTURE_KEY)
    );
  }

  destroy(): void {
    for (const bg of this.progressBgs) bg.destroy();
    for (const fill of this.progressFills) fill.destroy();
    for (const text of this.timerTexts) text.destroy();
    this.progressBgs.length = 0;
    this.progressFills.length = 0;
    this.timerTexts.length = 0;
    this.container.destroy();
  }

  getHouseBounds(): Phaser.Geom.Rectangle {
    return this.penImage.getBounds();
  }

  /** World-space hit test for a visible animal sprite in this pen. */
  pickAnimalSlotAtWorldPoint(worldX: number, worldY: number): number | undefined {
    const hits: Array<{ slot: number; depth: number }> = [];
    for (let i = 0; i < this.animalImages.length; i++) {
      const image = this.animalImages[i];
      if (!image?.visible) continue;
      const bounds = image.getBounds();
      if (bounds.width <= 0 || bounds.height <= 0) continue;
      if (
        worldX >= bounds.x &&
        worldX <= bounds.x + bounds.width &&
        worldY >= bounds.y &&
        worldY <= bounds.y + bounds.height
      ) {
        hits.push({ slot: i, depth: image.depth });
      }
    }
    if (hits.length === 0) return undefined;
    hits.sort((a, b) => b.depth - a.depth || b.slot - a.slot);
    return hits[0]?.slot;
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

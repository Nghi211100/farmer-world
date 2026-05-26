import Phaser from 'phaser';
import { CROP_IDS, CROPS, CROP_UI_ICON_KEYS, type CropId } from '../config/CropConfig';
import { CROP_TO_SEED } from '../config/gameConfig';
import type { GridSystem } from '../systems/GridSystem';
import type { InventorySystem } from '../systems/InventorySystem';
import { placePopupAboveTile } from '../utils/popupPosition';
import { applyImageArtRegionStretch } from './ShopPanel';
import { assertFarmPopupLayoutAligned } from './FarmActionPopup';
import {
  TOOL_MODAL_ART_H,
  TOOL_MODAL_ART_W,
  TOOL_MODAL_VISUAL_SCALE,
  toolModalFrameDisplaySize,
  toolModalPanelRects,
  toolModalPanelSize,
  toolModalTextureCrop,
  TOOL_MODAL_SEED_QTY_OFFSET_ABOVE_HIT_TOP_REF_PX,
} from './toolModalLayout';

const TOOL_MODAL_BG_KEY = 'ui_tool_modal';

/** Semi-transparent dim outside the modal; game stays visible underneath. */
const DIM_BACKDROP_ALPHA = 0.4;

const LABEL_COLOR_ENABLED = '#ecf0f1';
const LABEL_COLOR_DISABLED = '#7f8c8d';
const QTY_COLOR_ENABLED = '#f1c40f';
const QTY_COLOR_DISABLED = '#e74c3c';

export interface CropSelectPopupLayoutMetrics {
  panelLeft: number;
  panelTop: number;
  panelW: number;
  panelH: number;
  bgW: number;
  bgH: number;
  slotGridLeft: number;
  slotGridTop: number;
  slotGridW: number;
  slotGridH: number;
  iconY: number;
  seedCount: number;
}

/** Runtime bg/icon bounds vs logical layout (e2e visual checks). */
export interface CropSelectPopupVisualMetrics {
  logicalPanelW: number;
  logicalPanelH: number;
  bgDisplayW: number;
  bgDisplayH: number;
  bgBoundsW: number;
  bgBoundsH: number;
  containerScaleX: number;
  containerScaleY: number;
  viewportW: number;
  viewportH: number;
  textureW: number;
  textureH: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export class CropSelectPopup {
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private lastLayout?: CropSelectPopupLayoutMetrics;
  private visible = false;
  private onSelect?: (cropId: CropId, seedId: string) => void;
  private onDismiss?: () => void;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private scene: Phaser.Scene,
    private grid: GridSystem
  ) {
    const { width, height } = scene.scale;
    this.backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(11850);
    this.resetBackdrop();

    this.container = scene.add.container(0, 0, []);
    this.container.setDepth(11950);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  setOnSelect(cb: (cropId: CropId, seedId: string) => void): void {
    this.onSelect = cb;
  }

  setOnDismiss(cb: () => void): void {
    this.onDismiss = cb;
  }

  getLayoutMetricsForTest(): CropSelectPopupLayoutMetrics | null {
    return this.visible ? (this.lastLayout ?? null) : null;
  }

  getVisualMetricsForTest(): CropSelectPopupVisualMetrics | null {
    if (!this.visible || !this.lastLayout) return null;
    const bg = this.container.list.find(
      (obj): obj is Phaser.GameObjects.Image => obj instanceof Phaser.GameObjects.Image
    );
    const bounds = bg?.getBounds();
    return {
      logicalPanelW: this.lastLayout.panelW,
      logicalPanelH: this.lastLayout.panelH,
      bgDisplayW: bg?.displayWidth ?? 0,
      bgDisplayH: bg?.displayHeight ?? 0,
      bgBoundsW: bounds?.width ?? 0,
      bgBoundsH: bounds?.height ?? 0,
      containerScaleX: this.container.scaleX,
      containerScaleY: this.container.scaleY,
      viewportW: this.scene.scale.width,
      viewportH: this.scene.scale.height,
      textureW: bg?.frame.width ?? 0,
      textureH: bg?.frame.height ?? 0,
      cropX: bg?.frame.cutX ?? 0,
      cropY: bg?.frame.cutY ?? 0,
      cropW: bg?.frame.cutWidth ?? 0,
      cropH: bg?.frame.cutHeight ?? 0,
    };
  }

  show(gx: number, gy: number, inventory: InventorySystem): void {
    this.hide(false);

    const crops = CROP_IDS;
    const { width: viewportW, height: viewportH } = this.scene.scale;
    const { panelW, panelH, scale, panelShiftY } = toolModalPanelSize(viewportW, viewportH);
    const { cx, cy: anchorCy } = placePopupAboveTile(this.scene, this.grid, gx, gy, {
      panelW,
      panelH,
      aboveOffsetPx: 12,
      anchorTop: true,
    });
    const cy = anchorCy + panelShiftY;

    const panelLeft = cx - panelW / 2;
    const panelTop = cy - panelH / 2;
    const layout = toolModalPanelRects(panelLeft, panelTop, panelW, panelH, scale);
    const { slotLeft, slotTop, slotW, slotH, iconY, iconHitSizePx, iconDisplaySizePx } = layout;
    const colW = slotW / crops.length;

    const { w: bgW, h: bgH } = toolModalFrameDisplaySize(panelW, panelH);
    this.lastLayout = {
      panelLeft,
      panelTop,
      panelW,
      panelH,
      bgW,
      bgH,
      slotGridLeft: slotLeft,
      slotGridTop: slotTop,
      slotGridW: slotW,
      slotGridH: slotH,
      iconY,
      seedCount: crops.length,
    };

    this.container.setPosition(cx, cy);
    this.container.setScale(TOOL_MODAL_VISUAL_SCALE);

    const rel = (screenX: number, screenY: number) => ({
      x: (screenX - cx) / TOOL_MODAL_VISUAL_SCALE,
      y: (screenY - cy) / TOOL_MODAL_VISUAL_SCALE,
    });

    if (this.scene.textures.exists(TOOL_MODAL_BG_KEY)) {
      const tex = this.scene.textures.get(TOOL_MODAL_BG_KEY).get();
      const texW = tex.width || TOOL_MODAL_ART_W;
      const texH = tex.height || TOOL_MODAL_ART_H;
      const textureCrop = toolModalTextureCrop(texW, texH);
      const bg = this.scene.add
        .image(0, 0, TOOL_MODAL_BG_KEY)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
      applyImageArtRegionStretch(
        bg,
        textureCrop.x,
        textureCrop.y,
        textureCrop.width,
        textureCrop.height,
        bgW,
        bgH
      );
      this.container.add(bg);
      this.container.setSize(bgW, bgH);

      const panelBlocker = this.scene.add
        .rectangle(0, 0, bgW, bgH, 0x000000, 0.001)
        .setScrollFactor(0);
      panelBlocker.setInteractive();
      panelBlocker.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
        }
      );
      this.container.add(panelBlocker);
      this.hitTargets.push(panelBlocker);
    }

    const labelFontPx = Math.max(6, Math.round(7 * scale));
    const qtyFontPx = Math.max(7, Math.round(9 * scale));
    const labelOffsetY = Math.round(iconDisplaySizePx * 0.55);
    const qtyAboveHitTopPx = Math.round(TOOL_MODAL_SEED_QTY_OFFSET_ABOVE_HIT_TOP_REF_PX * scale);

    crops.forEach((cropId, i) => {
      const def = CROPS[cropId];
      const seedId = CROP_TO_SEED[cropId];
      const seedCount = inventory.getCount(seedId);
      const enabled = seedCount > 0;
      const screenX = slotLeft + colW * (i + 0.5);
      const { x, y: iconRelY } = rel(screenX, iconY);
      const iconKey = this.scene.textures.exists(CROP_UI_ICON_KEYS[cropId])
        ? CROP_UI_ICON_KEYS[cropId]
        : 'seed';

      const hit = this.scene.add
        .rectangle(x, iconRelY, iconHitSizePx, iconHitSizePx, 0x000000, 0.001)
        .setScrollFactor(0);
      if (enabled) {
        hit.setInteractive({ useHandCursor: true });
        hit.on(
          'pointerdown',
          (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.hide(false);
            this.onSelect?.(cropId, seedId);
          }
        );
      }

      const icon = this.scene.add.image(x, iconRelY, iconKey).setScrollFactor(0);
      icon.setDisplaySize(iconDisplaySizePx, iconDisplaySizePx);
      if (!enabled) icon.setAlpha(0.45);

      const labelY = iconRelY + labelOffsetY;
      const label = this.scene.add
        .text(x, labelY, def.name, {
          fontSize: `${labelFontPx}px`,
          color: enabled ? LABEL_COLOR_ENABLED : LABEL_COLOR_DISABLED,
          fontFamily: 'Arial',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0);

      const qtyX = x + iconHitSizePx / 2 - 2;
      const qtyY = iconRelY - iconHitSizePx / 2 - qtyAboveHitTopPx;
      const countLabel = this.scene.add
        .text(qtyX, qtyY, String(seedCount), {
          fontSize: `${qtyFontPx}px`,
          color: enabled ? QTY_COLOR_ENABLED : QTY_COLOR_DISABLED,
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
        .setScrollFactor(0);

      this.container.add([hit, icon, label, countLabel]);
      this.hitTargets.push(hit, icon, label, countLabel);
    });

    this.enableBackdrop();
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.container.removeAll(true);
    this.hitTargets = [];
    this.lastLayout = undefined;
    this.container.setPosition(0, 0);
    this.container.setScale(1);
    this.container.setVisible(false);
    this.resetBackdrop();
    this.visible = false;
    if (wasVisible && notify) this.onDismiss?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** True when the pointer hits the crop bar / buttons (not the dismiss backdrop). */
  hitsPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    const hits = this.scene.input.hitTestPointer(pointer);
    return hits.some(
      (obj) =>
        obj !== this.backdrop &&
        (this.hitTargets.includes(obj) ||
          (obj.parentContainer != null && obj.parentContainer === this.container))
    );
  }

  hitsBackdrop(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    return this.scene.input.hitTestPointer(pointer).includes(this.backdrop);
  }

  private enableBackdrop(): void {
    const { width, height } = this.scene.scale;
    this.backdrop.setPosition(width / 2, height / 2);
    this.backdrop.setSize(width, height);
    this.backdrop.setFillStyle(0x000000, DIM_BACKDROP_ALPHA);
    this.backdrop.setVisible(true);
    this.backdrop.setInteractive();
    this.backdrop.removeAllListeners('pointerdown');
    this.backdrop.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.hide();
      }
    );
  }

  private resetBackdrop(): void {
    if (this.backdrop.input) {
      this.backdrop.disableInteractive();
    }
    this.backdrop.setFillStyle(0x000000, 0);
    this.backdrop.setVisible(false);
  }

  destroy(): void {
    this.hide(false);
    this.backdrop.destroy();
    this.container.destroy();
  }
}

/** Layout alignment checks shared with e2e tests. */
export function assertCropSelectPopupLayoutAligned(
  layout: CropSelectPopupLayoutMetrics,
  tolerancePx = 1
): { ok: boolean; errors: string[] } {
  return assertFarmPopupLayoutAligned(layout, tolerancePx);
}

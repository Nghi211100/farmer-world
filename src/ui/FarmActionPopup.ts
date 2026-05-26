import Phaser from 'phaser';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';
import { applyImageArtRegionStretch } from './ShopPanel';
import {
  TOOL_MODAL_ART_H,
  TOOL_MODAL_ART_W,
  TOOL_MODAL_VISUAL_SCALE,
  toolModalFrameDisplaySize,
  toolModalPanelRects,
  toolModalPanelSize,
  toolModalTextureCrop,
} from './toolModalLayout';

const TOOL_MODAL_BG_KEY = 'ui_tool_modal';

export type FarmPopupAction = 'plant' | 'water' | 'harvest' | 'dig';

export interface FarmActionPopupOptions {
  canPlant: boolean;
  canWater: boolean;
  canHarvest: boolean;
  canDig: boolean;
}

export interface FarmActionPopupLayoutMetrics {
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
}

/** Runtime bg/icon bounds vs logical layout (e2e visual checks). */
export interface FarmActionPopupVisualMetrics {
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

const BUTTONS: { id: FarmPopupAction; icon: string; title: string }[] = [
  { id: 'dig', icon: 'shovel', title: 'Hoe' },
  { id: 'plant', icon: 'seed', title: 'Plant' },
  { id: 'water', icon: 'watering_can', title: 'Water' },
  { id: 'harvest', icon: 'harvest', title: 'Harvest' },
];

/** Semi-transparent dim outside the modal; game stays visible underneath. */
const DIM_BACKDROP_ALPHA = 0.4;

const LAYOUT_TOLERANCE_PX = 1;

export class FarmActionPopup {
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private lastLayout?: FarmActionPopupLayoutMetrics;
  private visible = false;
  private onAction?: (action: FarmPopupAction, gx: number, gy: number) => void;
  private tileGx = 0;
  private tileGy = 0;
  private onDismiss?: () => void;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, private grid: GridSystem) {
    const { width, height } = scene.scale;
    this.backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(11800);
    this.resetBackdrop();

    this.container = scene.add.container(0, 0, []);
    this.container.setDepth(11900);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  setOnAction(cb: (action: FarmPopupAction, gx: number, gy: number) => void): void {
    this.onAction = cb;
  }

  setOnDismiss(cb: () => void): void {
    this.onDismiss = cb;
  }

  getLayoutMetricsForTest(): FarmActionPopupLayoutMetrics | null {
    return this.visible ? (this.lastLayout ?? null) : null;
  }

  getVisualMetricsForTest(): FarmActionPopupVisualMetrics | null {
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

  show(gx: number, gy: number, options: FarmActionPopupOptions): void {
    this.hide(false);
    this.tileGx = gx;
    this.tileGy = gy;

    const enabledMap: Record<FarmPopupAction, boolean> = {
      plant: options.canPlant,
      water: options.canWater,
      harvest: options.canHarvest,
      dig: options.canDig,
    };

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
    const colW = slotW / BUTTONS.length;

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
    }

    BUTTONS.forEach((btn, i) => {
      const screenX = slotLeft + colW * (i + 0.5);
      const { x, y } = rel(screenX, iconY);
      const enabled = enabledMap[btn.id];

      const hit = this.scene.add
        .rectangle(x, y, iconHitSizePx, iconHitSizePx, 0x000000, 0.001)
        .setScrollFactor(0);
      if (enabled) {
        hit.setInteractive({ useHandCursor: true });
        hit.on(
          'pointerdown',
          (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.hide(false);
            this.onAction?.(btn.id, this.tileGx, this.tileGy);
          }
        );
      }

      const iconKey = this.scene.textures.exists(btn.icon) ? btn.icon : 'seed';
      const icon = this.scene.add.image(x, y, iconKey).setScrollFactor(0);
      icon.setDisplaySize(iconDisplaySizePx, iconDisplaySizePx);
      if (!enabled) icon.setAlpha(0.45);

      this.container.add([hit, icon]);
      this.hitTargets.push(hit, icon);
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
    this.visible = false;
    this.resetBackdrop();
    if (wasVisible && notify) this.onDismiss?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** True when the pointer hits the action bar / buttons (not the dismiss backdrop). */
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

/** Layout alignment checks shared with e2e tests (icons-only popup). */
export function assertFarmPopupLayoutAligned(
  layout: FarmActionPopupLayoutMetrics,
  tolerancePx = LAYOUT_TOLERANCE_PX
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const tol = tolerancePx;

  const near = (a: number, b: number) => Math.abs(a - b) <= tol;

  const gridRight = layout.slotGridLeft + layout.slotGridW;
  const gridBottom = layout.slotGridTop + layout.slotGridH;
  const panelRight = layout.panelLeft + layout.panelW;
  const panelBottom = layout.panelTop + layout.panelH;

  if (layout.slotGridLeft < layout.panelLeft - tol) {
    errors.push('slot grid overflows left of panel');
  }
  if (layout.slotGridTop < layout.panelTop - tol) {
    errors.push('slot grid overflows top of panel');
  }
  if (gridRight > panelRight + tol) {
    errors.push('slot grid overflows right of panel');
  }
  if (gridBottom > panelBottom + tol) {
    errors.push('slot grid overflows bottom of panel');
  }

  const iconRowCenter = layout.slotGridTop + layout.slotGridH / 2;
  if (!near(layout.iconY, iconRowCenter)) {
    errors.push(`iconY ${layout.iconY} != slot row center ${iconRowCenter}`);
  }

  return { ok: errors.length === 0, errors };
}

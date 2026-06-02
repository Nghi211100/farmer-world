import Phaser from 'phaser';
import {
  UI_OBJECT_MOVE_TEXTURE_KEY,
  UI_OBJECT_REMOVE_TEXTURE_KEY,
} from '../config/assets';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';

export type ObjectEditAction = 'move' | 'remove';

const PANEL_DEPTH = 11940;
const BTN_SIZE = Math.round(44 * (2 / 3));
const BTN_GAP = 12;
const PANEL_W = BTN_SIZE * 2 + BTN_GAP;
const PANEL_H = BTN_SIZE;
const ABOVE_OFFSET_PX = 48;

type ButtonVisual = {
  root: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
};

/** Move / Remove actions above a clicked building or natural object. */
export class ObjectEditPopup {
  private container: Phaser.GameObjects.Container;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private tileGx = 0;
  private tileGy = 0;
  private onAction?: (action: ObjectEditAction, gx: number, gy: number) => void;
  private onDismiss?: () => void;

  constructor(
    private scene: Phaser.Scene,
    private grid: GridSystem
  ) {
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(PANEL_DEPTH);
    this.container.setVisible(false);
  }

  setOnAction(cb: (action: ObjectEditAction, gx: number, gy: number) => void): void {
    this.onAction = cb;
  }

  setOnDismiss(cb: () => void): void {
    this.onDismiss = cb;
  }

  show(gx: number, gy: number, options?: { hideRemove?: boolean }): void {
    this.hide(false);
    this.tileGx = gx;
    this.tileGy = gy;

    const moveBtn = this.createButton(0, UI_OBJECT_MOVE_TEXTURE_KEY, () => {
      this.fireAction('move');
    });
    this.hitTargets = [moveBtn.hit, moveBtn.root];
    const children: Phaser.GameObjects.GameObject[] = [moveBtn.hit, moveBtn.root];

    if (!options?.hideRemove) {
      const halfGap = BTN_GAP / 2;
      moveBtn.root.setX(-BTN_SIZE / 2 - halfGap);
      const removeBtn = this.createButton(
        BTN_SIZE / 2 + halfGap,
        UI_OBJECT_REMOVE_TEXTURE_KEY,
        () => {
          this.fireAction('remove');
        }
      );
      this.hitTargets.push(removeBtn.hit, removeBtn.root);
      children.push(removeBtn.hit, removeBtn.root);
    }

    this.container.add(children);

    this.layout();
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.container.removeAll(true);
    this.hitTargets = [];
    this.container.setVisible(false);
    this.visible = false;
    if (wasVisible && notify) this.onDismiss?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  refreshLayout(): void {
    if (!this.visible) return;
    this.layout();
  }

  hitsPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    const hits = this.scene.input.hitTestPointer(pointer);
    return hits.some(
      (obj) =>
        this.hitTargets.includes(obj) ||
        (obj.parentContainer != null && obj.parentContainer === this.container)
    );
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    if (this.hitsPointer(pointer)) {
      return true;
    }
    return false;
  }

  private fireAction(action: ObjectEditAction): void {
    const gx = this.tileGx;
    const gy = this.tileGy;
    this.hide(false);
    this.onAction?.(action, gx, gy);
  }

  private createButton(
    x: number,
    textureKey: string,
    onPress: () => void
  ): ButtonVisual {
    const hit = this.scene.add
      .rectangle(x, 0, BTN_SIZE, BTN_SIZE, 0x000000, 0.001)
      .setScrollFactor(0);

    const img = this.scene.add.image(x, 0, textureKey).setScrollFactor(0);
    img.setDisplaySize(BTN_SIZE, BTN_SIZE);

    const stopAnd = (event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onPress();
    };
    hit.setInteractive({ useHandCursor: true });
    hit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event)
    );

    return { root: img, hit };
  }

  private layout(): void {
    const { cx, cy } = placePopupAboveTile(this.scene, this.grid, this.tileGx, this.tileGy, {
      panelW: PANEL_W,
      panelH: PANEL_H,
      containerVisualScale: 1,
      aboveOffsetPx: ABOVE_OFFSET_PX,
      anchorTop: true,
    });
    this.container.setPosition(cx, cy);
  }
}

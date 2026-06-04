import Phaser from 'phaser';
import {
  LIVESTOCK_WARNING_TEXTURE_KEY,
  LIVESTOCK_WARNING_WIDTH_SCALE,
  UI_OBJECT_FEED_TEXTURE_KEY,
  UI_OBJECT_MOVE_TEXTURE_KEY,
  UI_OBJECT_REMOVE_TEXTURE_KEY,
  UI_OBJECT_UPGRADE_TEXTURE_KEY,
} from '../config/assets';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';

export type ObjectEditAction = 'move' | 'remove' | 'upgrade' | 'feed' | 'sell';

const PANEL_DEPTH = 11940;
const BTN_SIZE = Math.round(44 * (2 / 3));
const BTN_GAP = 12;
const PANEL_W_TWO = BTN_SIZE * 2 + BTN_GAP;
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
  private visibleActions: ObjectEditAction[] = [];
  private tileGx = 0;
  private tileGy = 0;
  private onAction?: (action: ObjectEditAction, gx: number, gy: number) => void;
  private onDismiss?: () => void;
  private showHungryWarningBadge = false;

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

  show(gx: number, gy: number, options?: { hideRemove?: boolean; showHungryWarning?: boolean }): void {
    this.hide(false);
    this.tileGx = gx;
    this.tileGy = gy;

    const isPenPopup = Boolean(options?.hideRemove);
    this.showHungryWarningBadge = Boolean(options?.showHungryWarning);
    const buttonSpecs: ReadonlyArray<{ action: ObjectEditAction; texture: string }> = isPenPopup
      ? [
          { action: 'move', texture: UI_OBJECT_MOVE_TEXTURE_KEY },
          { action: 'upgrade', texture: UI_OBJECT_UPGRADE_TEXTURE_KEY },
          { action: 'feed', texture: UI_OBJECT_FEED_TEXTURE_KEY },
          { action: 'sell', texture: UI_OBJECT_REMOVE_TEXTURE_KEY },
        ]
      : [
          { action: 'move', texture: UI_OBJECT_MOVE_TEXTURE_KEY },
          { action: 'remove', texture: UI_OBJECT_REMOVE_TEXTURE_KEY },
        ];

    const children: Phaser.GameObjects.GameObject[] = [];
    this.hitTargets = [];
    this.visibleActions = buttonSpecs.map((s) => s.action);
    const startX = -((buttonSpecs.length - 1) * (BTN_SIZE + BTN_GAP)) / 2;
    buttonSpecs.forEach((spec, index) => {
      const x = startX + index * (BTN_SIZE + BTN_GAP);
      const btn = this.createButton(x, spec.texture, () => this.fireAction(spec.action));
      this.hitTargets.push(btn.hit, btn.root);
      children.push(btn.hit, btn.root);
      if (
        spec.action === 'feed' &&
        this.showHungryWarningBadge &&
        this.scene.textures.exists(LIVESTOCK_WARNING_TEXTURE_KEY)
      ) {
        children.push(this.createFeedWarningBadge(x));
      }
    });

    this.container.add(children);

    this.layout(isPenPopup, buttonSpecs.length);
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.container.removeAll(true);
    this.hitTargets = [];
    this.visibleActions = [];
    this.showHungryWarningBadge = false;
    this.container.setVisible(false);
    this.visible = false;
    if (wasVisible && notify) this.onDismiss?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getVisibleActionsForTest(): ObjectEditAction[] {
    return [...this.visibleActions];
  }

  isFeedWarningBadgeVisibleForTest(): boolean {
    return this.showHungryWarningBadge && this.visible && this.visibleActions.includes('feed');
  }

  refreshLayout(): void {
    if (!this.visible) return;
    const count = this.hitTargets.length / 2;
    this.layout(count >= 3, count);
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

  private createFeedWarningBadge(feedButtonX: number): Phaser.GameObjects.Image {
    const badge = this.scene.add
      .image(
        feedButtonX + BTN_SIZE / 2 - Math.round(BTN_SIZE * 0.18),
        -BTN_SIZE / 2 + Math.round(BTN_SIZE * 0.18),
        LIVESTOCK_WARNING_TEXTURE_KEY
      )
      .setScrollFactor(0);
    const badgeHeight = Math.max(12, Math.round(BTN_SIZE * 0.48 * 0.7));
    const badgeWidth = Math.max(1, Math.round(badgeHeight * LIVESTOCK_WARNING_WIDTH_SCALE));
    badge.setDisplaySize(badgeWidth, badgeHeight);
    return badge;
  }

  private layout(isPenPopup = false, count = 2): void {
    const panelW = isPenPopup ? BTN_SIZE * count + BTN_GAP * (count - 1) : PANEL_W_TWO;
    const { cx, cy } = placePopupAboveTile(this.scene, this.grid, this.tileGx, this.tileGy, {
      panelW,
      panelH: PANEL_H,
      containerVisualScale: 1,
      aboveOffsetPx: ABOVE_OFFSET_PX,
      anchorTop: true,
    });
    this.container.setPosition(cx, cy);
  }
}

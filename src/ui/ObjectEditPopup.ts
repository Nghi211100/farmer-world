import Phaser from 'phaser';
import {
  LIVESTOCK_WARNING_TEXTURE_KEY,
  LIVESTOCK_WARNING_WIDTH_SCALE,
  UI_OBJECT_FEED_TEXTURE_KEY,
  UI_OBJECT_MOVE_TEXTURE_KEY,
  UI_OBJECT_REMOVE_TEXTURE_KEY,
  UI_OBJECT_SELL_TEXTURE_KEY,
  UI_OBJECT_UPGRADE_TEXTURE_KEY,
} from '../config/assets';
import { isIsoTileDecorObject } from '../systems/BuildSystem';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';

export type ObjectEditAction = 'move' | 'remove' | 'upgrade' | 'feed' | 'sell' | 'sellAll';

const PANEL_DEPTH = 11950;
const BTN_SIZE = Math.round(44 * (2 / 3));
const BTN_GAP = 12;
const PANEL_W_TWO = BTN_SIZE * 2 + BTN_GAP;
const PANEL_H = BTN_SIZE;
const ABOVE_OFFSET_PX = 48;
const DISABLED_ALPHA = 0.38;
/** Extra slop for faded buttons so taps still register (getBounds + manual fallback). */
const DISABLED_HIT_SLOP_PX = 10;
const BUTTON_HIT_SLOP_PX = 6;

type ButtonVisual = {
  action: ObjectEditAction;
  disabled: boolean;
  root: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
  onPress: () => void;
};

export type ObjectEditPopupShowOptions = {
  hideRemove?: boolean;
  showHungryWarning?: boolean;
  /** Pen-level actions (move / upgrade / feed / sell all). */
  penMode?: boolean;
  /** Placed building (house / barn / decor tree). */
  buildingMode?: boolean;
  /** Feed + sell for one animal in the pen. */
  animalMode?: boolean;
  disabledActions?: ReadonlyArray<ObjectEditAction>;
  /** Omit buttons entirely (e.g. feed/sellAll when pen empty, upgrade at max level). */
  hiddenActions?: ReadonlyArray<ObjectEditAction>;
  /** Iso-tile decor (field_border) anchors at diamond top; rocks/trees use tile center. */
  anchorTop?: boolean;
};

/** Move / Remove actions above a clicked building or natural object. */
export class ObjectEditPopup {
  private container: Phaser.GameObjects.Container;
  private buttons: ButtonVisual[] = [];
  private hitTargets: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private visibleActions: ObjectEditAction[] = [];
  private tileGx = 0;
  private tileGy = 0;
  private onAction?: (action: ObjectEditAction, gx: number, gy: number) => void;
  private onDisabledAction?: (action: ObjectEditAction, gx: number, gy: number) => void;
  private onDismiss?: () => void;
  private showHungryWarningBadge = false;
  private anchorTop = true;

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

  setOnDisabledAction(cb: (action: ObjectEditAction, gx: number, gy: number) => void): void {
    this.onDisabledAction = cb;
  }

  setOnDismiss(cb: () => void): void {
    this.onDismiss = cb;
  }

  show(gx: number, gy: number, options?: ObjectEditPopupShowOptions): void {
    this.hide(false);
    this.tileGx = gx;
    this.tileGy = gy;

    const disabled = new Set(options?.disabledActions ?? []);
    const hidden = new Set(options?.hiddenActions ?? []);
    this.showHungryWarningBadge = Boolean(options?.showHungryWarning);
    this.anchorTop = options?.anchorTop ?? this.resolveDefaultAnchorTop(gx, gy);

    const allButtonSpecs: ReadonlyArray<{ action: ObjectEditAction; texture: string }> =
      options?.animalMode
        ? [
            { action: 'feed', texture: UI_OBJECT_FEED_TEXTURE_KEY },
            { action: 'sell', texture: UI_OBJECT_SELL_TEXTURE_KEY },
          ]
        : options?.penMode
          ? [
              { action: 'move', texture: UI_OBJECT_MOVE_TEXTURE_KEY },
              { action: 'upgrade', texture: UI_OBJECT_UPGRADE_TEXTURE_KEY },
              { action: 'feed', texture: UI_OBJECT_FEED_TEXTURE_KEY },
              { action: 'sellAll', texture: UI_OBJECT_SELL_TEXTURE_KEY },
              ...(options.hideRemove
                ? []
                : [{ action: 'remove' as const, texture: UI_OBJECT_REMOVE_TEXTURE_KEY }]),
            ]
          : options?.buildingMode
            ? [
                { action: 'move', texture: UI_OBJECT_MOVE_TEXTURE_KEY },
                { action: 'upgrade', texture: UI_OBJECT_UPGRADE_TEXTURE_KEY },
                { action: 'remove', texture: UI_OBJECT_REMOVE_TEXTURE_KEY },
              ]
            : [
                { action: 'move', texture: UI_OBJECT_MOVE_TEXTURE_KEY },
                ...(options?.hideRemove
                  ? []
                  : [{ action: 'remove' as const, texture: UI_OBJECT_REMOVE_TEXTURE_KEY }]),
              ];
    const buttonSpecs = allButtonSpecs.filter((spec) => !hidden.has(spec.action));

    const children: Phaser.GameObjects.GameObject[] = [];
    this.buttons = [];
    this.hitTargets = [];
    this.visibleActions = buttonSpecs.map((s) => s.action);
    const startX = -((buttonSpecs.length - 1) * (BTN_SIZE + BTN_GAP)) / 2;
    buttonSpecs.forEach((spec, index) => {
      const x = startX + index * (BTN_SIZE + BTN_GAP);
      const isDisabled = disabled.has(spec.action);
      const btn = this.createButton(x, spec.texture, spec.action, isDisabled, () => {
        if (isDisabled) {
          this.onDisabledAction?.(spec.action, this.tileGx, this.tileGy);
          return;
        }
        this.fireAction(spec.action);
      });
      this.buttons.push(btn);
      children.push(btn.hit, btn.root);
      this.hitTargets.push(btn.hit, btn.root);
      if (
        spec.action === 'feed' &&
        this.showHungryWarningBadge &&
        this.scene.textures.exists(LIVESTOCK_WARNING_TEXTURE_KEY)
      ) {
        const badge = this.createFeedWarningBadge(x);
        children.push(badge);
        this.hitTargets.push(badge);
      }
    });

    this.container.add(children);

    this.layout(
      Boolean(options?.penMode || options?.animalMode || options?.buildingMode),
      buttonSpecs.length
    );
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.container.removeAll(true);
    this.buttons = [];
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
    const count = this.buttons.length;
    this.layout(count >= 3, count);
  }

  hitsPointer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    if (this.resolveButtonAtPointer(pointer)) return true;
    const hits = this.scene.input.hitTestPointer(pointer);
    return hits.some(
      (obj) =>
        this.hitTargets.includes(obj) ||
        (obj.parentContainer != null && obj.parentContainer === this.container)
    );
  }

  /** Consume pointerdown on popup chrome; buttons fire via their own interactive listeners. */
  handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    if (this.hitsPointer(pointer)) {
      pointer.event?.stopPropagation();
      return true;
    }
    return false;
  }

  /** Dev/test: invoke a visible action as if the button were tapped. */
  pressActionForTest(action: ObjectEditAction): boolean {
    const button = this.buttons.find((b) => b.action === action);
    if (!button || !this.visible) return false;
    button.onPress();
    return true;
  }

  private resolveDefaultAnchorTop(gx: number, gy: number): boolean {
    const objectId = this.grid.getCell(gx, gy)?.object;
    if (!objectId) return true;
    return isIsoTileDecorObject(objectId);
  }

  private fireAction(action: ObjectEditAction): void {
    const gx = this.tileGx;
    const gy = this.tileGy;
    this.hide(false);
    this.onAction?.(action, gx, gy);
  }

  private resolveButtonAtPointer(pointer: Phaser.Input.Pointer): ButtonVisual | undefined {
    const hits = this.scene.input.hitTestPointer(pointer);
    const fromHitTest = this.buttons.find(
      (btn) => hits.includes(btn.hit) || hits.includes(btn.root)
    );
    if (fromHitTest) return fromHitTest;
    return this.resolveButtonByContainerCoords(pointer);
  }

  /**
   * Container-local fallback — same math as BuildPlacementConfirm.resolveButtonAction.
   * hitTestPointer often misses scrollFactor-0 children recreated inside a container.
   */
  private resolveButtonByContainerCoords(
    pointer: Phaser.Input.Pointer
  ): ButtonVisual | undefined {
    const lx = pointer.x - this.container.x;
    const ly = pointer.y - this.container.y;
    for (const btn of this.buttons) {
      const btnX = btn.hit.x;
      const slop = btn.disabled ? DISABLED_HIT_SLOP_PX : BUTTON_HIT_SLOP_PX;
      const half = BTN_SIZE / 2 + slop;
      if (Math.abs(lx - btnX) <= half && Math.abs(ly) <= half) {
        return btn;
      }
    }
    return undefined;
  }

  private createButton(
    x: number,
    textureKey: string,
    action: ObjectEditAction,
    disabled: boolean,
    onPress: () => void
  ): ButtonVisual {
    const hit = this.scene.add
      .rectangle(x, 0, BTN_SIZE, BTN_SIZE, 0x000000, 0.001)
      .setScrollFactor(0);

    const img = this.scene.add.image(x, 0, textureKey).setScrollFactor(0);
    img.setDisplaySize(BTN_SIZE, BTN_SIZE);
    if (disabled) {
      img.setAlpha(DISABLED_ALPHA);
    }

    hit.setInteractive({ useHandCursor: true });
    hit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        onPress();
      }
    );

    return { action, disabled, root: img, hit, onPress };
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
      anchorTop: this.anchorTop,
    });
    this.container.setPosition(cx, cy);
    this.container.setScale(1);
  }
}

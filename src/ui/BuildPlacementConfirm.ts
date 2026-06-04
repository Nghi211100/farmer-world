import Phaser from 'phaser';
import {
  UI_BUILD_CANCEL_TEXTURE_KEY,
  UI_BUILD_CHECK_TEXTURE_KEY,
} from '../config/assets';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';

const PANEL_DEPTH = 11950;
const BTN_SIZE = Math.round(44 * (2 / 3));
const BTN_GAP = 12;
/** Extra slop for touch on scrollFactor-0 confirm buttons. */
const CONFIRM_HIT_SLOP_PX = 10;
const PANEL_W = BTN_SIZE * 2 + BTN_GAP;
const PANEL_H = BTN_SIZE;
/** Extra gap above tile/building anchor (canvas px). */
const ABOVE_PREVIEW_OFFSET_PX = 56;

type ButtonVisual = {
  root: Phaser.GameObjects.GameObject;
  hit: Phaser.GameObjects.Rectangle;
  extras: Phaser.GameObjects.GameObject[];
};

/** Check / Cancel controls shown above a locked build preview. */
export class BuildPlacementConfirm {
  private container: Phaser.GameObjects.Container;
  private checkBtn!: ButtonVisual;
  private cancelBtn!: ButtonVisual;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private onConfirm?: () => void;
  private onCancel?: () => void;
  private confirmEnabled = true;
  private tileGx = 0;
  private tileGy = 0;

  constructor(
    private scene: Phaser.Scene,
    private grid: GridSystem
  ) {
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(PANEL_DEPTH);
    this.container.setVisible(false);

    const halfGap = BTN_GAP / 2;
    this.checkBtn = this.createButton(
      -BTN_SIZE / 2 - halfGap,
      UI_BUILD_CHECK_TEXTURE_KEY,
      () => this.activateConfirm()
    );
    this.cancelBtn = this.createButton(
      BTN_SIZE / 2 + halfGap,
      UI_BUILD_CANCEL_TEXTURE_KEY,
      () => this.activateCancel()
    );

    this.hitTargets = [
      this.checkBtn.hit,
      this.checkBtn.root,
      ...this.checkBtn.extras,
      this.cancelBtn.hit,
      this.cancelBtn.root,
      ...this.cancelBtn.extras,
    ];
    this.container.add([
      this.checkBtn.hit,
      this.checkBtn.root,
      ...this.checkBtn.extras,
      this.cancelBtn.hit,
      this.cancelBtn.root,
      ...this.cancelBtn.extras,
    ]);
  }

  show(
    gx: number,
    gy: number,
    confirmEnabled: boolean,
    onConfirm: () => void,
    onCancel: () => void
  ): void {
    this.tileGx = gx;
    this.tileGy = gy;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.applyConfirmEnabled(confirmEnabled);
    this.layout();
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
    this.onConfirm = undefined;
    this.onCancel = undefined;
  }

  setConfirmEnabled(enabled: boolean): void {
    if (!this.visible) return;
    this.applyConfirmEnabled(enabled);
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Reposition when camera scrolls/zooms while preview is locked. */
  refreshLayout(): void {
    if (!this.visible) return;
    this.layout();
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    const action = this.resolveButtonAction(pointer);
    if (action === 'confirm') {
      this.activateConfirm();
      return true;
    }
    if (action === 'cancel') {
      this.activateCancel();
      return true;
    }
    if (this.hitsPointer(pointer)) {
      return true;
    }
    return false;
  }

  /** Touch-safe: also accept pointerup when down/up both hit a button. */
  handlePointerUp(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    const action = this.resolveButtonAction(pointer);
    if (action === 'confirm') {
      this.activateConfirm();
      return true;
    }
    if (action === 'cancel') {
      this.activateCancel();
      return true;
    }
    return false;
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

  private createButton(
    x: number,
    textureKey: string,
    onPress: () => void
  ): ButtonVisual {
    const hit = this.scene.add
      .rectangle(x, 0, BTN_SIZE, BTN_SIZE, 0x000000, 0.001)
      .setScrollFactor(0);

    const extras: Phaser.GameObjects.GameObject[] = [];
    const img = this.scene.add.image(x, 0, textureKey).setScrollFactor(0);
    img.setDisplaySize(BTN_SIZE, BTN_SIZE);
    const root: Phaser.GameObjects.GameObject = img;

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
    hit.on(
      'pointerup',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event)
    );

    return { root, hit, extras };
  }

  private resolveButtonAction(
    pointer: Phaser.Input.Pointer
  ): 'confirm' | 'cancel' | null {
    const hits = this.scene.input.hitTestPointer(pointer);
    if (
      this.confirmEnabled &&
      (hits.includes(this.checkBtn.hit) || hits.includes(this.checkBtn.root))
    ) {
      return 'confirm';
    }
    if (hits.includes(this.cancelBtn.hit) || hits.includes(this.cancelBtn.root)) {
      return 'cancel';
    }
    const lx = pointer.x - this.container.x;
    const ly = pointer.y - this.container.y;
    const halfGap = BTN_GAP / 2;
    const checkX = -BTN_SIZE / 2 - halfGap;
    const cancelX = BTN_SIZE / 2 + halfGap;
    const half = BTN_SIZE / 2 + CONFIRM_HIT_SLOP_PX;
    if (
      this.confirmEnabled &&
      Math.abs(lx - checkX) <= half &&
      Math.abs(ly) <= half
    ) {
      return 'confirm';
    }
    if (Math.abs(lx - cancelX) <= half && Math.abs(ly) <= half) {
      return 'cancel';
    }
    return null;
  }

  private applyConfirmEnabled(enabled: boolean): void {
    this.confirmEnabled = enabled;
    const checkVisual = this.checkBtn.root as Phaser.GameObjects.Image;
    checkVisual.setAlpha(enabled ? 1 : 0.45);
    if (enabled) {
      this.checkBtn.hit.setInteractive({ useHandCursor: true });
    } else if (this.checkBtn.hit.input) {
      this.checkBtn.hit.disableInteractive();
    }
  }

  private layout(): void {
    const { cx, cy } = placePopupAboveTile(this.scene, this.grid, this.tileGx, this.tileGy, {
      panelW: PANEL_W,
      panelH: PANEL_H,
      containerVisualScale: 1,
      aboveOffsetPx: ABOVE_PREVIEW_OFFSET_PX,
      anchorTop: true,
    });
    this.container.setPosition(cx, cy);
    this.container.setScale(1);
  }

  private activateConfirm(): void {
    if (!this.visible || !this.confirmEnabled) return;
    const cb = this.onConfirm;
    this.hide();
    cb?.();
  }

  private activateCancel(): void {
    if (!this.visible) return;
    const cb = this.onCancel;
    this.hide();
    cb?.();
  }
}

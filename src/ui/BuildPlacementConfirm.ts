import Phaser from 'phaser';
import {
  UI_BUILD_CANCEL_TEXTURE_KEY,
  UI_BUILD_CHECK_TEXTURE_KEY,
  UI_BUILD_TURN_TEXTURE_KEY,
} from '../config/assets';
import type { GridSystem } from '../systems/GridSystem';
import { placePopupAboveTile } from '../utils/popupPosition';

const PANEL_DEPTH = 11950;
const BTN_SIZE = Math.round(44 * (2 / 3));
const BTN_GAP = 12;
/** Extra slop for touch on scrollFactor-0 confirm buttons. */
const CONFIRM_HIT_SLOP_PX = 10;
/** Extra gap above tile/building anchor (canvas px). */
const ABOVE_PREVIEW_OFFSET_PX = 56;

type ButtonVisual = {
  root: Phaser.GameObjects.GameObject;
  hit: Phaser.GameObjects.Rectangle;
  extras: Phaser.GameObjects.GameObject[];
};

export type BuildPlacementConfirmOptions = {
  showRotate?: boolean;
  onRotate?: () => void;
};

/** Check / Cancel controls shown above a locked build preview. */
export class BuildPlacementConfirm {
  private container: Phaser.GameObjects.Container;
  private checkBtn!: ButtonVisual;
  private cancelBtn!: ButtonVisual;
  private rotateBtn!: ButtonVisual;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private onConfirm?: () => void;
  private onCancel?: () => void;
  private onRotate?: () => void;
  private confirmEnabled = true;
  private rotateVisible = false;
  /** Prevents rotate firing on both pointerdown/up and duplicate scene handlers. */
  private rotateTapLock = false;
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

    this.checkBtn = this.createButton(UI_BUILD_CHECK_TEXTURE_KEY, () => this.activateConfirm());
    this.rotateBtn = this.createButton(UI_BUILD_TURN_TEXTURE_KEY, () => this.activateRotate());
    this.cancelBtn = this.createButton(UI_BUILD_CANCEL_TEXTURE_KEY, () => this.activateCancel());

    this.container.add([
      this.checkBtn.hit,
      this.checkBtn.root,
      ...this.checkBtn.extras,
      this.rotateBtn.hit,
      this.rotateBtn.root,
      ...this.rotateBtn.extras,
      this.cancelBtn.hit,
      this.cancelBtn.root,
      ...this.cancelBtn.extras,
    ]);
    this.setRotateVisible(false);
  }

  show(
    gx: number,
    gy: number,
    confirmEnabled: boolean,
    onConfirm: () => void,
    onCancel: () => void,
    options?: BuildPlacementConfirmOptions
  ): void {
    this.tileGx = gx;
    this.tileGy = gy;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.onRotate = options?.showRotate ? options.onRotate : undefined;
    this.setRotateVisible(options?.showRotate === true);
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
    this.onRotate = undefined;
    this.setRotateVisible(false);
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
    if (action === 'rotate') {
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
    if (action === 'rotate') {
      this.activateRotate();
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

  private createButton(textureKey: string, onPress: () => void): ButtonVisual {
    const hit = this.scene.add
      .rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x000000, 0.001)
      .setScrollFactor(0);

    const extras: Phaser.GameObjects.GameObject[] = [];
    const img = this.scene.add.image(0, 0, textureKey).setScrollFactor(0);
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

  private setRotateVisible(visible: boolean): void {
    this.rotateVisible = visible;
    (this.rotateBtn.root as Phaser.GameObjects.Image).setVisible(visible);
    this.rotateBtn.hit.setVisible(visible);
    if (visible) {
      this.rotateBtn.hit.setInteractive({ useHandCursor: true });
    } else if (this.rotateBtn.hit.input) {
      this.rotateBtn.hit.disableInteractive();
    }
    this.syncHitTargets();
  }

  private syncHitTargets(): void {
    const targets: Phaser.GameObjects.GameObject[] = [
      this.checkBtn.hit,
      this.checkBtn.root,
      ...this.checkBtn.extras,
      this.cancelBtn.hit,
      this.cancelBtn.root,
      ...this.cancelBtn.extras,
    ];
    if (this.rotateVisible) {
      targets.push(this.rotateBtn.hit, this.rotateBtn.root, ...this.rotateBtn.extras);
    }
    this.hitTargets = targets;
  }

  private resolveButtonAction(
    pointer: Phaser.Input.Pointer
  ): 'confirm' | 'rotate' | 'cancel' | null {
    const hits = this.scene.input.hitTestPointer(pointer);
    if (
      this.confirmEnabled &&
      (hits.includes(this.checkBtn.hit) || hits.includes(this.checkBtn.root))
    ) {
      return 'confirm';
    }
    if (
      this.rotateVisible &&
      (hits.includes(this.rotateBtn.hit) || hits.includes(this.rotateBtn.root))
    ) {
      return 'rotate';
    }
    if (hits.includes(this.cancelBtn.hit) || hits.includes(this.cancelBtn.root)) {
      return 'cancel';
    }
    const lx = pointer.x - this.container.x;
    const ly = pointer.y - this.container.y;
    const { checkX, rotateX, cancelX } = this.buttonCenters();
    const half = BTN_SIZE / 2 + CONFIRM_HIT_SLOP_PX;
    if (this.confirmEnabled && Math.abs(lx - checkX) <= half && Math.abs(ly) <= half) {
      return 'confirm';
    }
    if (this.rotateVisible && Math.abs(lx - rotateX) <= half && Math.abs(ly) <= half) {
      return 'rotate';
    }
    if (Math.abs(lx - cancelX) <= half && Math.abs(ly) <= half) {
      return 'cancel';
    }
    return null;
  }

  private buttonCenters(): { checkX: number; rotateX: number; cancelX: number } {
    if (this.rotateVisible) {
      const step = BTN_SIZE + BTN_GAP;
      return { checkX: -step, rotateX: 0, cancelX: step };
    }
    const halfGap = BTN_GAP / 2;
    return {
      checkX: -BTN_SIZE / 2 - halfGap,
      rotateX: 0,
      cancelX: BTN_SIZE / 2 + halfGap,
    };
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
    const { checkX, rotateX, cancelX } = this.buttonCenters();
    this.positionButton(this.checkBtn, checkX);
    this.positionButton(this.rotateBtn, rotateX);
    this.positionButton(this.cancelBtn, cancelX);

    const panelW = this.rotateVisible
      ? BTN_SIZE * 3 + BTN_GAP * 2
      : BTN_SIZE * 2 + BTN_GAP;
    const { cx, cy } = placePopupAboveTile(this.scene, this.grid, this.tileGx, this.tileGy, {
      panelW,
      panelH: BTN_SIZE,
      containerVisualScale: 1,
      aboveOffsetPx: ABOVE_PREVIEW_OFFSET_PX,
      anchorTop: true,
    });
    this.container.setPosition(cx, cy);
    this.container.setScale(1);
  }

  private positionButton(btn: ButtonVisual, x: number): void {
    btn.hit.setPosition(x, 0);
    (btn.root as Phaser.GameObjects.Image).setPosition(x, 0);
    for (const extra of btn.extras) {
      if ('setPosition' in extra && typeof extra.setPosition === 'function') {
        extra.setPosition(x, 0);
      }
    }
  }

  private activateConfirm(): void {
    if (!this.visible || !this.confirmEnabled) return;
    const cb = this.onConfirm;
    this.hide();
    cb?.();
  }

  private activateRotate(): void {
    if (!this.visible || !this.rotateVisible || this.rotateTapLock) return;
    this.rotateTapLock = true;
    this.onRotate?.();
    this.scene.time.delayedCall(150, () => {
      this.rotateTapLock = false;
    });
  }

  private activateCancel(): void {
    if (!this.visible) return;
    const cb = this.onCancel;
    this.hide();
    cb?.();
  }
}

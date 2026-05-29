import Phaser from 'phaser';
import { canAffordLandUnlock, LAND_EXPAND_STRINGS } from '../config/gameConfig';

const YES_BTN_ENABLED = 0x2e7d32;
const YES_BTN_DISABLED = 0x616161;
const YES_LABEL_ENABLED = '#ffffff';
const YES_LABEL_DISABLED = '#9e9e9e';

const PANEL_DEPTH = 12100;
const BACKDROP_DEPTH = 12050;

/** Centered yes/no dialog for purchasing / unlocking a farm tile. */
export class LandUnlockConfirm {
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private messageText: Phaser.GameObjects.Text;
  private balanceText: Phaser.GameObjects.Text;
  private yesBtn: Phaser.GameObjects.Rectangle;
  private yesLabel: Phaser.GameObjects.Text;
  private noBtn: Phaser.GameObjects.Rectangle;
  private noLabel: Phaser.GameObjects.Text;
  private hitTargets: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private onYes?: () => void;
  private onNo?: () => void;
  private yesAffordable = false;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(BACKDROP_DEPTH);

    this.container = scene.add.container(width / 2, height / 2);
    this.container.setScrollFactor(0);
    this.container.setDepth(PANEL_DEPTH);

    const panelW = Math.min(340, width - 48);
    const panelH = 176;
    const panel = scene.add
      .rectangle(0, 0, panelW, panelH, 0x3e2723, 0.96)
      .setStrokeStyle(2, 0xffd54f)
      .setScrollFactor(0);

    const panelBlocker = scene.add
      .rectangle(0, 0, panelW, panelH, 0x000000, 0.001)
      .setScrollFactor(0);
    panelBlocker.setInteractive();
    panelBlocker.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
      }
    );

    this.messageText = scene.add
      .text(0, -36, '', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#fff8e1',
        align: 'center',
        wordWrap: { width: panelW - 32 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.balanceText = scene.add
      .text(0, 2, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffd54f',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const btnW = 96;
    const btnH = 36;
    this.yesBtn = scene.add
      .rectangle(-btnW / 2 - 8, 42, btnW, btnH, 0x2e7d32, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.yesLabel = scene.add
      .text(-btnW / 2 - 8, 42, LAND_EXPAND_STRINGS.confirmYes, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.noBtn = scene.add
      .rectangle(btnW / 2 + 8, 42, btnW, btnH, 0x5d4037, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.noLabel = scene.add
      .text(btnW / 2 + 8, 42, LAND_EXPAND_STRINGS.confirmNo, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.hitTargets = [
      panelBlocker,
      panel,
      this.messageText,
      this.balanceText,
      this.yesBtn,
      this.yesLabel,
      this.noBtn,
      this.noLabel,
    ];
    this.container.add([
      panel,
      panelBlocker,
      this.messageText,
      this.balanceText,
      this.yesBtn,
      this.yesLabel,
      this.noBtn,
      this.noLabel,
    ]);

    const stopAnd = (
      event: Phaser.Types.Input.EventData,
      action: () => void
    ) => {
      event.stopPropagation();
      action();
    };
    this.yesBtn.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event, () => this.activateYes())
    );
    this.yesLabel.setInteractive({ useHandCursor: true });
    this.yesLabel.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event, () => this.activateYes())
    );
    this.noBtn.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event, () => this.activateNo())
    );
    this.noLabel.setInteractive({ useHandCursor: true });
    this.noLabel.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => stopAnd(event, () => this.activateNo())
    );

    this.resetBackdrop();
    this.hide();
  }

  show(cost: number, currentCoins: number, onYes: () => void, onNo: () => void): void {
    this.onYes = onYes;
    this.onNo = onNo;
    this.messageText.setText(LAND_EXPAND_STRINGS.confirmMessage(cost));
    this.balanceText.setText(LAND_EXPAND_STRINGS.confirmBalance(currentCoins));
    this.yesAffordable = canAffordLandUnlock(currentCoins, cost);
    this.setYesEnabled(this.yesAffordable);
    this.enableBackdrop();
    this.container.setVisible(true);
    this.visible = true;
    this.layout();
  }

  hide(): void {
    this.resetBackdrop();
    this.container.setVisible(false);
    this.visible = false;
    this.onYes = undefined;
    this.onNo = undefined;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /**
   * FarmScene calls this on pointerdown while the dialog is open.
   * Routes yes/no/backdrop taps when hit-test finds a target (buttons also have their own listeners).
   */
  handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;

    const hits = this.scene.input.hitTestPointer(pointer);
    if (
      this.yesAffordable &&
      (hits.includes(this.yesBtn) || hits.includes(this.yesLabel))
    ) {
      this.activateYes();
      return true;
    }
    if (hits.includes(this.noBtn) || hits.includes(this.noLabel)) {
      this.activateNo();
      return true;
    }
    if (hits.includes(this.backdrop)) {
      this.activateNo();
      return true;
    }
    if (this.hitsPointer(pointer)) {
      return true;
    }
    return false;
  }

  /** True when the pointer hits the dialog panel (not the dismiss backdrop). */
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

  private activateYes(): void {
    if (!this.yesAffordable) return;
    const cb = this.onYes;
    this.hide();
    cb?.();
  }

  private setYesEnabled(enabled: boolean): void {
    if (enabled) {
      this.yesBtn.setFillStyle(YES_BTN_ENABLED, 1);
      this.yesLabel.setColor(YES_LABEL_ENABLED);
      this.yesBtn.setInteractive({ useHandCursor: true });
      this.yesLabel.setInteractive({ useHandCursor: true });
      return;
    }
    this.yesBtn.setFillStyle(YES_BTN_DISABLED, 1);
    this.yesLabel.setColor(YES_LABEL_DISABLED);
    if (this.yesBtn.input) this.yesBtn.disableInteractive();
    if (this.yesLabel.input) this.yesLabel.disableInteractive();
  }

  private activateNo(): void {
    const cb = this.onNo;
    this.hide();
    cb?.();
  }

  private enableBackdrop(): void {
    const { width, height } = this.scene.scale;
    this.backdrop.setPosition(width / 2, height / 2);
    this.backdrop.setSize(width, height);
    this.backdrop.setFillStyle(0x000000, 0.45);
    this.backdrop.setVisible(true);
    this.backdrop.setInteractive();
    this.backdrop.removeAllListeners('pointerdown');
    this.backdrop.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.activateNo();
      }
    );
  }

  private resetBackdrop(): void {
    if (this.backdrop.input) {
      this.backdrop.disableInteractive();
    }
    this.backdrop.removeAllListeners('pointerdown');
    this.backdrop.setVisible(false);
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.backdrop.setPosition(width / 2, height / 2);
    this.backdrop.setSize(width, height);
    this.container.setPosition(width / 2, height / 2);
  }

  resize(): void {
    if (this.visible) this.layout();
  }
}

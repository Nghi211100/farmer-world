import Phaser from 'phaser';
import { computeLeftMenuLayout, type LeftMenuLayout } from './hudLayout';
import { HUD_MENU_DEPTH, type MenuAction } from './BottomMenu';

const BUTTON_DEFS: { key: MenuAction; texture: string }[] = [
  { key: 'inventory', texture: 'inventory' },
];

export class LeftMenu {
  private container: Phaser.GameObjects.Container;
  private onAction?: (action: MenuAction) => void;
  private icons: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const children: Phaser.GameObjects.GameObject[] = [];

    for (const btn of BUTTON_DEFS) {
      const icon = scene.add.image(0, 0, btn.texture).setScrollFactor(0);
      icon.setInteractive({ useHandCursor: true, pixelPerfect: false });
      icon.setDepth(HUD_MENU_DEPTH);
      icon.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.onAction?.(btn.key);
        }
      );
      this.icons.push(icon);
      children.push(icon);
    }

    this.container = scene.add.container(0, 0, children);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);

    this.applyLayout(computeLeftMenuLayout(width, height));
  }

  resize(width: number, height: number): void {
    this.applyLayout(computeLeftMenuLayout(width, height));
  }

  private applyLayout(layout: LeftMenuLayout): void {
    BUTTON_DEFS.forEach((_btn, i) => {
      const icon = this.icons[i];
      icon?.setPosition(layout.iconCenterX, layout.iconCenterY);
      icon?.setDisplaySize(layout.iconSize, layout.iconSize);
    });
  }

  setOnAction(cb: (action: MenuAction) => void): void {
    this.onAction = cb;
  }

  destroy(): void {
    this.container.destroy();
  }
}

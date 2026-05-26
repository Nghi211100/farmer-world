import Phaser from 'phaser';
import { computeBottomMenuLayout, type BottomMenuLayout } from './hudLayout';

/** Above FarmScene farm-popup backdrops (~11900) so HUD always receives clicks. */
export const HUD_MENU_DEPTH = 21000;

/** Modal panels (shop, warehouse) — same layer as HUD so taps are not stolen by FarmScene. */
export const HUD_MODAL_DEPTH = 21000;

export type MenuAction = 'inventory' | 'build' | 'shop' | 'plant' | 'expand';

const BUTTON_DEFS: { key: MenuAction; texture: string; label: string }[] = [
  { key: 'inventory', texture: 'inventory', label: 'Bag' },
  { key: 'plant', texture: 'seed', label: 'Plant' },
  { key: 'expand', texture: 'shovel', label: 'Land' },
  { key: 'build', texture: 'build', label: 'Build' },
  { key: 'shop', texture: 'shop', label: 'Shop' },
];

export class BottomMenu {
  private container: Phaser.GameObjects.Container;
  private onAction?: (action: MenuAction) => void;
  private modeHint?: Phaser.GameObjects.Text;
  private icons: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private viewportW: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.viewportW = width;

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

      const label = scene.add
        .text(0, 0, btn.label, { fontSize: '10px', color: '#fff', fontFamily: 'Arial' })
        .setOrigin(0.5)
        .setScrollFactor(0);
      this.labels.push(label);
      children.push(icon, label);
    }

    this.modeHint = scene.add
      .text(width / 2, 0, '', { fontSize: '11px', color: '#a8e6cf', fontFamily: 'Arial' })
      .setOrigin(0.5)
      .setScrollFactor(0);

    children.push(this.modeHint);

    this.container = scene.add.container(0, 0, children);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);

    this.applyLayout(computeBottomMenuLayout(width, height));
  }

  resize(width: number, height: number): void {
    this.viewportW = width;
    this.applyLayout(computeBottomMenuLayout(width, height));
  }

  private applyLayout(layout: BottomMenuLayout): void {
    BUTTON_DEFS.forEach((_btn, i) => {
      const x = layout.buttonCenterX[i] ?? this.viewportW * 0.5;
      const icon = this.icons[i];
      const label = this.labels[i];
      icon?.setPosition(x, layout.iconCenterY);
      icon?.setDisplaySize(layout.iconSize, layout.iconSize);
      label?.setPosition(x, layout.labelCenterY);
      label?.setStyle({ fontSize: layout.labelFontSize, color: '#fff', fontFamily: 'Arial' });
    });

    this.modeHint?.setPosition(this.viewportW / 2, layout.modeHintCenterY);
    this.modeHint?.setStyle({
      fontSize: layout.modeHintFontSize,
      color: '#a8e6cf',
      fontFamily: 'Arial',
    });
  }

  setModeHint(text: string): void {
    this.modeHint?.setText(text);
  }

  setOnAction(cb: (action: MenuAction) => void): void {
    this.onAction = cb;
  }

  destroy(): void {
    this.container.destroy();
  }
}

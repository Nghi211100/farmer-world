import Phaser from 'phaser';
import { computeBottomMenuLayout, type BottomMenuLayout } from './hudLayout';

/** Above FarmScene farm-popup backdrops (~11900) so HUD always receives clicks. */
export const HUD_MENU_DEPTH = 21000;

/** Modal panels (shop, warehouse) — same layer as HUD so taps are not stolen by FarmScene. */
export const HUD_MODAL_DEPTH = 21000;

export type MenuAction = 'inventory' | 'build' | 'shop' | 'plant' | 'expand';

export class BottomMenu {
  private container: Phaser.GameObjects.Container;
  private modeHint?: Phaser.GameObjects.Text;
  private modeHintProminent = false;
  private lastLayout?: BottomMenuLayout;
  private viewportW: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.viewportW = width;

    this.modeHint = scene.add
      .text(width / 2, 0, '', { fontSize: '11px', color: '#a8e6cf', fontFamily: 'Arial' })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.container = scene.add.container(0, 0, [this.modeHint]);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);

    this.applyLayout(computeBottomMenuLayout(width, height));
  }

  resize(width: number, height: number): void {
    this.viewportW = width;
    this.applyLayout(computeBottomMenuLayout(width, height));
  }

  private applyLayout(layout: BottomMenuLayout): void {
    this.lastLayout = layout;
    this.applyModeHintStyle(layout);
  }

  private applyModeHintStyle(layout: BottomMenuLayout): void {
    if (!this.modeHint) return;
    const prominent = this.modeHintProminent;
    this.modeHint.setPosition(
      this.viewportW / 2,
      prominent ? layout.expandModeHintCenterY : layout.modeHintCenterY
    );
    this.modeHint.setStyle({
      fontSize: prominent ? layout.expandModeHintFontSize : layout.modeHintFontSize,
      color: '#a8e6cf',
      fontFamily: 'Arial',
    });
  }

  setModeHint(text: string, prominent = false): void {
    this.modeHintProminent = prominent;
    this.modeHint?.setText(text);
    if (this.lastLayout) this.applyModeHintStyle(this.lastLayout);
  }

  destroy(): void {
    this.container.destroy();
  }
}

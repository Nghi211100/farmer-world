import Phaser from 'phaser';
import { BUILD_ITEMS, type BuildItemDef } from '../systems/BuildSystem';

export class BuildPanel {
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private onSelect?: (item: BuildItemDef) => void;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const panelW = width * 0.9;
    const panelH = 120;
    const cx = width / 2;
    const cy = height - 160;

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x34495e, 0.95);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0xecf0f1);

    const title = scene.add
      .text(cx, cy - panelH / 2 + 16, 'Build', { fontSize: '16px', color: '#fff', fontFamily: 'Arial' })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const children: Phaser.GameObjects.GameObject[] = [panel, title];
    const spacing = panelW / (BUILD_ITEMS.length + 1);

    BUILD_ITEMS.forEach((item, i) => {
      const x = spacing * (i + 1);
      const icon = scene.add.image(x, cy + 8, item.textureKey).setScrollFactor(0);
      icon.setDisplaySize(40, 40);
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', () => {
        this.onSelect?.(item);
        this.hide();
      });

      const label = scene.add
        .text(x, cy + 36, `${item.label}\n${item.cost}🪙`, {
          fontSize: '10px',
          color: '#fff',
          fontFamily: 'Arial',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      children.push(icon, label);
    });

    const closeBtn = scene.add
      .text(cx + panelW / 2 - 16, cy - panelH / 2 + 16, '✕', {
        fontSize: '18px',
        color: '#e74c3c',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    children.push(closeBtn);

    this.container = scene.add.container(0, 0, children);
    this.container.setDepth(11000);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  setOnSelect(cb: (item: BuildItemDef) => void): void {
    this.onSelect = cb;
  }

  show(): void {
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  destroy(): void {
    this.container.destroy();
  }
}

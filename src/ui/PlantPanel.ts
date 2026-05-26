import Phaser from 'phaser';
import type { InventorySlot } from '../systems/InventorySystem';

export class PlantPanel {
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private titleText: Phaser.GameObjects.Text;
  private onSelect?: (seedId: string) => void;
  private slotContainers: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const panelW = width * 0.85;
    const panelH = 140;
    const cx = width / 2;
    const cy = height - 200;

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x34495e, 0.96);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0x27ae60);

    this.titleText = scene.add
      .text(cx, cy - panelH / 2 + 18, 'Select seed to plant', {
        fontSize: '16px',
        color: '#fff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const closeBtn = scene.add
      .text(cx + panelW / 2 - 20, cy - panelH / 2 + 18, '✕', {
        fontSize: '18px',
        color: '#e74c3c',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());

    this.container = scene.add.container(0, 0, [panel, this.titleText, closeBtn]);
    this.container.setDepth(11500);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  setOnSelect(cb: (seedId: string) => void): void {
    this.onSelect = cb;
  }

  show(seeds: InventorySlot[], hint?: string): void {
    for (const c of this.slotContainers) c.destroy();
    this.slotContainers = [];

    const { width } = this.container.scene.scale;
    const cx = width / 2;
    const cy = this.container.scene.scale.height - 200;
    const spacing = Math.min(100, (width * 0.7) / Math.max(seeds.length, 1));
    const startX = cx - ((seeds.length - 1) * spacing) / 2;

    this.titleText.setText(hint ?? 'Select seed to plant');

    seeds.forEach((slot, i) => {
      const x = startX + i * spacing;
      const slotC = this.container.scene.add.container(x, cy + 10);
      const bg = this.container.scene.add
        .rectangle(0, 0, 72, 72, 0x2d6a4f, 0.95)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      const tex = this.container.scene.textures.exists(slot.iconKey) ? slot.iconKey : 'seed';
      const icon = this.container.scene.add.image(0, -8, tex).setScrollFactor(0);
      icon.setDisplaySize(36, 36);
      const label = this.container.scene.add
        .text(0, 22, `x${slot.count}`, { fontSize: '12px', color: '#fff', fontFamily: 'Arial' })
        .setOrigin(0.5)
        .setScrollFactor(0);
      slotC.add([bg, icon, label]);
      bg.on('pointerdown', () => {
        this.onSelect?.(slot.id);
        this.hide();
      });
      this.container.add(slotC);
      this.slotContainers.push(slotC);
    });

    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
    for (const c of this.slotContainers) c.destroy();
    this.slotContainers = [];
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

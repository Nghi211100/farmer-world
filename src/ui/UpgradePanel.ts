import Phaser from 'phaser';
import { ECONOMY } from '../config/gameConfig';
import type { BuildingData } from '../config/gameConfig';
import type { EconomySystem } from '../systems/EconomySystem';

export class UpgradePanel {
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private infoText: Phaser.GameObjects.Text;
  private upgradeBtn: Phaser.GameObjects.Text;
  private onUpgrade?: () => void;
  private currentBuilding?: BuildingData;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const panelW = width * 0.8;
    const panelH = 160;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = scene.add.rectangle(cx, cy, width, height, 0x000000, 0.001);
    overlay.setScrollFactor(0);
    overlay.setInteractive();

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x2c3e50, 0.97);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0xf39c12);

    const title = scene.add
      .text(cx, cy - panelH / 2 + 24, 'Building Upgrade', {
        fontSize: '20px',
        color: '#fff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.infoText = scene.add
      .text(cx, cy - 10, '', {
        fontSize: '14px',
        color: '#ecf0f1',
        fontFamily: 'Arial',
        align: 'center',
        wordWrap: { width: panelW - 40 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.upgradeBtn = scene.add
      .text(cx, cy + 40, 'Upgrade', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#27ae60',
        padding: { x: 16, y: 8 },
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.upgradeBtn.on('pointerdown', () => this.onUpgrade?.());

    const closeBtn = scene.add
      .text(cx + panelW / 2 - 24, cy - panelH / 2 + 24, '✕', {
        fontSize: '22px',
        color: '#e74c3c',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.hide());

    this.container = scene.add.container(0, 0, [
      overlay,
      panel,
      title,
      this.infoText,
      this.upgradeBtn,
      closeBtn,
    ]);
    this.container.setDepth(12500);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  setOnUpgrade(cb: () => void): void {
    this.onUpgrade = cb;
  }

  show(building: BuildingData, economy: EconomySystem): void {
    this.currentBuilding = building;
    const maxLv = ECONOMY.maxBuildingLevel;
    const cost = economy.getBuildingUpgradeCost(building.type, building.level);

    if (building.level >= maxLv) {
      this.infoText.setText(`${building.type} is max level (${building.level})`);
      this.upgradeBtn.setVisible(false);
    } else if (building.type === 'tree') {
      this.infoText.setText('Trees cannot be upgraded');
      this.upgradeBtn.setVisible(false);
    } else {
      this.infoText.setText(
        `${building.type} — Level ${building.level} → ${building.level + 1}\nCost: ${cost} 🪙\nYour coins: ${economy.getCoins()}`
      );
      this.upgradeBtn.setVisible(true);
      this.upgradeBtn.setText(economy.canUpgradeBuilding(building.type, building.level) ? `Upgrade (${cost} 🪙)` : `Need ${cost} 🪙`);
    }

    this.container.setVisible(true);
    this.visible = true;
  }

  getBuilding(): BuildingData | undefined {
    return this.currentBuilding;
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
    this.currentBuilding = undefined;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

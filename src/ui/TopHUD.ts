import Phaser from 'phaser';
import { HUD_MENU_DEPTH } from './BottomMenu';
import { computeTopHudSlots } from './hudLayout';
import { warehouseTitleLikeTextStyle } from './warehouseTextStyle';

export interface HUDResources {
  coins: number;
  gems: number;
  energy: number;
}

const COIN_BOX_KEY = 'ui_coin_box';
const DIAMOND_BOX_KEY = 'ui_diamond_box';
const ENERGY_BOX_KEY = 'ui_energy_box';
const UI_BOX_FALLBACK_KEY = 'ui_box';

const SLOT_BOX_KEYS = [COIN_BOX_KEY, DIAMOND_BOX_KEY, ENERGY_BOX_KEY] as const;

function texOrFallback(scene: Phaser.Scene, key: string, fallback: string): string {
  return scene.textures.exists(key) ? key : fallback;
}

export class TopHUD {
  private container: Phaser.GameObjects.Container;
  private viewportW: number;
  private viewportH: number;
  private slotRects: { centerX: number; centerY: number; width: number; height: number }[] = [];
  private boxBackgrounds: Phaser.GameObjects.Image[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private gemText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private valueTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.viewportW = width;
    this.viewportH = height;
    const boxFallback = texOrFallback(scene, UI_BOX_FALLBACK_KEY, 'coin');

    const children: Phaser.GameObjects.GameObject[] = [];

    SLOT_BOX_KEYS.forEach((boxKey) => {
      const rect = { centerX: 0, centerY: 0, width: 1, height: 1 };
      this.slotRects.push(rect);

      const boxTex = texOrFallback(scene, boxKey, boxFallback);
      const box = scene.add
        .image(0, 0, boxTex)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
      this.boxBackgrounds.push(box);
      children.push(box);

      const value = scene.add
        .text(0, 0, '0', {
          ...warehouseTitleLikeTextStyle('light', { fontSize: '15px' }),
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
      this.valueTexts.push(value);
      children.push(value);
    });

    [this.coinText, this.gemText, this.energyText] = this.valueTexts;
    this.applyLayout();

    this.container = scene.add.container(0, 0, children);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);
  }

  private applyLayout(): void {
    const { slots, fontSizePx } = computeTopHudSlots(this.viewportW, this.viewportH);
    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i];
      this.slotRects[i] = rect;
      this.boxBackgrounds[i]?.setPosition(rect.centerX, rect.centerY);
      this.boxBackgrounds[i]?.setDisplaySize(rect.width, rect.height);
      const text = this.valueTexts[i];
      if (text) {
        text.setStyle({ ...warehouseTitleLikeTextStyle('light', { fontSize: fontSizePx }) });
        text.setPosition(rect.centerX, rect.centerY);
      }
    }
  }

  /** Re-position boxes and re-center value text after viewport resize. */
  resize(width: number, height: number): void {
    this.viewportW = width;
    this.viewportH = height;
    this.applyLayout();
  }

  update(resources: HUDResources): void {
    this.coinText.setText(String(resources.coins));
    this.gemText.setText(String(resources.gems));
    this.energyText.setText(String(resources.energy));
    this.applyLayout();
  }

  destroy(): void {
    this.container.destroy();
  }
}

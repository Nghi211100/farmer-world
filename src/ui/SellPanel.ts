import Phaser from 'phaser';
import { HUD_MENU_DEPTH } from './BottomMenu';
import { ITEM_LABELS, ITEM_IDS } from '../config/items';
import { ITEM_CATEGORIES } from '../config/items';
import type { EconomySystem } from '../systems/EconomySystem';
import type { InventorySystem } from '../systems/InventorySystem';

export interface SellResult {
  success: boolean;
  message: string;
}

export class SellPanel {
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private statusText: Phaser.GameObjects.Text;
  private qtyText: Phaser.GameObjects.Text;
  private priceText: Phaser.GameObjects.Text;
  private itemButtons: Phaser.GameObjects.Text[] = [];
  private selectedId: string | null = null;
  private quantity = 1;
  private economy?: EconomySystem;
  private inventory?: InventorySystem;
  private onSell?: (result: SellResult) => void;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const panelW = width * 0.9;
    const panelH = height * 0.58;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = scene.add.rectangle(cx, cy, width, height, 0x000000, 0.001);
    overlay.setScrollFactor(0);
    overlay.setInteractive();

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x3d2c1e, 0.97);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0xf39c12);

    const title = scene.add
      .text(cx, cy - panelH / 2 + 28, '💰 Sell Crops', {
        fontSize: '22px',
        color: '#fff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.priceText = scene.add
      .text(cx, cy + panelH / 2 - 100, 'Select a crop', {
        fontSize: '13px',
        color: '#ffd700',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.qtyText = scene.add
      .text(cx, cy + panelH / 2 - 76, 'Qty: 1', {
        fontSize: '14px',
        color: '#fff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const minusBtn = scene.add
      .text(cx - 80, cy + panelH / 2 - 76, '−', {
        fontSize: '20px',
        color: '#fff',
        backgroundColor: '#555',
        padding: { x: 8, y: 2 },
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    minusBtn.on('pointerdown', () => this.adjustQty(-1));

    const plusBtn = scene.add
      .text(cx + 80, cy + panelH / 2 - 76, '+', {
        fontSize: '20px',
        color: '#fff',
        backgroundColor: '#555',
        padding: { x: 8, y: 2 },
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    plusBtn.on('pointerdown', () => this.adjustQty(1));

    const btnY = cy + panelH / 2 - 44;
    const sell1 = this.makeBtn(scene, cx - 100, btnY, 'Sell x1', () => this.sell(this.quantity > 1 ? 1 : 1));
    const sell10 = this.makeBtn(scene, cx, btnY, 'Sell x10', () => this.sell(Math.min(10, this.maxSellable())));
    const sellMax = this.makeBtn(scene, cx + 100, btnY, 'Sell max', () => this.sell(this.maxSellable()));

    this.statusText = scene.add
      .text(cx, cy + panelH / 2 - 16, '', {
        fontSize: '12px',
        color: '#a8e6cf',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const listY = cy - panelH / 2 + 64;
    const listX = cx - panelW / 2 + 20;
    let row = 0;
    for (const id of ITEM_CATEGORIES.resources) {
      const y = listY + row * 36;
      const btn = scene.add
        .text(listX, y, ITEM_LABELS[id] ?? id, {
          fontSize: '14px',
          color: '#ddd',
          backgroundColor: '#2c2416',
          padding: { x: 10, y: 6 },
          fontFamily: 'Arial',
        })
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.selectItem(id));
      this.itemButtons.push(btn);
      row++;
    }

    const closeBtn = scene.add
      .text(cx + panelW / 2 - 24, cy - panelH / 2 + 28, '✕', {
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
      ...this.itemButtons,
      this.priceText,
      minusBtn,
      this.qtyText,
      plusBtn,
      sell1,
      sell10,
      sellMax,
      this.statusText,
      closeBtn,
    ]);
    this.container.setDepth(HUD_MENU_DEPTH);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  private makeBtn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    fn: () => void
  ): Phaser.GameObjects.Text {
    const btn = scene.add
      .text(x, y, label, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#8b4513',
        padding: { x: 8, y: 4 },
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', fn);
    return btn;
  }

  setOnSell(cb: (result: SellResult) => void): void {
    this.onSell = cb;
  }

  show(economy: EconomySystem, inventory: InventorySystem): void {
    this.economy = economy;
    this.inventory = inventory;
    this.selectedId = ITEM_IDS.WHEAT;
    this.quantity = 1;
    this.refreshList();
    this.refreshPrice();
    this.container.setVisible(true);
    this.visible = true;
  }

  private refreshList(): void {
    if (!this.inventory) return;
    ITEM_CATEGORIES.resources.forEach((id, i) => {
      const count = this.inventory!.getCount(id);
      const price = this.economy?.getSellPrice(id) ?? 0;
      const sel = id === this.selectedId ? '▸ ' : '';
      this.itemButtons[i]?.setText(`${sel}${ITEM_LABELS[id]} x${count} (${price}🪙)`);
      this.itemButtons[i]?.setColor(id === this.selectedId ? '#ffd700' : '#ddd');
    });
  }

  private selectItem(id: string): void {
    this.selectedId = id;
    this.quantity = 1;
    this.refreshList();
    this.refreshPrice();
  }

  private refreshPrice(): void {
    if (!this.selectedId || !this.economy) return;
    const unit = this.economy.getSellPrice(this.selectedId);
    const total = unit * this.quantity;
    this.qtyText.setText(`Qty: ${this.quantity}`);
    this.priceText.setText(`${unit} 🪙 each — total ${total} 🪙`);
  }

  private adjustQty(delta: number): void {
    const max = this.maxSellable();
    this.quantity = Math.max(1, Math.min(max, this.quantity + delta));
    this.refreshPrice();
  }

  private maxSellable(): number {
    if (!this.selectedId || !this.inventory) return 0;
    return this.inventory.getCount(this.selectedId);
  }

  private sell(amount: number): void {
    if (!this.economy || !this.inventory || !this.selectedId) return;
    const owned = this.inventory.getCount(this.selectedId);
    const qty = Math.min(amount, owned);
    if (qty <= 0) {
      const result = { success: false, message: 'Nothing to sell' };
      this.statusText.setText(result.message);
      this.onSell?.(result);
      return;
    }
    const unit = this.economy.getSellPrice(this.selectedId);
    const total = unit * qty;
    if (!this.inventory.remove(this.selectedId, qty)) {
      const result = { success: false, message: 'Could not remove items' };
      this.statusText.setText(result.message);
      this.onSell?.(result);
      return;
    }
    this.economy.earn(total);
    const result = { success: true, message: `Sold ${qty} for ${total} 🪙` };
    this.statusText.setText(result.message);
    this.quantity = 1;
    this.refreshList();
    this.refreshPrice();
    this.onSell?.(result);
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
  }

  toggle(economy: EconomySystem, inventory: InventorySystem): void {
    if (this.visible) this.hide();
    else this.show(economy, inventory);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

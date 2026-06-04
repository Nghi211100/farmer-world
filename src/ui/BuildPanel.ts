import Phaser from 'phaser';
import { BUILD_ITEMS, type BuildItemDef } from '../systems/BuildSystem';
import {
  LIVESTOCK_PEN_PLACE_ITEMS,
  type LivestockPenPlaceItemDef,
} from '../systems/LivestockSystem';

export type BuildPanelItem = BuildItemDef | LivestockPenPlaceItemDef;

function isLivestockPenPlaceItem(item: BuildPanelItem): item is LivestockPenPlaceItemDef {
  return 'placeTarget' in item;
}
import { HUD_MODAL_DEPTH } from './BottomMenu';
import {
  BUILD_TABS,
  computeBuildModalLayout,
  type BuildModalLayout,
  type BuildTabId,
} from './buildModalLayout';
import { getModalUiFontScale } from './uiFontScale';
import {
  applyWarehouseTitleLikeSizing,
  warehouseTitleLikeTextStyle,
  WAREHOUSE_TITLE_FONT,
} from './warehouseTextStyle';

const DIM_BACKDROP_ALPHA = 0.42;

const COLOR_PRIMARY = 0xffbb5c;
const COLOR_MODAL_BG = 0xfff7ec;
const COLOR_MODAL_STROKE = 0xd1994b;
const COLOR_INNER_PANEL = 0xffe0b6;
const COLOR_INNER_STROKE = 0xbf8c45;
const COLOR_CARD_BG = 0xfff8e1;
const COLOR_CARD_STROKE = 0xc79248;
const COLOR_TAB_ACTIVE = 0xfff8e1;
const COLOR_TAB_INACTIVE = COLOR_PRIMARY;
const COLOR_TAB_INACTIVE_TEXT = '#3d2817';
const COLOR_TAB_ACTIVE_TEXT = '#2c1810';
const COLOR_PRICE_PILL = 0xffdca9;
const COLOR_CLOSE_BG = 0xe74c3c;

const TAB_BASE_PX = 18;
const TAB_COMPACT_BASE_PX = 14;
const CARD_NAME_BASE_PX = 13;
const CARD_NAME_COMPACT_BASE_PX = 8;
const PRICE_BASE_PX = 12;
const PRICE_COMPACT_BASE_PX = 8;
const LOCKED_BASE_PX = 11;
const LOCKED_COMPACT_BASE_PX = 7;

interface BuildCardNodes {
  root: Phaser.GameObjects.Container;
  cardG: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  preview: Phaser.GameObjects.Image;
  priceG: Phaser.GameObjects.Graphics;
  coin: Phaser.GameObjects.Image | null;
  priceText: Phaser.GameObjects.Text;
  lockOverlay: Phaser.GameObjects.Rectangle;
  lockedText: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
  item: BuildPanelItem;
}

function drawRoundedPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number,
  fillAlpha: number,
  stroke?: number,
  strokeWidth = 2
): void {
  g.clear();
  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (stroke !== undefined) {
    g.lineStyle(strokeWidth, stroke, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

export class BuildPanel {
  private root: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private modal: Phaser.GameObjects.Container;
  private outerGfx: Phaser.GameObjects.Graphics;
  private innerGfx: Phaser.GameObjects.Graphics;
  private closeHit: Phaser.GameObjects.Arc;
  private closeLabel: Phaser.GameObjects.Text;
  private tabHits: Phaser.GameObjects.Rectangle[] = [];
  private tabGfx: Phaser.GameObjects.Graphics[] = [];
  private tabLabels: Phaser.GameObjects.Text[] = [];
  private scrollViewport: Phaser.GameObjects.Container;
  private cardsRow: Phaser.GameObjects.Container;
  private cardNodes: BuildCardNodes[] = [];

  private visible = false;
  private activeTab: BuildTabId = 'buildings';
  private scrollOffset = 0;
  private scrollMax = 0;
  private scrollDragging = false;
  private scrollDragStartX = 0;
  private scrollOffsetAtDrag = 0;
  private scrollViewportW = 0;
  private scrollLayoutCardW = 0;
  private scrollLayoutCardGap = 0;
  private playerLevel = 99;
  private viewportW: number;
  private viewportH: number;
  private onSelect?: (item: BuildPanelItem) => void;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.viewportW = width;
    this.viewportH = height;

    this.backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(HUD_MODAL_DEPTH - 1);

    this.root = scene.add.container(0, 0);
    this.root.setDepth(HUD_MODAL_DEPTH);
    this.root.setScrollFactor(0);
    this.root.add(this.backdrop);

    this.modal = scene.add.container(0, 0);
    this.modal.setScrollFactor(0);
    this.outerGfx = scene.add.graphics().setScrollFactor(0);
    this.innerGfx = scene.add.graphics().setScrollFactor(0);
    this.closeHit = scene.add
      .circle(0, 0, 18, COLOR_CLOSE_BG, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.closeLabel = scene.add
      .text(0, 0, '✕', {
        fontFamily: WAREHOUSE_TITLE_FONT,
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
    this.closeHit.on('pointerdown', () => this.hide());

    this.scrollViewport = scene.add.container(0, 0);
    this.scrollViewport.setScrollFactor(0);
    this.cardsRow = scene.add.container(0, 0);
    this.cardsRow.setScrollFactor(0);
    this.scrollViewport.add(this.cardsRow);

    this.modal.add([
      this.outerGfx,
      this.closeHit,
      this.closeLabel,
      this.innerGfx,
      this.scrollViewport,
    ]);

    BUILD_TABS.forEach((tab) => {
      const tabG = scene.add.graphics().setScrollFactor(0);
      const label = scene.add
        .text(0, 0, tab.label, {
          fontFamily: WAREHOUSE_TITLE_FONT,
          fontSize: '18px',
          color: COLOR_TAB_ACTIVE_TEXT,
          align: 'center',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
      const hit = scene.add
        .rectangle(0, 0, 120, 44, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.activeTab = tab.id;
        this.rebuildCards();
        this.applyLayout();
      });
      this.tabGfx.push(tabG);
      this.tabLabels.push(label);
      this.tabHits.push(hit);
      this.modal.add([tabG, label, hit]);
    });

    this.setupScrollDrag(scene);
    this.root.add(this.modal);
    this.root.setVisible(false);
    this.resetBackdrop();
    this.applyLayout();
  }

  private setupScrollDrag(scene: Phaser.Scene): void {
    const zone = scene.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.001)
      .setScrollFactor(0)
      .setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.scrollDragging = true;
      this.scrollDragStartX = p.x;
      this.scrollOffsetAtDrag = this.scrollOffset;
    });
    scene.input.on('pointermove', this.onScrollPointerMove);
    scene.input.on('pointerup', this.onScrollPointerUp);
    this.scrollDragZone = zone;
    // Below scrollViewport so card hits receive taps (ShopPanel pattern).
    this.modal.add(zone);
  }

  private scrollDragZone!: Phaser.GameObjects.Rectangle;

  private readonly onScrollPointerMove = (p: Phaser.Input.Pointer): void => {
    if (!this.scrollDragging || !p.isDown) return;
    const dx = p.x - this.scrollDragStartX;
    this.setScrollOffset(this.scrollOffsetAtDrag - dx);
  };

  private readonly onScrollPointerUp = (): void => {
    this.scrollDragging = false;
  };

  setPlayerLevel(level: number): void {
    this.playerLevel = level;
    if (this.visible) this.refreshCardLockStates();
  }

  setOnSelect(cb: (item: BuildPanelItem) => void): void {
    this.onSelect = cb;
  }

  /** True when pointer hits the dim backdrop (tap-outside dismiss). */
  hitsBackdrop(pointer: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    return this.root.scene.input.hitTestPointer(pointer).includes(this.backdrop);
  }

  resize(width: number, height: number): void {
    this.viewportW = width;
    this.viewportH = height;
    if (this.visible) this.applyLayout();
    else this.resetBackdrop();
  }

  show(): void {
    this.root.setVisible(true);
    this.visible = true;
    this.enableBackdrop();
    this.rebuildCards();
    this.applyLayout();
  }

  hide(): void {
    this.root.setVisible(false);
    this.visible = false;
    this.scrollDragging = false;
    this.resetBackdrop();
  }

  isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  destroy(): void {
    this.root.scene.input.off('pointermove', this.onScrollPointerMove);
    this.root.scene.input.off('pointerup', this.onScrollPointerUp);
    this.root.destroy();
  }

  /** Dev/e2e: labels for cards on the active tab when the panel is open. */
  getVisibleCardLabels(): string[] {
    if (!this.visible) return [];
    return this.cardNodes.map((n) => n.item.label);
  }

  /** Dev/e2e: switch build modal tab without canvas hit-testing. */
  setActiveTabForTest(tab: BuildTabId): void {
    this.activeTab = tab;
    if (!this.visible) return;
    this.rebuildCards();
    this.applyLayout();
  }

  /** Dev/e2e: max horizontal scroll for the active tab's card row. */
  getScrollMaxForTest(): number {
    return this.scrollMax;
  }

  /** Dev/e2e: scroll card row (updates hit targets for off-screen cards). */
  setScrollOffsetForTest(offset: number): void {
    this.setScrollOffset(offset);
  }

  /** Dev/e2e: whether a card label's hit zone is interactive after scroll culling. */
  isCardHitInteractive(label: string): boolean {
    const node = this.cardNodes.find((n) => n.item.label === label);
    if (!node) return false;
    return Boolean(node.hit.input?.enabled);
  }

  private enableBackdrop(): void {
    const { width, height } = this.root.scene.scale;
    this.backdrop.setPosition(width / 2, height / 2);
    this.backdrop.setSize(width, height);
    this.backdrop.setFillStyle(0x000000, DIM_BACKDROP_ALPHA);
    this.backdrop.setVisible(true);
    this.backdrop.setInteractive();
    this.backdrop.removeAllListeners('pointerdown');
    this.backdrop.on('pointerdown', () => this.hide());
  }

  private resetBackdrop(): void {
    if (this.backdrop.input) this.backdrop.disableInteractive();
    this.backdrop.removeAllListeners('pointerdown');
    this.backdrop.setFillStyle(0x000000, 0);
    this.backdrop.setPosition(this.viewportW / 2, this.viewportH / 2);
    this.backdrop.setSize(this.viewportW, this.viewportH);
  }

  private fontScale(): number {
    const zoom = this.root.scene.scale.zoom > 0 ? this.root.scene.scale.zoom : 1;
    return getModalUiFontScale(this.viewportW, this.viewportH, zoom);
  }

  private applyLayout(): void {
    const fontScale = this.fontScale();
    const layout = computeBuildModalLayout(this.viewportW, this.viewportH, fontScale);

    this.modal.setPosition(layout.cx, layout.cy);
    const { panelW, panelH } = layout;
    const left = -panelW / 2;
    const top = -panelH / 2;
    const radius = layout.compact
      ? Math.max(8, panelH * 0.12)
      : Math.max(12, panelW * 0.04);

    drawRoundedPanel(
      this.outerGfx,
      left,
      top - 1,
      panelW,
      panelH + 1,
      radius,
      COLOR_MODAL_BG,
      0.98,
      COLOR_MODAL_STROKE,
      3
    );

    drawRoundedPanel(
      this.innerGfx,
      layout.innerLeft,
      layout.innerTop,
      layout.innerPanelW,
      layout.innerPanelH,
      Math.max(4, radius * 0.65),
      COLOR_INNER_PANEL,
      0.96,
      COLOR_INNER_STROKE,
      2
    );

    const closeX =
      left + panelW - layout.closeRadius - layout.innerPad * 0.35 - layout.closeShiftLeft;
    const closeY = top + layout.tabRowH * 0.5;
    this.closeHit.setPosition(closeX, closeY);
    this.closeHit.setRadius(layout.closeRadius);
    this.closeLabel.setPosition(closeX, closeY);
    this.closeLabel.setFontSize(
      Math.round((layout.compact ? 11 : 16) * layout.fontScale)
    );

    this.layoutTabs(layout, top);
    this.layoutScrollArea(layout);
    this.positionCards(layout);
    this.clampScroll();
    this.bringScrollLayersToTop();
  }

  /** Scroll drag below viewport so card hits receive taps. */
  private bringScrollLayersToTop(): void {
    const viewportIdx = this.modal.getIndex(this.scrollViewport);
    const dragIdx = this.modal.getIndex(this.scrollDragZone);
    if (viewportIdx >= 0 && dragIdx >= 0 && dragIdx >= viewportIdx) {
      this.modal.moveTo(this.scrollDragZone, viewportIdx);
    }
    for (const g of this.tabGfx) {
      this.modal.bringToTop(g);
    }
    for (const label of this.tabLabels) {
      this.modal.bringToTop(label);
    }
    for (const tab of this.tabHits) {
      this.modal.bringToTop(tab);
    }
    this.modal.bringToTop(this.closeHit);
    this.modal.bringToTop(this.closeLabel);
  }

  private layoutTabs(layout: BuildModalLayout, panelTop: number): void {
    const tabY = panelTop + layout.tabRowH * 0.5;
    const closeReserve = layout.closeRadius * 2 + layout.innerPad;
    const tabsSpanW =
      layout.panelW - closeReserve - layout.innerPad * 2 - layout.tabRowPadLeft;
    const tabGap = Math.max(6, layout.innerPad * 0.6);
    const tabW = (tabsSpanW - tabGap * (BUILD_TABS.length - 1)) / BUILD_TABS.length;
    const tabH = layout.tabRowH * (layout.compact ? 0.9 : 0.82);
    const tabRadius = Math.max(6, tabH * 0.2);
    const tabsLeft = -layout.panelW / 2 + layout.innerPad + layout.tabRowPadLeft;

    BUILD_TABS.forEach((tab, i) => {
      const x = tabsLeft + tabW * (i + 0.5) + tabGap * i;
      const active = tab.id === this.activeTab;
      const g = this.tabGfx[i];
      g.clear();
      g.fillStyle(active ? COLOR_TAB_ACTIVE : COLOR_TAB_INACTIVE, active ? 1 : 0.92);
      g.fillRoundedRect(x - tabW / 2, tabY - tabH / 2, tabW, tabH, tabRadius);
      if (active) {
        g.lineStyle(2, COLOR_MODAL_STROKE, 1);
        g.strokeRoundedRect(x - tabW / 2, tabY - tabH / 2, tabW, tabH, tabRadius);
      } else {
        g.lineStyle(1, COLOR_INNER_STROKE, 0.85);
        g.strokeRoundedRect(x - tabW / 2, tabY - tabH / 2, tabW, tabH, tabRadius);
      }
      const tabPx = Math.round(
        (layout.compact ? TAB_COMPACT_BASE_PX : TAB_BASE_PX) * layout.fontScale
      );
      const label = this.tabLabels[i];
      label.setPosition(x, tabY);
      label.setText(tab.label);
      label.setStyle({
        fontSize: `${tabPx}px`,
        color: active ? COLOR_TAB_ACTIVE_TEXT : COLOR_TAB_INACTIVE_TEXT,
        fontStyle: active ? 'bold' : 'normal',
      });
      const hit = this.tabHits[i];
      hit.setPosition(x, tabY);
      hit.setSize(tabW, tabH);
    });
  }

  private layoutScrollArea(layout: BuildModalLayout): void {
    const { scrollLeft, scrollTop, scrollViewportW, scrollViewportH } = layout;
    this.scrollViewport.setPosition(scrollLeft, scrollTop);
    this.scrollViewportW = scrollViewportW;
    this.scrollLayoutCardW = layout.cardW;
    this.scrollLayoutCardGap = layout.cardGap;
    this.scrollDragZone.setPosition(
      scrollLeft + scrollViewportW / 2,
      scrollTop + scrollViewportH / 2
    );
    this.scrollDragZone.setSize(scrollViewportW, scrollViewportH);
    this.updateCardVisibility();
  }

  private itemsForActiveTab(): BuildPanelItem[] {
    if (this.activeTab === 'livestock') return LIVESTOCK_PEN_PLACE_ITEMS;
    return BUILD_ITEMS.filter((item) => item.category === this.activeTab);
  }

  private rebuildCards(): void {
    for (const node of this.cardNodes) node.root.destroy();
    this.cardNodes = [];
    this.scrollOffset = 0;

    const scene = this.root.scene;
    const items = this.itemsForActiveTab();

    items.forEach((item) => {
      const root = scene.add.container(0, 0);
      root.setScrollFactor(0);
      const cardG = scene.add.graphics();
      cardG.setScrollFactor(0);
      const name = scene.add
        .text(0, 0, item.label, warehouseTitleLikeTextStyle('dark', { fontSize: '13px' }))
        .setOrigin(0.5, 0)
        .setScrollFactor(0);
      const tex = scene.textures.exists(item.textureKey) ? item.textureKey : 'house_lv1';
      const preview = scene.add.image(0, 0, tex).setOrigin(0.5, 0.5).setScrollFactor(0);
      const priceG = scene.add.graphics();
      priceG.setScrollFactor(0);
      const coinKey = scene.textures.exists('coin') ? 'coin' : undefined;
      const coin = coinKey
        ? scene.add.image(0, 0, coinKey).setOrigin(0.5, 0.5).setScrollFactor(0)
        : null;
      const priceText = scene.add
        .text(0, 0, String(item.cost), warehouseTitleLikeTextStyle('dark', { fontSize: '12px' }))
        .setOrigin(0, 0.5)
        .setScrollFactor(0);
      const lockedText = scene.add
        .text(0, 0, '', warehouseTitleLikeTextStyle('small', { fontSize: '11px', align: 'center' }))
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setVisible(false);
      const lockOverlay = scene.add
        .rectangle(0, 0, 10, 10, 0x2a1a0e, 0.35)
        .setScrollFactor(0)
        .setVisible(false);
      const hit = scene.add
        .rectangle(0, 0, 10, 10, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => {
        if (this.isItemLocked(item)) return;
        this.onSelect?.(item);
        this.hide();
      });

      root.add([cardG, name, preview, priceG, ...(coin ? [coin] : []), priceText, lockOverlay, lockedText, hit]);
      this.cardsRow.add(root);
      this.cardNodes.push({
        root,
        cardG,
        name,
        preview,
        priceG,
        coin,
        priceText,
        lockOverlay,
        lockedText,
        hit,
        item,
      });
    });

    this.refreshCardLockStates();
  }

  private isItemLocked(item: BuildPanelItem): boolean {
    if (isLivestockPenPlaceItem(item)) return false;
    const req = item.requiredLevel;
    return req !== undefined && this.playerLevel < req;
  }

  private refreshCardLockStates(): void {
    for (const { root, item, lockOverlay, lockedText } of this.cardNodes) {
      const locked = this.isItemLocked(item);
      lockOverlay.setVisible(locked);
      if (
        locked &&
        !isLivestockPenPlaceItem(item) &&
        item.requiredLevel !== undefined
      ) {
        lockedText.setText(`Required\nlevel ${item.requiredLevel}`);
        lockedText.setVisible(true);
      } else {
        lockedText.setVisible(false);
      }
      root.setAlpha(locked ? 0.72 : 1);
    }
  }

  private positionCards(layout: BuildModalLayout): void {
    const namePx = Math.round(
      (layout.compact ? CARD_NAME_COMPACT_BASE_PX : CARD_NAME_BASE_PX) * layout.fontScale
    );
    const pricePx = Math.round(
      (layout.compact ? PRICE_COMPACT_BASE_PX : PRICE_BASE_PX) * layout.fontScale
    );
    const lockedPx = Math.round(
      (layout.compact ? LOCKED_COMPACT_BASE_PX : LOCKED_BASE_PX) * layout.fontScale
    );
    const cardRadius = Math.max(4, layout.cardW * 0.1);
    const previewSize = layout.cardH * (layout.compact ? 0.38 : 0.42);
    const pillH = Math.max(8, layout.cardH * (layout.compact ? 0.2 : 0.16));

    let x = layout.cardW / 2;
    const rowY = layout.scrollViewportH / 2;

    for (const node of this.cardNodes) {
      const { root, item, cardG, name, preview, priceG, coin, priceText, lockOverlay, lockedText, hit } =
        node;
      const left = -layout.cardW / 2;
      const top = -layout.cardH / 2;

      cardG.clear();
      cardG.fillStyle(COLOR_CARD_BG, 1);
      cardG.fillRoundedRect(left, top, layout.cardW, layout.cardH, cardRadius);
      cardG.lineStyle(2, COLOR_CARD_STROKE, 1);
      cardG.strokeRoundedRect(left, top, layout.cardW, layout.cardH, cardRadius);

      name.setPosition(0, top + layout.cardH * (layout.compact ? 0.06 : 0.08));
      applyWarehouseTitleLikeSizing(name, 'dark', namePx);

      preview.setPosition(0, top + layout.cardH * (layout.compact ? 0.44 : 0.48));
      preview.setDisplaySize(previewSize, previewSize);

      const pillW = layout.cardW * 0.72;
      const pillY = top + layout.cardH * (layout.compact ? 0.82 : 0.84);
      priceG.clear();
      priceG.fillStyle(COLOR_PRICE_PILL, 1);
      priceG.fillRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
      priceG.lineStyle(1, COLOR_CARD_STROKE, 1);
      priceG.strokeRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);

      priceText.setText(coin ? String(item.cost) : `${item.cost} 🪙`);
      applyWarehouseTitleLikeSizing(priceText, 'dark', pricePx);

      const coinSize = pillH * 0.75;
      const priceGap = Math.max(2, pillH * 0.1);
      if (coin) {
        coin.setDisplaySize(coinSize, coinSize);
        const contentW = coinSize + priceGap + priceText.width;
        const contentLeft = -contentW / 2;
        coin.setPosition(contentLeft + coinSize / 2, pillY);
        priceText.setOrigin(0, 0.5);
        priceText.setPosition(contentLeft + coinSize + priceGap, pillY);
      } else {
        priceText.setOrigin(0.5, 0.5);
        priceText.setPosition(0, pillY);
      }

      lockOverlay.setPosition(0, top + layout.cardH / 2);
      lockOverlay.setSize(layout.cardW, layout.cardH);

      lockedText.setPosition(0, top + layout.cardH * 0.5);
      applyWarehouseTitleLikeSizing(lockedText, 'small', lockedPx);

      hit.setPosition(0, 0);
      hit.setSize(layout.cardW, layout.cardH);

      root.setPosition(x, rowY);
      x += layout.cardW + layout.cardGap;
    }

    const contentW =
      this.cardNodes.length * layout.cardW +
      Math.max(0, this.cardNodes.length - 1) * layout.cardGap;
    this.scrollMax = Math.max(0, contentW - layout.scrollViewportW);
    this.cardsRow.setPosition(0, 0);
    this.clampScroll();
    this.updateCardVisibility();
  }

  /** Hide cards outside the scroll viewport (no geometry mask). */
  private updateCardVisibility(): void {
    if (this.cardNodes.length === 0 || this.scrollViewportW <= 0) return;
    const cardW = this.scrollLayoutCardW;
    const cardGap = this.scrollLayoutCardGap;
    let x = cardW / 2;
    const viewLeft = this.scrollOffset;
    const viewRight = this.scrollOffset + this.scrollViewportW;

    for (const node of this.cardNodes) {
      const left = x - cardW / 2;
      const right = x + cardW / 2;
      const visible = right > viewLeft && left < viewRight;
      node.root.setVisible(visible);
      if (visible) {
        // Re-enable after scroll: disableInteractive() keeps `input` but clears enabled.
        if (!node.hit.input?.enabled) {
          node.hit.setInteractive({ useHandCursor: true });
        }
      } else {
        node.hit.disableInteractive();
      }
      x += cardW + cardGap;
    }
  }

  private setScrollOffset(offset: number): void {
    this.scrollOffset = Phaser.Math.Clamp(offset, 0, this.scrollMax);
    this.cardsRow.x = -this.scrollOffset;
    this.updateCardVisibility();
  }

  private clampScroll(): void {
    this.setScrollOffset(this.scrollOffset);
  }
}

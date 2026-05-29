import Phaser from 'phaser';
import type { GridSystem } from '../systems/GridSystem';
import { fillIsoTileDiamond } from '../utils/iso';

/** World dim during land-purchase selection (spotlight on eligible tiles). */
const DIM_ALPHA = 0.5;
const WORLD_PAD = 96;

type TileCoord = { x: number; y: number };

/**
 * Semi-transparent world overlay with cutouts for purchasable land tiles.
 * Pans/zooms with the farm camera; does not capture pointer input.
 */
export class ExpandLandDimOverlay {
  private dimRect?: Phaser.GameObjects.Rectangle;
  private maskGraphics?: Phaser.GameObjects.Graphics;
  private geometryMask?: Phaser.Display.Masks.GeometryMask;
  private shown = false;

  constructor(
    private scene: Phaser.Scene,
    private grid: GridSystem,
    private isPurchasable: (gx: number, gy: number) => boolean
  ) {}

  show(): void {
    this.shown = true;
    this.ensureObjects();
    this.rebuild();
    this.dimRect?.setVisible(true);
    this.maskGraphics?.setVisible(true);
  }

  hide(): void {
    this.shown = false;
    this.dimRect?.setVisible(false);
    this.maskGraphics?.setVisible(false);
  }

  isShown(): boolean {
    return this.shown;
  }

  /** Re-layout bounds and mask holes (after resize, grid origin shift, or purchase). */
  refresh(): void {
    if (!this.shown) return;
    this.rebuild();
  }

  destroy(): void {
    this.dimRect?.clearMask(true);
    this.geometryMask?.destroy();
    this.maskGraphics?.destroy();
    this.dimRect?.destroy();
    this.dimRect = undefined;
    this.maskGraphics = undefined;
    this.geometryMask = undefined;
    this.shown = false;
  }

  private ensureObjects(): void {
    if (this.dimRect) return;

    const depth = this.overlayDepth();
    this.dimRect = this.scene.add
      .rectangle(0, 0, 1, 1, 0x000000, DIM_ALPHA)
      .setScrollFactor(1)
      .setDepth(depth);

    this.maskGraphics = this.scene.add.graphics();
    this.maskGraphics.setScrollFactor(1);
    this.maskGraphics.setDepth(depth + 1);
    this.maskGraphics.setAlpha(0.001);
  }

  private overlayDepth(): number {
    const max = this.grid.size - 1;
    return this.grid.getDepth(max, max, 'objects') + 80;
  }

  private rebuild(): void {
    if (!this.dimRect || !this.maskGraphics) return;

    const bounds = this.grid.getMapScreenBounds();
    const w = bounds.maxX - bounds.minX + WORLD_PAD * 2;
    const h = bounds.maxY - bounds.minY + WORLD_PAD * 2;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;

    this.dimRect.setPosition(cx, cy);
    this.dimRect.setSize(w, h);
    this.dimRect.setDepth(this.overlayDepth());

    this.dimRect.clearMask(true);
    this.geometryMask?.destroy();
    this.geometryMask = undefined;

    // Geometry masks are binary (drawn pixel = clip). ERASE does not punch holes in the
    // stencil, so draw purchasable diamonds only and invert — dim shows everywhere else.
    this.maskGraphics.clear();
    this.maskGraphics.setPosition(0, 0);
    for (const { x, y } of this.collectPurchasableTiles()) {
      const top = this.grid.gridToScreen(x, y);
      fillIsoTileDiamond(this.maskGraphics, top.x, top.y, 0xffffff, 1);
    }

    this.geometryMask = this.maskGraphics.createGeometryMask();
    this.geometryMask.setInvertAlpha(true);
    this.dimRect.setMask(this.geometryMask);
  }

  private collectPurchasableTiles(): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (let y = 0; y < this.grid.size; y++) {
      for (let x = 0; x < this.grid.size; x++) {
        if (this.isPurchasable(x, y)) tiles.push({ x, y });
      }
    }
    return tiles;
  }
}

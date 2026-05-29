import Phaser from 'phaser';
import { applyViewportCoverBackground } from '../backgroundLayout';
import { ASSET_MANIFEST, UI_LOADING_TEXTURE_KEY } from '../config/assets';
import { getAssetPathToUrlMap } from '../utils/assetUrls';
import { createPlaceholderTexture } from '../utils/placeholders';

/** Baked progress bar band on ui/loading.png (1672×941 art px). */
const LOADING_BAR_CENTER_Y_FRAC = 0.88;
const LOADING_BAR_WIDTH_FRAC = 0.52;
const LOADING_BAR_HEIGHT_ART = 14;

export class PreloadScene extends Phaser.Scene {
  private loadedKeys = new Set<string>();
  private splash?: Phaser.GameObjects.Image;
  private progressFill?: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    if (this.textures.exists(UI_LOADING_TEXTURE_KEY)) {
      this.splash = this.add
        .image(viewW / 2, viewH / 2, UI_LOADING_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(-10);
      applyViewportCoverBackground(this.splash, viewW, viewH);
    }

    const barW = Math.min(Math.round(viewW * LOADING_BAR_WIDTH_FRAC), 520);
    const barH = Math.max(8, Math.round((LOADING_BAR_HEIGHT_ART / 941) * viewH));
    const barY = viewH * LOADING_BAR_CENTER_Y_FRAC;
    const track = this.add
      .rectangle(viewW / 2, barY, barW, barH, 0x000000, 0.35)
      .setOrigin(0.5, 0.5)
      .setDepth(10);
    this.progressFill = this.add
      .rectangle(viewW / 2 - barW / 2, barY, 0, barH - 2, 0x7dce7d)
      .setOrigin(0, 0.5)
      .setDepth(11);
    track.setAlpha(this.splash ? 0 : 1);
    if (this.splash) {
      this.progressFill.setAlpha(0.85);
    }

    this.load.on('progress', (v: number) => {
      if (this.progressFill) this.progressFill.width = Math.max(0, barW * v - 2);
    });

    this.load.on('filecomplete', (key: string) => {
      this.loadedKeys.add(key);
    });

    this.load.on('loaderror', (file: { key: string }) => {
      const entry = ASSET_MANIFEST.find((a) => a.key === file.key);
      if (entry && !this.textures.exists(entry.key)) {
        createPlaceholderTexture(this, entry);
      }
    });

    this.load.on('complete', () => {
      for (const entry of ASSET_MANIFEST) {
        if (!this.textures.exists(entry.key)) {
          createPlaceholderTexture(this, entry);
        }
      }
    });

    const pathToUrl = getAssetPathToUrlMap();
    for (const entry of ASSET_MANIFEST) {
      const url = pathToUrl.get(entry.path);
      if (url) {
        this.load.image(entry.key, url);
      }
    }
  }

  create(): void {
    for (const entry of ASSET_MANIFEST) {
      if (!this.textures.exists(entry.key)) {
        createPlaceholderTexture(this, entry);
      }
    }

    this.splash?.destroy();
    this.progressFill?.destroy();

    this.scene.start('FarmScene');
    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
  }
}

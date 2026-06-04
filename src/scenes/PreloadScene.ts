import Phaser from 'phaser';
import { applyViewportCoverBackground } from '../backgroundLayout';
import {
  ASSET_MANIFEST,
  UI_LOADING_BAR_EMPTY_TEXTURE_KEY,
  UI_LOADING_BAR_FILL_TEXTURE_KEY,
  UI_LOADING_BG_TEXTURE_KEY,
} from '../config/assets';
import { getAssetPathToUrlMap } from '../utils/assetUrls';
import { createPlaceholderTexture } from '../utils/placeholders';

const LOADING_BAR_CENTER_Y_FRAC = 0.88;
const LOADING_BAR_WIDTH_FRAC = 0.52;
const LOADING_BAR_MAX_WIDTH_PX = 520;
/** Fill (loading-percent) size as a fraction of the track (loading-empty). */
const LOADING_BAR_FILL_WIDTH_FRAC = 0.86;
const LOADING_BAR_FILL_HEIGHT_FRAC = 0.6;
/** Horizontal offset left as a fraction of track width (barW). */
const LOADING_BAR_FILL_LEFT_SHIFT_FRAC = 0.022;
/** If the loader never completes, still advance (placeholders + farm). */
const PRELOAD_TRANSITION_TIMEOUT_MS = 45_000;

export class PreloadScene extends Phaser.Scene {
  private loadedKeys = new Set<string>();
  private transitionedToFarm = false;
  private transitionTimeout?: Phaser.Time.TimerEvent;
  private splash?: Phaser.GameObjects.Image;
  private progressTrack?: Phaser.GameObjects.Image;
  private progressFill?: Phaser.GameObjects.Image;
  private fallbackTrack?: Phaser.GameObjects.Rectangle;
  private fallbackFill?: Phaser.GameObjects.Rectangle;
  private barW = 0;
  private barH = 0;
  private barInnerW = 0;
  private barInnerH = 0;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    if (this.textures.exists(UI_LOADING_BG_TEXTURE_KEY)) {
      this.splash = this.add
        .image(viewW / 2, viewH / 2, UI_LOADING_BG_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(-10);
      applyViewportCoverBackground(this.splash, viewW, viewH);
    }

    this.barW = Math.min(Math.round(viewW * LOADING_BAR_WIDTH_FRAC), LOADING_BAR_MAX_WIDTH_PX);
    const barY = viewH * LOADING_BAR_CENTER_Y_FRAC;

    const hasBarArt =
      this.textures.exists(UI_LOADING_BAR_EMPTY_TEXTURE_KEY) &&
      this.textures.exists(UI_LOADING_BAR_FILL_TEXTURE_KEY);

    if (hasBarArt) {
      const emptyFrame = this.textures.get(UI_LOADING_BAR_EMPTY_TEXTURE_KEY).get();
      const texW = emptyFrame.width;
      const texH = emptyFrame.height;
      this.barH = texW > 0 ? Math.max(8, Math.round(this.barW * (texH / texW))) : 14;
      this.barInnerW = this.barW * LOADING_BAR_FILL_WIDTH_FRAC;
      this.barInnerH = this.barH * LOADING_BAR_FILL_HEIGHT_FRAC;

      this.progressTrack = this.add
        .image(viewW / 2, barY, UI_LOADING_BAR_EMPTY_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(10);
      this.progressTrack.setDisplaySize(this.barW, this.barH);

      const fillX = viewW / 2 - this.barInnerW / 2 - this.barW * LOADING_BAR_FILL_LEFT_SHIFT_FRAC;
      this.progressFill = this.add
        .image(fillX, barY, UI_LOADING_BAR_FILL_TEXTURE_KEY)
        .setOrigin(0, 0.5)
        .setDepth(11);
      this.setProgressFillWidth(0);
    } else {
      this.barH = Math.max(8, Math.round(viewH * (14 / 941)));
      this.fallbackTrack = this.add
        .rectangle(viewW / 2, barY, this.barW, this.barH, 0x000000, 0.35)
        .setOrigin(0.5, 0.5)
        .setDepth(10);
      this.fallbackFill = this.add
        .rectangle(viewW / 2 - this.barW / 2, barY, 0, this.barH - 2, 0x7dce7d)
        .setOrigin(0, 0.5)
        .setDepth(11);
      this.fallbackTrack.setAlpha(this.splash ? 0 : 1);
      if (this.splash) {
        this.fallbackFill.setAlpha(0.85);
      }
    }

    this.load.on('progress', (v: number) => {
      this.setLoadProgress(v);
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

    this.transitionTimeout = this.time.delayedCall(
      PRELOAD_TRANSITION_TIMEOUT_MS,
      () => {
        if (this.transitionedToFarm) return;
        console.warn(
          '[PreloadScene] Load timed out — starting farm with placeholders'
        );
        if (this.load.isLoading()) {
          this.load.reset();
        }
        this.transitionToFarm();
      },
      undefined,
      this
    );
  }

  private setLoadProgress(v: number): void {
    const clamped = Phaser.Math.Clamp(v, 0, 1);
    if (this.progressFill) {
      this.setProgressFillWidth(clamped);
      return;
    }
    if (this.fallbackFill) {
      this.fallbackFill.width = Math.max(0, this.barW * clamped - 2);
    }
  }

  private setProgressFillWidth(ratio: number): void {
    if (!this.progressFill) return;
    const fillW = Math.max(0, this.barInnerW * ratio);
    this.progressFill.setDisplaySize(fillW, this.barInnerH);
    this.progressFill.setVisible(fillW > 0.5);
  }

  create(): void {
    this.transitionToFarm();
  }

  private transitionToFarm(): void {
    if (this.transitionedToFarm) return;
    this.transitionedToFarm = true;
    this.transitionTimeout?.remove();
    this.transitionTimeout = undefined;

    for (const entry of ASSET_MANIFEST) {
      if (!this.textures.exists(entry.key)) {
        createPlaceholderTexture(this, entry);
      }
    }

    this.splash?.destroy();
    this.progressTrack?.destroy();
    this.progressFill?.destroy();
    this.fallbackTrack?.destroy();
    this.fallbackFill?.destroy();

    this.scene.start('FarmScene');
    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
  }
}

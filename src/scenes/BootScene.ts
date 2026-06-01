import Phaser from 'phaser';
import {
  UI_LOADING_BAR_EMPTY_TEXTURE_KEY,
  UI_LOADING_BAR_FILL_TEXTURE_KEY,
  UI_LOADING_BG_TEXTURE_KEY,
} from '../config/assets';
import { getAssetUrl } from '../utils/assetUrls';

const BOOT_LOADING_ASSETS: { key: string; path: string }[] = [
  { key: UI_LOADING_BG_TEXTURE_KEY, path: 'ui/loading-bg.png' },
  { key: UI_LOADING_BAR_EMPTY_TEXTURE_KEY, path: 'ui/loading-empty.png' },
  { key: UI_LOADING_BAR_FILL_TEXTURE_KEY, path: 'ui/loading-percent.png' },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    for (const { key, path } of BOOT_LOADING_ASSETS) {
      const url = getAssetUrl(path);
      if (url) {
        this.load.image(key, url);
      }
    }
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}

import Phaser from 'phaser';
import { UI_LOADING_TEXTURE_KEY } from '../config/assets';
import { getAssetUrl } from '../utils/assetUrls';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const url = getAssetUrl('ui/loading.png');
    if (url) {
      this.load.image(UI_LOADING_TEXTURE_KEY, url);
    }
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}

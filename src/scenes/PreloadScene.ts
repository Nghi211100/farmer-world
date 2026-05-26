import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../config/assets';
import { createPlaceholderTexture } from '../utils/placeholders';

export class PreloadScene extends Phaser.Scene {
  private loadedKeys = new Set<string>();

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const barW = Math.min(280, this.scale.width * 0.7);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, barW, 12, 0x333333);
    const fill = this.add.rectangle(this.scale.width / 2 - barW / 2, this.scale.height / 2, 0, 10, 0x5cb85c).setOrigin(0, 0.5);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 28, 'Loading Your Farm...', {
        fontSize: '18px',
        color: '#fff',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      fill.width = barW * v;
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

    const pngModules = import.meta.glob('../assets/**/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }) as Record<string, string>;

    const pathToUrl = new Map<string, string>();
    for (const [fullPath, url] of Object.entries(pngModules)) {
      const match = fullPath.match(/assets\/(.+\.png)$/);
      if (match) pathToUrl.set(match[1].replace(/\\/g, '/'), url);
    }

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

    this.scene.start('FarmScene');
    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
  }
}

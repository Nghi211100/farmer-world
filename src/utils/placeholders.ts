import Phaser from 'phaser';
import type { AssetEntry } from '../config/assets';

function isIsoGroundTile(entry: AssetEntry): boolean {
  return entry.path.startsWith('tiles/');
}

/** Create a canvas-generated placeholder texture */
export function createPlaceholderTexture(
  scene: Phaser.Scene,
  entry: AssetEntry
): void {
  const w = entry.width ?? 64;
  const h = entry.height ?? 32;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(entry.placeholderColor, 1);

  if (isIsoGroundTile(entry)) {
    const hw = w / 2;
    const hh = h / 2;
    g.beginPath();
    g.moveTo(hw, 0);
    g.lineTo(w, hh);
    g.lineTo(hw, h);
    g.lineTo(0, hh);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xffffff, 0.45);
    g.strokePath();
  } else {
    g.fillRect(0, 0, w, h);
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokeRect(1, 1, w - 2, h - 2);
  }

  g.generateTexture(entry.key, w, h);
  g.destroy();
}

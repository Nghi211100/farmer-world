import Phaser from 'phaser';
import type { GridSystem } from '../systems/GridSystem';
import { DISPLAY_SIZE, fitSpriteDisplay, NATURE_DISPLAY_SCALE } from '../utils/iso';

/** Static map decorations (trees, rocks, bushes from map generation) */
export class Decoration {
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;

  constructor(
    scene: Phaser.Scene,
    grid: GridSystem,
    gx: number,
    gy: number,
    textureKey: string
  ) {
    this.gridX = gx;
    this.gridY = gy;
    const foot = grid.gridToMapTileBottom(gx, gy);
    this.sprite = scene.add.sprite(foot.x, foot.y, textureKey);
    this.sprite.setOrigin(0.5, 1);
    const isTree = textureKey.startsWith('tree');
    fitSpriteDisplay(
      this.sprite,
      DISPLAY_SIZE.tileW * (isTree ? 1.2 : 0.9) * NATURE_DISPLAY_SCALE,
      (isTree ? DISPLAY_SIZE.treeH : DISPLAY_SIZE.rockH) * NATURE_DISPLAY_SCALE
    );
    this.sprite.setDepth(grid.getDepth(gx, gy, 'objects'));
  }
}

export function renderMapDecorations(
  scene: Phaser.Scene,
  grid: GridSystem
): Decoration[] {
  const decorations: Decoration[] = [];
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      const cell = grid.getCell(x, y);
      const objectId = cell?.object;
      if (!objectId) continue;
      // Buildings and pen occupancy markers are not map decor (no texture / rendered elsewhere).
      if (objectId.includes('house') || objectId.includes('barn')) continue;
      if (objectId.startsWith('livestock_pen_')) continue;
      if (!scene.textures.exists(objectId)) continue;
      decorations.push(new Decoration(scene, grid, x, y, objectId));
    }
  }
  return decorations;
}

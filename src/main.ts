import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';
import { PreloadScene } from './scenes/PreloadScene';
import { UIScene } from './scenes/UIScene';
import { installGameTestApi } from './testing/gameTestApi';

/** Canvas backdrop when bg cover crops past art edges (matches background art). */
const GAME_LETTERBOX_COLOR = '#1b2e16';

const getGameSize = (): { width: number; height: number } => ({
  width: Math.max(320, window.innerWidth),
  height: Math.max(240, window.innerHeight),
});

const { width, height } = getGameSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width,
  height,
  backgroundColor: GAME_LETTERBOX_COLOR,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [BootScene, PreloadScene, FarmScene, UIScene],
  input: {
    activePointers: 3,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

let gameInstance: Phaser.Game;
gameInstance = new Phaser.Game(config);
installGameTestApi(gameInstance);

window.addEventListener('resize', () => {
  if (!gameInstance) return;
  const { width, height } = getGameSize();
  gameInstance.scale.resize(width, height);
  gameInstance.scale.refresh();
});

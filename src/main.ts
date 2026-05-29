import Phaser from 'phaser';
import { getLogicalViewportSize } from './displayPixelRatio';
import { enableImmersiveFullscreen, refreshHudSafeAreaInsets } from './immersive';
import { lockLandscapeOrientation } from './orientation';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';
import { PreloadScene } from './scenes/PreloadScene';
import { UIScene } from './scenes/UIScene';
import { installGameTestApi } from './testing/gameTestApi';

/** Canvas backdrop when bg cover crops past art edges (matches background art). */
const GAME_LETTERBOX_COLOR = '#1b2e16';

void lockLandscapeOrientation();
void enableImmersiveFullscreen();

const initialSize = getLogicalViewportSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: initialSize.width,
  height: initialSize.height,
  backgroundColor: GAME_LETTERBOX_COLOR,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    autoRound: true,
  },
  scene: [BootScene, PreloadScene, FarmScene, UIScene],
  input: {
    activePointers: 3,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
};

let gameInstance: Phaser.Game;
gameInstance = new Phaser.Game(config);
installGameTestApi(gameInstance);

const syncViewport = (): void => {
  if (!gameInstance) return;
  refreshHudSafeAreaInsets();
  const { width, height } = getLogicalViewportSize();
  gameInstance.scale.resize(width, height);
};

gameInstance.events.once(Phaser.Core.Events.READY, syncViewport);
requestAnimationFrame(syncViewport);

window.addEventListener('resize', syncViewport);
window.addEventListener('orientationchange', () => {
  window.setTimeout(syncViewport, 100);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewport);
}

const gameContainer = document.getElementById('game-container');
if (gameContainer && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => syncViewport()).observe(gameContainer);
}

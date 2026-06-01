import Phaser from 'phaser';
import {
  getDisplayPixelRatio,
  getLogicalViewportSize,
  getScaleZoomForPixelRatio,
} from './displayPixelRatio';
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

const initialLogical = getLogicalViewportSize();
const initialPixelRatio = getDisplayPixelRatio();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: Math.round(initialLogical.width * initialPixelRatio),
  height: Math.round(initialLogical.height * initialPixelRatio),
  backgroundColor: GAME_LETTERBOX_COLOR,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: getScaleZoomForPixelRatio(initialPixelRatio),
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

/** Phaser NONE+resize skips canvas CSS when zoom=1 (DPR=1 tablets); keep CSS at logical size. */
const syncCanvasDisplaySize = (logicalW: number, logicalH: number, zoom: number): void => {
  const canvas = gameInstance.canvas;
  const cssW = Math.max(1, Math.floor(logicalW * zoom));
  const cssH = Math.max(1, Math.floor(logicalH * zoom));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
};

const syncViewport = (): void => {
  if (!gameInstance) return;
  refreshHudSafeAreaInsets();
  const pixelRatio = getDisplayPixelRatio();
  const { width, height } = getLogicalViewportSize();
  const zoom = getScaleZoomForPixelRatio(pixelRatio);
  const scale = gameInstance.scale;
  scale.setZoom(zoom);
  scale.resize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
  syncCanvasDisplaySize(width, height, zoom);
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

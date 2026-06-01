import Phaser from 'phaser';

type InteractiveGameObject = Phaser.GameObjects.GameObject & {
  input?: Phaser.Types.Input.InteractiveObject;
  visible: boolean;
};

/**
 * True when the pointer hits a visible, enabled interactive object on `scene`
 * (typically UIScene HUD chrome or an open modal).
 */
export function sceneHitsInteractiveHud(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer
): boolean {
  if (!scene.sys.isActive()) return false;
  return scene.input.hitTestPointer(pointer).some((obj) => {
    const go = obj as InteractiveGameObject;
    return Boolean(go.input?.enabled && go.visible);
  });
}

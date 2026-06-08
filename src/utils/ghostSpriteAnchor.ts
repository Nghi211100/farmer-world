import { isIsoTileDecorObject } from '../systems/BuildSystem';

/**
 * Whether {@link FarmScene.updateGhostSprite} should reposition the ghost at the
 * tile bottom (trees, rocks, buildings). Iso-tile decor and ground builds already
 * anchor at the diamond top via {@link GridSystem.gridToMapScreen}.
 */
export function shouldApplyFootGhostOverwrite(
  isGroundBuild: boolean,
  textureKey: string
): boolean {
  return !isGroundBuild && !isIsoTileDecorObject(textureKey);
}

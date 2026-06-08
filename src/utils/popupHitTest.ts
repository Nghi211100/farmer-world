import Phaser from 'phaser';

export type HudBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BoundsSource = {
  visible: boolean;
  getBounds: () => Phaser.Geom.Rectangle;
};

/** Canvas-pointer hit test for scrollFactor-0 HUD bounds (after camera zoom). */
export function pointerHitsHudBounds(
  pointer: Phaser.Input.Pointer,
  bounds: HudBounds,
  slopPx = 0
): boolean {
  return (
    pointer.x >= bounds.x - slopPx &&
    pointer.x <= bounds.x + bounds.width + slopPx &&
    pointer.y >= bounds.y - slopPx &&
    pointer.y <= bounds.y + bounds.height + slopPx
  );
}

export function hudBoundsFromGameObject(go: BoundsSource): HudBounds | null {
  if (!go.visible) return null;
  const bounds = go.getBounds();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

export function pointerHitsHudGameObject(
  pointer: Phaser.Input.Pointer,
  go: BoundsSource,
  slopPx = 0
): boolean {
  const bounds = hudBoundsFromGameObject(go);
  return bounds != null && pointerHitsHudBounds(pointer, bounds, slopPx);
}

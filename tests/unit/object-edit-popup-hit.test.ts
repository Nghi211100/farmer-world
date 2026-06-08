import { describe, expect, it } from 'vitest';
import { pointerHitsHudBounds } from '../../src/utils/popupHitTest';

/** Mirrors ObjectEditPopup / BuildPlacementConfirm container-local button hit test. */
function pointerHitsPopupButton(
  pointerX: number,
  pointerY: number,
  containerX: number,
  containerY: number,
  btnX: number,
  btnSize: number,
  slopPx: number
): boolean {
  const lx = pointerX - containerX;
  const ly = pointerY - containerY;
  const half = btnSize / 2 + slopPx;
  return Math.abs(lx - btnX) <= half && Math.abs(ly) <= half;
}

describe('object edit popup container-local hit test', () => {
  const BTN_SIZE = 29;
  const SLOP = 6;

  it('hits move/remove buttons via container-local coords (BuildPlacementConfirm pattern)', () => {
    const containerX = 400;
    const containerY = 200;
    const moveX = -21;
    const removeX = 21;
    expect(
      pointerHitsPopupButton(379, containerY, containerX, containerY, moveX, BTN_SIZE, SLOP)
    ).toBe(true);
    expect(
      pointerHitsPopupButton(421, containerY, containerX, containerY, removeX, BTN_SIZE, SLOP)
    ).toBe(true);
    expect(
      pointerHitsPopupButton(400, containerY, containerX, containerY, moveX, BTN_SIZE, SLOP)
    ).toBe(false);
  });

  it('applies extra slop for disabled buttons', () => {
    const containerX = 400;
    const containerY = 200;
    const moveX = -21;
    expect(
      pointerHitsPopupButton(372, 193, containerX, containerY, moveX, BTN_SIZE, 10)
    ).toBe(true);
  });
});

describe('object edit popup HUD hit test', () => {
  it('matches canvas pointer against screen-space button bounds at zoom 1.9', () => {
    const pointer = { x: 420, y: 180 } as Phaser.Input.Pointer;
    const bounds = { x: 400, y: 160, width: 44, height: 44 };
    expect(pointerHitsHudBounds(pointer, bounds)).toBe(true);
    expect(pointerHitsHudBounds(pointer, bounds, 0)).toBe(true);
    expect(pointerHitsHudBounds({ x: 360, y: 180 } as Phaser.Input.Pointer, bounds)).toBe(false);
  });

  it('applies slop for faded / small buttons', () => {
    const pointer = { x: 392, y: 172 } as Phaser.Input.Pointer;
    const bounds = { x: 400, y: 160, width: 44, height: 44 };
    expect(pointerHitsHudBounds(pointer, bounds)).toBe(false);
    expect(pointerHitsHudBounds(pointer, bounds, 10)).toBe(true);
  });
});

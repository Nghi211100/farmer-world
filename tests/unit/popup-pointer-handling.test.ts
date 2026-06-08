import { describe, expect, it, vi } from 'vitest';

/**
 * Mirrors BuildPlacementConfirm rotate tap-lock so rotate cannot fire twice
 * when both pointerdown/up scene handlers run. ObjectEditPopup fires actions
 * only on button pointerdown (stopPropagation), so no global tap lock is needed.
 */
function createPopupActionGate(releaseMs = 150) {
  let locked = false;
  const timers: Array<() => void> = [];
  return {
    tryRun(action: () => void): boolean {
      if (locked) return false;
      locked = true;
      action();
      timers.push(() => {
        locked = false;
      });
      return true;
    },
    releaseAll() {
      for (const release of timers.splice(0)) release();
    },
    isLocked() {
      return locked;
    },
    releaseMs,
  };
}

describe('popup pointer tap lock', () => {
  it('allows the first action and blocks a duplicate within the same gesture', () => {
    const gate = createPopupActionGate();
    const action = vi.fn();

    expect(gate.tryRun(action)).toBe(true);
    expect(gate.tryRun(action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(gate.isLocked()).toBe(true);

    gate.releaseAll();
    expect(gate.isLocked()).toBe(false);
    expect(gate.tryRun(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('models pointerdown fire + pointerup duplicate blocked by tap lock', () => {
    const gate = createPopupActionGate();
    const onRemove = vi.fn();

    const pointerDownFires = () => gate.tryRun(onRemove);
    const pointerUpFires = () => gate.tryRun(onRemove);

    pointerDownFires();
    pointerUpFires();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

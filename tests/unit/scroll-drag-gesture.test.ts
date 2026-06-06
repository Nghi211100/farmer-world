import { describe, expect, it, vi } from 'vitest';
import {
  beginScrollDrag,
  clearScrollDrag,
  createScrollDragSession,
  endScrollDrag,
  handleScrollDragMove,
  SCROLL_DRAG_THRESHOLD_PX,
} from '../../src/ui/scrollDragGesture';

function mockPointer(
  id: number,
  x: number,
  y: number,
  isDown = true
): Phaser.Input.Pointer {
  return { id, x, y, isDown } as Phaser.Input.Pointer;
}

describe('scrollDragGesture', () => {
  it('runs pending tap when pointer did not cross drag threshold', () => {
    const session = createScrollDragSession();
    const onTap = vi.fn();
    beginScrollDrag(session, mockPointer(1, 10, 20, true), 0, 'x', onTap);

    handleScrollDragMove(session, mockPointer(1, 10 + SCROLL_DRAG_THRESHOLD_PX - 1, 20), 'x', () => {
      throw new Error('should not scroll');
    });

    endScrollDrag(session);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(session.pointerId).toBeNull();
  });

  it('scrolls on horizontal drag and cancels pending tap', () => {
    const session = createScrollDragSession();
    const onTap = vi.fn();
    const apply = vi.fn();
    beginScrollDrag(session, mockPointer(2, 100, 0, true), 40, 'x', onTap);

    handleScrollDragMove(
      session,
      mockPointer(2, 100 + SCROLL_DRAG_THRESHOLD_PX, 0),
      'x',
      apply
    );
    expect(apply).toHaveBeenCalledWith(40 - SCROLL_DRAG_THRESHOLD_PX);
    expect(onTap).not.toHaveBeenCalled();

    endScrollDrag(session);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('scrolls on vertical drag without a pending tap', () => {
    const session = createScrollDragSession();
    const apply = vi.fn();
    beginScrollDrag(session, mockPointer(3, 0, 50, true), 12, 'y');

    handleScrollDragMove(session, mockPointer(3, 0, 50 + SCROLL_DRAG_THRESHOLD_PX + 4), 'y', apply);
    expect(apply).toHaveBeenCalledWith(12 - (SCROLL_DRAG_THRESHOLD_PX + 4));

    clearScrollDrag(session);
    expect(session.dragActive).toBe(false);
    expect(session.pendingTap).toBeNull();
  });
});

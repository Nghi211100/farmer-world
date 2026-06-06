import type Phaser from 'phaser';

/** Min pointer travel before scroll drag starts (preserves taps on scrollable items). */
export const SCROLL_DRAG_THRESHOLD_PX = 6;

export type ScrollDragAxis = 'x' | 'y';

export interface ScrollDragSession {
  pointerId: number | null;
  startPrimary: number;
  startScrollOffset: number;
  dragActive: boolean;
  pendingTap: (() => void) | null;
}

export function createScrollDragSession(): ScrollDragSession {
  return {
    pointerId: null,
    startPrimary: 0,
    startScrollOffset: 0,
    dragActive: false,
    pendingTap: null,
  };
}

export function beginScrollDrag(
  session: ScrollDragSession,
  pointer: Phaser.Input.Pointer,
  scrollOffset: number,
  axis: ScrollDragAxis,
  pendingTap?: () => void
): void {
  session.pointerId = pointer.id;
  session.startPrimary = axis === 'x' ? pointer.x : pointer.y;
  session.startScrollOffset = scrollOffset;
  session.dragActive = false;
  session.pendingTap = pendingTap ?? null;
}

export function handleScrollDragMove(
  session: ScrollDragSession,
  pointer: Phaser.Input.Pointer,
  axis: ScrollDragAxis,
  applyOffset: (offset: number) => void
): boolean {
  if (session.pointerId !== pointer.id || !pointer.isDown) return false;

  const current = axis === 'x' ? pointer.x : pointer.y;
  if (!session.dragActive) {
    if (Math.abs(current - session.startPrimary) < SCROLL_DRAG_THRESHOLD_PX) return false;
    session.dragActive = true;
    session.pendingTap = null;
  }

  const delta = current - session.startPrimary;
  applyOffset(session.startScrollOffset - delta);
  return true;
}

export function endScrollDrag(session: ScrollDragSession): void {
  if (!session.dragActive && session.pendingTap) {
    session.pendingTap();
  }
  session.pointerId = null;
  session.dragActive = false;
  session.pendingTap = null;
}

export function clearScrollDrag(session: ScrollDragSession): void {
  session.pointerId = null;
  session.dragActive = false;
  session.pendingTap = null;
}

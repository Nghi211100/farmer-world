/** Screen-space movement above this (px) counts as pan/drag, not a tile click. */
export const POINTER_DRAG_THRESHOLD_PX = 10;

export function pointerDragDistanceSq(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy;
}

export function exceedsDragThreshold(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thresholdPx = POINTER_DRAG_THRESHOLD_PX
): boolean {
  const t = thresholdPx;
  return pointerDragDistanceSq(x0, y0, x1, y1) > t * t;
}

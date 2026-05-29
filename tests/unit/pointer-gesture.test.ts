import { describe, expect, it } from 'vitest';
import {
  exceedsDragThreshold,
  POINTER_DRAG_THRESHOLD_PX,
  pointerDragDistanceSq,
} from '../../src/utils/pointerGesture';

describe('pointerGesture', () => {
  it('uses 10px drag threshold constant', () => {
    expect(POINTER_DRAG_THRESHOLD_PX).toBe(10);
  });

  it('treats movement within threshold as click', () => {
    expect(exceedsDragThreshold(0, 0, 9, 0)).toBe(false);
    expect(exceedsDragThreshold(0, 0, 0, 9)).toBe(false);
    expect(exceedsDragThreshold(0, 0, 7, 7)).toBe(false);
  });

  it('treats movement beyond threshold as drag', () => {
    expect(exceedsDragThreshold(0, 0, 11, 0)).toBe(true);
    expect(exceedsDragThreshold(0, 0, 8, 8)).toBe(true);
  });

  it('pointerDragDistanceSq is symmetric', () => {
    expect(pointerDragDistanceSq(1, 2, 4, 6)).toBe(pointerDragDistanceSq(4, 6, 1, 2));
  });
});

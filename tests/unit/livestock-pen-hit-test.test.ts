import { describe, expect, it } from 'vitest';
import { penFootprintCells } from '../../src/config/livestockAssets';
import { createNewPen } from '../../src/systems/livestockLogic';
import {
  pickLivestockPenAtGridCell,
  type LivestockPenHitCandidate,
} from '../../src/utils/livestockPenHitTest';

function candidate(
  partial: Partial<LivestockPenHitCandidate> & Pick<LivestockPenHitCandidate, 'id'>
): LivestockPenHitCandidate {
  return {
    id: partial.id,
    gridX: partial.gridX ?? 8,
    gridY: partial.gridY ?? 8,
    level: partial.level ?? 1,
    depth: partial.depth ?? 0,
    visible: partial.visible ?? true,
    alpha: partial.alpha ?? 1,
  };
}

describe('pickLivestockPenAtGridCell', () => {
  it('hits footprint cells only (level 1 = 3×3)', () => {
    const pen = createNewPen('duck-pen', 'duck', 8, 8, 1);
    const hits = candidate({ id: pen.id, gridX: 8, gridY: 8, level: 1 });
    const inner = penFootprintCells(pen)[0]!;
    expect(pickLivestockPenAtGridCell([hits], inner.gx, inner.gy)?.id).toBe(pen.id);
    expect(pickLivestockPenAtGridCell([hits], 8, 8)?.id).toBe(pen.id);
  });

  it('does not hit grass ring outside duck footprint', () => {
    const pen = createNewPen('duck-pen', 'duck', 8, 8, 1);
    const hits = candidate({ id: pen.id, gridX: 8, gridY: 8, level: 1 });
    expect(pickLivestockPenAtGridCell([hits], 7, 8)).toBeUndefined();
  });

  it('does not hit adjacent grass outside footprint', () => {
    const pen = createNewPen('sheep-pen', 'sheep', 8, 8, 1);
    const hits = candidate({ id: pen.id, gridX: 8, gridY: 8, level: 1 });
    expect(pickLivestockPenAtGridCell([hits], 7, 8)).toBeUndefined();
    expect(pickLivestockPenAtGridCell([hits], 11, 8)).toBeUndefined();
    expect(pickLivestockPenAtGridCell([hits], 8, 7)).toBeUndefined();
    expect(pickLivestockPenAtGridCell([hits], 8, 11)).toBeUndefined();
  });

  it('level 2 pen uses 4×4 footprint (16 cells)', () => {
    const pen = createNewPen('cow-pen', 'cow', 5, 5, 2);
    const hits = candidate({ id: pen.id, gridX: 5, gridY: 5, level: 2 });
    expect(penFootprintCells(pen)).toHaveLength(16);
    expect(pickLivestockPenAtGridCell([hits], 8, 8)?.id).toBe(pen.id);
    expect(pickLivestockPenAtGridCell([hits], 4, 5)).toBeUndefined();
  });

  it('prefers higher depth when footprints overlap', () => {
    const hit = pickLivestockPenAtGridCell(
      [
        candidate({ id: 'pen-back', depth: 10, gridX: 8, gridY: 8 }),
        candidate({ id: 'pen-front', depth: 20, gridX: 8, gridY: 8 }),
      ],
      8,
      8
    );
    expect(hit?.id).toBe('pen-front');
  });

  it('ignores hidden and transparent pens', () => {
    const hit = pickLivestockPenAtGridCell(
      [
        candidate({ id: 'hidden', visible: false }),
        candidate({ id: 'transparent', alpha: 0 }),
      ],
      8,
      8
    );
    expect(hit).toBeUndefined();
  });
});

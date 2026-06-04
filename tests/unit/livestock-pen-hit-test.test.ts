import { describe, expect, it } from 'vitest';
import {
  pickLivestockPenAtWorldPoint,
  type LivestockPenHitCandidate,
} from '../../src/utils/livestockPenHitTest';

function candidate(
  partial: Partial<LivestockPenHitCandidate> & Pick<LivestockPenHitCandidate, 'id'>
): LivestockPenHitCandidate {
  return {
    id: partial.id,
    gridX: partial.gridX ?? 0,
    gridY: partial.gridY ?? 0,
    depth: partial.depth ?? 0,
    visible: partial.visible ?? true,
    alpha: partial.alpha ?? 1,
    bounds: partial.bounds ?? { x: 100, y: 100, width: 80, height: 60 },
    footprintBounds: partial.footprintBounds,
  };
}

describe('pickLivestockPenAtWorldPoint', () => {
  it('selects visible pen by world bounds', () => {
    const hit = pickLivestockPenAtWorldPoint([candidate({ id: 'pen-a' })], 120, 120);
    expect(hit?.id).toBe('pen-a');
  });

  it('prefers higher depth when overlap', () => {
    const hit = pickLivestockPenAtWorldPoint(
      [candidate({ id: 'pen-back', depth: 10 }), candidate({ id: 'pen-front', depth: 20 })],
      130,
      130
    );
    expect(hit?.id).toBe('pen-front');
  });

  it('ignores hidden and transparent pens', () => {
    const hit = pickLivestockPenAtWorldPoint(
      [
        candidate({ id: 'hidden', visible: false }),
        candidate({ id: 'transparent', alpha: 0 }),
      ],
      120,
      120
    );
    expect(hit).toBeUndefined();
  });

  it('uses footprint bounds so art outside grid does not steal clicks', () => {
    const hit = pickLivestockPenAtWorldPoint(
      [
        candidate({
          id: 'pen-wide-art',
          bounds: { x: 50, y: 50, width: 200, height: 200 },
          footprintBounds: { x: 100, y: 100, width: 40, height: 40 },
        }),
      ],
      60,
      60
    );
    expect(hit).toBeUndefined();

    const inside = pickLivestockPenAtWorldPoint(
      [
        candidate({
          id: 'pen-wide-art',
          bounds: { x: 50, y: 50, width: 200, height: 200 },
          footprintBounds: { x: 100, y: 100, width: 40, height: 40 },
        }),
      ],
      120,
      120
    );
    expect(inside?.id).toBe('pen-wide-art');
  });
});

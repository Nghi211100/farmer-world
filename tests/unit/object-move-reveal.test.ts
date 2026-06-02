import { describe, expect, it } from 'vitest';
import type { LivestockPenData } from '../../src/config/LivestockConfig';
import type { MoveSession } from '../../src/systems/ObjectEditSystem';
import { penIdAfterConfirmedMove } from '../../src/utils/objectMoveReveal';

describe('objectMoveReveal', () => {
  it('returns pen id from session before confirm clears it', () => {
    const pen: LivestockPenData = {
      id: 'pen-cow-1',
      animalType: 'cow',
      gridX: 2,
      gridY: 3,
      state: 'idle',
      level: 1,
    };
    const session: MoveSession = {
      originGx: 2,
      originGy: 3,
      payload: { kind: 'pen', pen },
    };
    expect(penIdAfterConfirmedMove(session)).toBe('pen-cow-1');
    expect(penIdAfterConfirmedMove(null)).toBeNull();
    expect(
      penIdAfterConfirmedMove({
        originGx: 0,
        originGy: 0,
        payload: { kind: 'natural', textureKey: 'tree_01' },
      })
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { LivestockPenData } from '../../src/config/LivestockConfig';
import type { MoveSession } from '../../src/systems/ObjectEditSystem';
import {
  buildingSpriteKeyAt,
  penDataAfterMove,
  penIdAfterConfirmedMove,
} from '../../src/utils/objectMoveReveal';

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

  it('resolves pen by id after anchor changes', () => {
    const pen: LivestockPenData = {
      id: 'pen-chicken-1',
      animalType: 'chicken',
      gridX: 10,
      gridY: 11,
      state: 'idle',
      level: 1,
    };
    const session: MoveSession = {
      originGx: 4,
      originGy: 5,
      payload: {
        kind: 'pen',
        pen: { ...pen, gridX: 4, gridY: 5 },
      },
    };
    const moved = [{ ...pen, gridX: 10, gridY: 11 }];
    expect(penDataAfterMove(moved, session, 10, 11)?.gridX).toBe(10);
    expect(penDataAfterMove(moved, session, 99, 99)?.id).toBe('pen-chicken-1');
  });

  it('formats building sprite keys', () => {
    expect(buildingSpriteKeyAt(3, 7)).toBe('3,7');
  });
});

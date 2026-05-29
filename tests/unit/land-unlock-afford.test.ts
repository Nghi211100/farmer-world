import { describe, expect, it } from 'vitest';
import {
  canAffordLandUnlock,
  DEFAULT_COINS,
  LAND_UNLOCK_COST,
} from '../../src/config/gameConfig';

describe('canAffordLandUnlock', () => {
  it('allows purchase when coins meet or exceed cost', () => {
    expect(canAffordLandUnlock(2000, 2000)).toBe(true);
    expect(canAffordLandUnlock(2500, 2000)).toBe(true);
  });

  it('blocks purchase when coins are below cost', () => {
    expect(canAffordLandUnlock(DEFAULT_COINS, LAND_UNLOCK_COST)).toBe(false);
    expect(canAffordLandUnlock(1999, 2000)).toBe(false);
  });
});

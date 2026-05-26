import { describe, expect, it } from 'vitest';
import { CROPS } from '../../src/config/CropConfig';
import {
  advanceCropGrowth,
  isCropDry,
  remainingGrowSec,
} from '../../src/systems/farmingGrowthLogic';

describe('farmingGrowthLogic', () => {
  it('matures carrot in growTimeSec when each milestone is watered', () => {
    const def = CROPS.carrot;
    let state = advanceCropGrowth(
      { growthElapsedSec: 0, wateredMilestoneCount: 0 },
      120,
      def
    );
    state = { ...state, wateredMilestoneCount: 1 };
    state = advanceCropGrowth(state, 120, def);
    expect(state.growthElapsedSec).toBe(def.growTimeSec);
    expect(isCropDry(state, def.waterMilestonesSec)).toBe(false);
  });

  it('becomes dry at first water milestone', () => {
    const def = CROPS.carrot;
    const state = advanceCropGrowth(
      { growthElapsedSec: 0, wateredMilestoneCount: 0 },
      120,
      def
    );
    expect(state.growthElapsedSec).toBe(120);
    expect(isCropDry(state, def.waterMilestonesSec)).toBe(true);
  });

  it('dry wall time extends harvest (penalty persists after watering)', () => {
    const def = CROPS.carrot;
    let state = advanceCropGrowth(
      { growthElapsedSec: 0, wateredMilestoneCount: 0 },
      120,
      def
    );
    expect(isCropDry(state, def.waterMilestonesSec)).toBe(true);
    state = advanceCropGrowth(state, 60, def);
    expect(state.growthElapsedSec).toBe(150);
    state = {
      ...state,
      wateredMilestoneCount: 1,
    };
    expect(isCropDry(state, def.waterMilestonesSec)).toBe(false);
    state = advanceCropGrowth(state, 90, def);
    expect(state.growthElapsedSec).toBe(240);
    const idealRemaining = remainingGrowSec(
      { growthElapsedSec: 120, wateredMilestoneCount: 1 },
      def
    );
    expect(idealRemaining).toBe(120);
    const penalizedRemaining = remainingGrowSec(state, def);
    expect(penalizedRemaining).toBe(0);
  });

  it('tomato has two water milestones', () => {
    const def = CROPS.tomato;
    expect(def.waterMilestonesSec).toEqual([180, 300]);
    expect(def.growTimeSec).toBe(360);
  });
});

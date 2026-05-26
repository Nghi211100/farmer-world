import { describe, expect, it } from 'vitest';
import { ENERGY } from '../../src/config/gameConfig';
import { EnergySystem } from '../../src/systems/EnergySystem';

describe('EnergySystem', () => {
  it('recovers +1 per recoveryIntervalMs when idle', () => {
    const t0 = 1_000_000;
    const energy = new EnergySystem(50, t0);
    const gained = energy.applyRecovery(t0 + ENERGY.recoveryIntervalMs);
    expect(gained).toBe(1);
    expect(energy.getEnergy()).toBe(51);
  });

  it('drains -1 per activeDrainIntervalMs when active', () => {
    const t0 = 2_000_000;
    const energy = new EnergySystem(10, t0);
    const lost = energy.applyActiveDrain(t0 + ENERGY.activeDrainIntervalMs);
    expect(lost).toBe(-1);
    expect(energy.getEnergy()).toBe(9);
  });

  it('caps recovery at max energy', () => {
    const t0 = 3_000_000;
    const energy = new EnergySystem(ENERGY.max, t0);
    energy.applyRecovery(t0 + ENERGY.recoveryIntervalMs * 5);
    expect(energy.getEnergy()).toBe(ENERGY.max);
  });

  it('does not drain below zero', () => {
    const t0 = 4_000_000;
    const energy = new EnergySystem(1, t0);
    energy.applyActiveDrain(t0 + ENERGY.activeDrainIntervalMs * 3);
    expect(energy.getEnergy()).toBe(0);
  });
});

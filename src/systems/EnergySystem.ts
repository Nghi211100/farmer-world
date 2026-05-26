import { ENERGY } from '../config/gameConfig';

export class EnergySystem {
  private energy: number;
  private energyUpdatedAt: number;

  constructor(initialEnergy = ENERGY.defaultEnergy, updatedAt = Date.now()) {
    this.energy = Math.min(ENERGY.max, Math.max(0, initialEnergy));
    this.energyUpdatedAt = updatedAt;
  }

  getEnergy(): number {
    return this.energy;
  }

  getUpdatedAt(): number {
    return this.energyUpdatedAt;
  }

  setEnergy(value: number, updatedAt?: number): void {
    this.energy = Math.min(ENERGY.max, Math.max(0, value));
    if (updatedAt !== undefined) this.energyUpdatedAt = updatedAt;
  }

  canSpend(cost = ENERGY.actionCost): boolean {
    return this.energy >= cost;
  }

  spend(cost = ENERGY.actionCost): boolean {
    if (!this.canSpend(cost)) return false;
    this.energy -= cost;
    this.energyUpdatedAt = Date.now();
    return true;
  }

  add(amount: number): void {
    this.energy = Math.min(ENERGY.max, this.energy + amount);
    this.energyUpdatedAt = Date.now();
  }

  /** +recoveryAmount per recoveryIntervalMs while idle (online tick or offline on load). */
  applyRecovery(now = Date.now()): number {
    return this.applyTimedDelta(
      now,
      ENERGY.recoveryIntervalMs,
      ENERGY.recoveryAmount
    );
  }

  /** -activeDrainAmount per activeDrainIntervalMs while moving or farming. */
  applyActiveDrain(now = Date.now()): number {
    return this.applyTimedDelta(
      now,
      ENERGY.activeDrainIntervalMs,
      -ENERGY.activeDrainAmount
    );
  }

  private applyTimedDelta(now: number, intervalMs: number, delta: number): number {
    const elapsed = Math.max(0, now - this.energyUpdatedAt);
    const steps = Math.floor(elapsed / intervalMs);
    if (steps <= 0) return 0;
    const before = this.energy;
    if (delta > 0) {
      this.energy = Math.min(ENERGY.max, this.energy + steps * delta);
    } else {
      this.energy = Math.max(0, this.energy + steps * delta);
    }
    this.energyUpdatedAt += steps * intervalMs;
    return this.energy - before;
  }

  exportState(): { energy: number; energyUpdatedAt: number } {
    return { energy: this.energy, energyUpdatedAt: this.energyUpdatedAt };
  }
}

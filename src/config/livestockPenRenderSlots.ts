import type { AnimalType } from './LivestockConfig';

export interface LivestockRenderSlotPosition {
  x: number;
  y: number;
}

export function visibleLivestockRenderCount(
  stockCount: number,
  capacity: number,
  visualCap = 4
): number {
  const normalizedStock = Math.max(0, Math.floor(stockCount));
  const normalizedCapacity = Math.max(0, Math.floor(capacity));
  const normalizedVisualCap = Math.max(0, Math.floor(visualCap));
  return Math.min(normalizedStock, normalizedCapacity, normalizedVisualCap);
}

export function livestockRenderSlotPositions(
  count: number,
  penWidth: number,
  penHeight: number,
  animalType?: AnimalType
): LivestockRenderSlotPosition[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  const genericSlots: LivestockRenderSlotPosition[] = [
    { x: -0.22, y: -0.46 },
    { x: 0.22, y: -0.46 },
    { x: -0.22, y: -0.34 },
    { x: 0.22, y: -0.34 },
  ];
  const fishSlots: LivestockRenderSlotPosition[] = [
    { x: -0.27, y: -0.42 },
    { x: 0.27, y: -0.42 },
    { x: 0, y: -0.32 },
    { x: 0, y: -0.52 },
  ];
  const pigSlots: LivestockRenderSlotPosition[] = [
    { x: -0.24, y: -0.44 },
    { x: 0.24, y: -0.44 },
    { x: -0.06, y: -0.33 },
    { x: 0.06, y: -0.33 },
  ];
  const ruminantSlots: LivestockRenderSlotPosition[] = [
    { x: -0.20, y: -0.48 },
    { x: 0.20, y: -0.48 },
    { x: -0.20, y: -0.35 },
    { x: 0.20, y: -0.35 },
  ];
  const highCountSlots: LivestockRenderSlotPosition[] = [
    { x: -0.28, y: -0.50 },
    { x: -0.09, y: -0.53 },
    { x: 0.10, y: -0.50 },
    { x: 0.29, y: -0.53 },
    { x: -0.28, y: -0.37 },
    { x: -0.09, y: -0.40 },
    { x: 0.10, y: -0.37 },
    { x: 0.29, y: -0.40 },
  ];
  const level1Base = animalType === 'fish'
    ? fishSlots
    : animalType === 'pig'
      ? pigSlots
      : animalType === 'goat' || animalType === 'sheep'
        ? ruminantSlots
        : genericSlots;
  const base = n <= 4 ? level1Base : highCountSlots;
  return base.slice(0, n).map((slot) => ({
    x: penWidth * slot.x,
    y: penHeight * slot.y,
  }));
}

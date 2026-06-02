import type { AnimalType, LivestockPenKind } from './LivestockConfig';

/**
 * Default top-left anchor (grid coords) for each species pen on the 20×20 map.
 * Chosen on outer **grass** (not soil/water), 3×3 footprints do not overlap.
 *
 * | Species / kind | Anchor (gx, gy) | Corner cells (inclusive) |
 * |----------------|-----------------|---------------------------|
 * | chicken        | (1, 2)          | x 1–3, y 2–4              |
 * | ruminant (dê/cừu) | (6, 2)       | x 6–8, y 2–4              |
 * | cow            | (15, 2)         | x 15–17, y 2–4            |
 * | duck           | (1, 16)         | x 1–3, y 16–18            |
 * | fish           | (16, 16)        | x 16–18, y 16–18          |
 * | pig            | (15, 8)         | x 15–17, y 8–10           |
 */
export type LivestockPenAnchor =
  | { animalType: AnimalType; gridX: number; gridY: number }
  | { penKind: LivestockPenKind; gridX: number; gridY: number };

export const DEFAULT_LIVESTOCK_PEN_ANCHORS: ReadonlyArray<LivestockPenAnchor> = [
  { animalType: 'chicken', gridX: 1, gridY: 2 },
  { penKind: 'ruminant', gridX: 6, gridY: 2 },
  { animalType: 'cow', gridX: 15, gridY: 2 },
  { animalType: 'duck', gridX: 1, gridY: 16 },
  { animalType: 'fish', gridX: 16, gridY: 16 },
  { animalType: 'pig', gridX: 15, gridY: 8 },
] as const;

/** Shop + save normalization (includes goat/sheep animals, not separate pens). */
export const LIVESTOCK_SPECIES_ORDER: readonly AnimalType[] = [
  'chicken',
  'goat',
  'cow',
  'duck',
  'fish',
  'pig',
  'sheep',
];

/** Species with their own dedicated buildable pen (not ruminant). */
export const DEDICATED_PEN_SPECIES: readonly AnimalType[] = [
  'chicken',
  'cow',
  'duck',
  'fish',
  'pig',
];

export function defaultPenIdForSpecies(animalType: AnimalType): string {
  return `pen-${animalType}`;
}

export function defaultRuminantPenId(): string {
  return 'pen-ruminant';
}

export function isRuminantPenAnchor(
  anchor: LivestockPenAnchor
): anchor is { penKind: LivestockPenKind; gridX: number; gridY: number } {
  return 'penKind' in anchor && anchor.penKind === 'ruminant';
}

import { describe, expect, it } from 'vitest';
import { LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import { BUILD_MODAL_VISIBLE_CARD_SLOTS } from '../../src/ui/buildModalLayout';
import { RUMINANT_PEN_LABEL_VI } from '../../src/config/LivestockConfig';

describe('BuildPanel livestock scroll hits', () => {
  it('has more pen cards than visible slots (last card needs scroll)', () => {
    expect(LIVESTOCK_PEN_PLACE_ITEMS.length).toBeGreaterThan(BUILD_MODAL_VISIBLE_CARD_SLOTS);
    const ruminant = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant');
    expect(ruminant?.label).toBe(RUMINANT_PEN_LABEL_VI);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.at(-1)?.placeTarget).toBe('ruminant');
  });
});

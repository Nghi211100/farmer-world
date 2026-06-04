import { describe, expect, it } from 'vitest';
import { LIVESTOCK_PEN_MAX_LEVEL } from '../../src/config/LivestockConfig';
import { createNewPen, stockPenWithAnimal } from '../../src/systems/livestockLogic';
import {
  getPenMoveBlockMessage,
  getPenObjectEditDisabledActions,
  getPenObjectEditHiddenActions,
  getPenObjectEditVisibleActions,
  isPenAtMaxLevel,
} from '../../src/systems/livestockLogic';

describe('pen object-edit popup actions', () => {
  it('hides upgrade at max level and disables move while producing', () => {
    const stocked = stockPenWithAnimal(
      createNewPen('prod-pen', 'sheep', 7, 9, 1),
      'sheep',
      () => 0
    )!;
    const producing = { ...stocked, state: 'producing' as const };
    expect(getPenMoveBlockMessage(producing)).toMatch(/sản xuất/i);
    expect(
      getPenObjectEditDisabledActions(producing, {
        upgradeBlocked: true,
        canAffordUpgrade: false,
        canSellAll: true,
      })
    ).toEqual(expect.arrayContaining(['move', 'upgrade']));

    const maxPen = { ...stocked, level: LIVESTOCK_PEN_MAX_LEVEL };
    expect(isPenAtMaxLevel(maxPen)).toBe(true);
    expect(getPenObjectEditHiddenActions(maxPen)).toEqual(['upgrade']);
    expect(getPenObjectEditVisibleActions(maxPen)).toEqual(['move', 'feed', 'sellAll']);
  });

  it('disables upgrade when ring blocked or unaffordable but keeps button when not max', () => {
    const pen = stockPenWithAnimal(createNewPen('up-pen', 'sheep', 3, 3, 1), 'sheep', () => 0)!;
    expect(
      getPenObjectEditDisabledActions(pen, {
        upgradeBlocked: true,
        canAffordUpgrade: true,
        canSellAll: true,
      })
    ).toEqual(['upgrade']);
    expect(
      getPenObjectEditDisabledActions(pen, {
        upgradeBlocked: false,
        canAffordUpgrade: false,
        canSellAll: true,
      })
    ).toEqual(['upgrade']);
    expect(getPenObjectEditVisibleActions(pen)).toContain('upgrade');
  });
});

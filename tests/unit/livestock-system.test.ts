import { describe, expect, it } from 'vitest';
import {
  canStockAnimal,
  canStockPenWith,
  collectFromPen,
  createNewPen,
  createRuminantPen,
  feedPen,
  findPenForStocking,
  stockPenWithAnimal,
  tickLivestockPen,
  upgradePen,
} from '../../src/systems/livestockLogic';
import { resolveLivestockAnimalTextureKey } from '../../src/config/livestockAssets';
import { LIVESTOCK_ANIMALS } from '../../src/config/LivestockConfig';
import { ITEM_IDS } from '../../src/config/items';

describe('livestockLogic', () => {
  it('stocks empty pen and feeds into producing then ready', () => {
    let pen = createNewPen('p1', 'chicken', 3, 4);
    expect(pen.state).toBe('unstocked');

    const stocked = stockPenWithAnimal(pen, 'chicken', () => 0);
    expect(stocked?.state).toBe('idle');
    expect(stocked?.stage).toBeDefined();
    expect(stocked?.animalTextureKey).toBe(
      resolveLivestockAnimalTextureKey('chicken', stocked!.stage!, stocked!.variant!)
    );
    pen = stocked!;

    const fed = feedPen(pen, 1000);
    expect(fed?.state).toBe('producing');
    expect(fed?.readyAt).toBe(1000 + LIVESTOCK_ANIMALS.chicken.produceMs);
    pen = fed!;

    const still = tickLivestockPen(pen, 1000 + 1000);
    expect(still.state).toBe('producing');

    const ready = tickLivestockPen(pen, fed!.readyAt!);
    expect(ready.state).toBe('ready');

    const collected = collectFromPen(ready, fed!.readyAt! + 1);
    expect(collected?.productItemId).toBe(ITEM_IDS.EGG);
    expect(collected?.pen.state).toBe('idle');
  });

  it('cow produces milk', () => {
    let pen = createNewPen('c1', 'cow', 1, 1);
    pen = stockPenWithAnimal(pen, 'cow')!;
    pen = feedPen(pen, 0)!;
    const ready = tickLivestockPen(pen, pen.readyAt!);
    const out = collectFromPen(ready, pen.readyAt!);
    expect(out?.productItemId).toBe(ITEM_IDS.MILK);
  });

  it('ruminant pen accepts goat or sheep from shop, one animal', () => {
    const pen = createRuminantPen('r1', 4, 4, 1);
    expect(canStockAnimal(pen)).toBe(false);
    expect(canStockPenWith(pen, 'goat')).toBe(true);
    expect(canStockPenWith(pen, 'sheep')).toBe(true);
    const stocked = stockPenWithAnimal(pen, 'sheep');
    expect(stocked?.state).toBe('idle');
    expect(stocked?.animalTextureKey).toMatch(/^sheep_/);
    expect(canStockPenWith(stocked!, 'goat')).toBe(false);
  });

  it('goat in ruminant pen produces goat milk', () => {
    let pen = createRuminantPen('g1', 2, 2);
    pen = stockPenWithAnimal(pen, 'goat')!;
    pen = feedPen(pen, 0)!;
    const ready = tickLivestockPen(pen, pen.readyAt!);
    const out = collectFromPen(ready, pen.readyAt!);
    expect(out?.productItemId).toBe(ITEM_IDS.GOAT_MILK);
  });

  it('upgradePen moves footprint from 3×3 to 4×4', () => {
    const pen = createNewPen('u1', 'cow', 2, 3, 1);
    expect(pen.level).toBe(1);
    const up = upgradePen(pen);
    expect(up?.level).toBe(2);
  });

  it('findPenForStocking links goat and sheep to same empty ruminant pen', () => {
    const pens = [createRuminantPen('r1', 0, 0)];
    expect(findPenForStocking(pens, 'goat')?.id).toBe('r1');
    expect(findPenForStocking(pens, 'sheep')?.id).toBe('r1');
  });

  it('pig produces pork', () => {
    let pen = createNewPen('p1', 'pig', 2, 2);
    pen = stockPenWithAnimal(pen, 'pig')!;
    pen = feedPen(pen, 500)!;
    const ready = tickLivestockPen(pen, pen.readyAt!);
    const out = collectFromPen(ready, pen.readyAt!);
    expect(out?.productItemId).toBe(ITEM_IDS.PORK);
  });
});

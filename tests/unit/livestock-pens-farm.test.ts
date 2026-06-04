import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVESTOCK_PEN_ANCHORS,
  defaultPenIdForSpecies,
} from '../../src/config/livestockPenLayout';
import {
  getShopLivestockAnimalType,
  getShopLivestockPrice,
  SHOP_LIVESTOCK_IDS,
} from '../../src/config/shopLivestock';
import { GridSystem } from '../../src/systems/GridSystem';
import { LivestockSystem, LIVESTOCK_PEN_PLACE_ITEMS } from '../../src/systems/LivestockSystem';
import {
  createDefaultFarmPens,
  createNewPen,
  findPenForStocking,
  getPenForSpecies,
  getPenObjectEditDisabledActions,
  normalizeSavedLivestockPens,
  penUpgradeExpansionCells,
  stockPenWithAnimal,
} from '../../src/systems/livestockLogic';
import { penFootprintCells } from '../../src/config/livestockAssets';

describe('livestockPenLayout (reference only)', () => {
  it('documents non-overlapping default anchors for dev maps', () => {
    const occupied = new Set<string>();
    for (const pen of createDefaultFarmPens()) {
      for (const { gx, gy } of penFootprintCells(pen)) {
        const key = `${gx},${gy}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
    expect(DEFAULT_LIVESTOCK_PEN_ANCHORS).toHaveLength(6);
    expect(defaultPenIdForSpecies('chicken')).toBe('pen-chicken');
  });
});

describe('LivestockSystem — player-placed pens', () => {
  function addWaterBorder(grid: GridSystem): void {
    for (let x = 0; x < grid.size; x++) {
      grid.setCell(x, 0, { type: 'water', walkable: false });
      grid.setCell(x, grid.size - 1, { type: 'water', walkable: false });
    }
    for (let y = 1; y < grid.size - 1; y++) {
      grid.setCell(0, y, { type: 'water', walkable: false });
      grid.setCell(grid.size - 1, y, { type: 'water', walkable: false });
    }
  }

  function seedVoidAsGrass(grid: GridSystem): void {
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.getCell(x, y)?.type === 'void') {
          grid.setCell(x, y, { type: 'grass', walkable: true });
        }
      }
    }
  }

  function emptyFarm(seedGrass = true) {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    if (seedGrass) seedVoidAsGrass(grid);
    const livestock = new LivestockSystem(grid);
    livestock.loadPens([]);
    return { grid, livestock };
  }

  it('starts with no pens until Build placement', () => {
    const { livestock } = emptyFarm();
    expect(livestock.getPens()).toHaveLength(0);
  });

  it('findFirstValidPenPlacement skips soil and blocked cells', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    const spot = livestock.findFirstValidPenPlacement('chicken', 1);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(livestock.canPlace(spot.gx, spot.gy)).toBe(true);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const cell = grid.getCell(spot.gx + dx, spot.gy + dy);
        expect(cell?.type).not.toBe('soil');
        expect(cell?.type).not.toBe('water');
      }
    }
  });

  it('findFirstValidPenPlacement returns null when no 3×3 grass fits', () => {
    const { grid, livestock } = emptyFarm(false);
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        grid.setCell(gx, gy, { type: 'water', walkable: false });
      }
    }
    livestock.enterPlaceMode(item);
    expect(livestock.findFirstValidPenPlacement('chicken', 1)).toBeNull();
  });

  it('lockPreviewAt keeps ghost while placeDragging updates position', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    const spot = livestock.findFirstValidPenPlacement('duck', 1);
    expect(spot).not.toBeNull();
    livestock.lockPreviewAt(spot!.gx, spot!.gy);
    livestock.startPlaceDrag();
    livestock.updateGhost(spot!.gx + 2, spot!.gy + 1);
    expect(livestock.ghostX).toBe(spot!.gx + 2);
    expect(livestock.ghostY).toBe(spot!.gy + 1);
    livestock.finishPlaceDrag();
    expect(livestock.previewLocked).toBe(true);
  });

  it('canMovePenTo allows shifting 3×3 pen one tile (ignores own footprint)', () => {
    const { grid, livestock } = emptyFarm();
    const anchorGx = 10;
    const anchorGy = 10;
    for (let dy = -1; dy <= 4; dy++) {
      for (let dx = -1; dx <= 4; dx++) {
        const gx = anchorGx + dx;
        const gy = anchorGy + dy;
        if (!grid.inBounds(gx, gy)) continue;
        grid.setCell(gx, gy, { type: 'grass', walkable: true });
        grid.clearObject(gx, gy);
      }
    }
    const pen = createNewPen('pen-move-test', 'chicken', anchorGx, anchorGy, 1);
    livestock.loadPens([pen]);
    expect(livestock.canMovePenTo(pen, anchorGx + 1, anchorGy)).toBe(true);
    expect(livestock.canMovePenTo(pen, anchorGx, anchorGy + 1)).toBe(true);
  });

  it('place() adds pen on valid grass tile', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placedAt = -1;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (livestock.canPlace(gx, gy)) {
          placedAt = gx;
          const pen = livestock.place(gx, gy);
          expect(pen?.animalType).toBe('chicken');
          expect(pen?.state).toBe('unstocked');
          break outer;
        }
      }
    }
    expect(placedAt).toBeGreaterThanOrEqual(0);
    expect(livestock.getPens()).toHaveLength(1);
  });

  it('stockSpeciesPen uses first empty pen of species', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'duck')!;
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const stocked = livestock.stockSpeciesPen('duck');
    expect(stocked?.state).toBe('idle');
    expect(stocked?.animalTextureKey).toBeTruthy();
    expect(livestock.stockSpeciesPen('duck')?.stockCount).toBe(2);
  });

  it('keeps stocked animal state after export/load', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const stocked = livestock.stockSpeciesPen('chicken');
    expect(stocked?.state).toBe('idle');
    expect(stocked?.animalTextureKey).toBeTruthy();

    const reloaded = new LivestockSystem(grid);
    reloaded.loadPens(livestock.exportPens());
    const loadedPen = reloaded.getPens()[0];
    expect(loadedPen?.state).toBe('idle');
    expect(loadedPen?.animalTextureKey).toBe(stocked?.animalTextureKey);
  });

  it('normalizeSavedLivestockPens keeps saved pens without filling defaults', () => {
    const saved = [
      {
        id: 'pen-cow-1',
        animalType: 'cow' as const,
        gridX: 10,
        gridY: 10,
        state: 'unstocked' as const,
        level: 1 as const,
      },
    ];
    const loaded = normalizeSavedLivestockPens(saved);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.gridX).toBe(10);
  });

  it('normalizeSavedLivestockPens migrates legacy ruminant single animal', () => {
    const loaded = normalizeSavedLivestockPens([
      {
        id: 'pen-ruminant-legacy',
        penKind: 'ruminant' as const,
        animalType: 'goat' as const,
        gridX: 6,
        gridY: 6,
        state: 'idle' as const,
        level: 1 as const,
        stage: 'adult' as const,
        variant: 0,
        animalTextureKey: 'goat_ault',
      },
    ]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.ruminantOccupants).toEqual([
      expect.objectContaining({
        animalType: 'goat',
        stage: 'adult',
        variant: 0,
        animalTextureKey: 'goat_ault',
        growthStartAt: expect.any(Number),
        lifecycleState: expect.any(String),
      }),
    ]);
  });

  it('shared ruminant pen stocks goat then sheep in two slots', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
    expect(item.textureKey).toBe('sheep_house');
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const pens = livestock.getPens();
    expect(pens[0]?.penKind).toBe('ruminant');
    expect(findPenForStocking(pens, 'goat')).toBeDefined();
    expect(findPenForStocking(pens, 'sheep')).toBeDefined();
    const goat = livestock.stockSpeciesPen('goat');
    expect(goat?.animalType).toBe('goat');
    const sheep = livestock.stockSpeciesPen('sheep');
    expect(sheep?.id).toBe(goat?.id);
    expect(sheep?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
    expect(livestock.stockSpeciesPen('sheep')?.stockCount).toBe(3);
    expect(livestock.stockSpeciesPen('goat')?.stockCount).toBe(4);
    expect(livestock.stockSpeciesPen('goat')).toBeNull();
    expect(getPenForSpecies(livestock.getPens(), 'goat')?.id).toBe(goat?.id);
    expect(getPenForSpecies(livestock.getPens(), 'sheep')?.id).toBe(goat?.id);
  });

  it('shared ruminant pen stocks sheep then goat in two slots', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    const sheep = livestock.stockSpeciesPen('sheep');
    expect(sheep?.animalType).toBe('sheep');
    const goat = livestock.stockSpeciesPen('goat');
    expect(goat?.id).toBe(sheep?.id);
    expect(goat?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
    expect(livestock.stockSpeciesPen('goat')?.stockCount).toBe(3);
    expect(livestock.stockSpeciesPen('sheep')?.stockCount).toBe(4);
    expect(livestock.stockSpeciesPen('sheep')).toBeNull();
  });

  it('shared ruminant pen save/load keeps both occupants', () => {
    const { grid, livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'ruminant')!;
    livestock.enterPlaceMode(item);
    let placed = false;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        if (livestock.canPlace(gx, gy) && livestock.place(gx, gy)) {
          placed = true;
          break outer;
        }
      }
    }
    expect(placed).toBe(true);
    livestock.exitPlaceMode();
    expect(livestock.stockSpeciesPen('goat')?.id).toBeTruthy();
    expect(livestock.stockSpeciesPen('sheep')?.id).toBeTruthy();

    const reloaded = new LivestockSystem(grid);
    reloaded.loadPens(livestock.exportPens());
    const loaded = reloaded.getPens()[0];
    expect(loaded?.penKind).toBe('ruminant');
    expect(loaded?.ruminantOccupants?.map((o) => o.animalType)).toEqual(['goat', 'sheep']);
  });

  it('upgrade 3×3 → 4×4 requires seven free ring cells and updates footprint', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placed: ReturnType<LivestockSystem['place']> = null;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        placed = livestock.canPlace(gx, gy) ? livestock.place(gx, gy) : null;
        if (placed) break outer;
      }
    }
    livestock.exitPlaceMode();
    expect(placed).not.toBeNull();
    const pen = placed!;
    expect(penUpgradeExpansionCells(pen)).toHaveLength(7);
    expect(livestock.canUpgradeAt(pen)).toBe(true);
    expect(livestock.tryUpgrade(pen)?.level).toBe(2);
    expect(penFootprintCells(livestock.getPenAt(pen.gridX, pen.gridY)!).length).toBe(16);
  });

  it('upgrade fails when 4×4 ring is blocked by another pen', () => {
    const { grid, livestock } = emptyFarm();
    const anchorGx = 10;
    const anchorGy = 10;
    for (let dy = -2; dy <= 6; dy++) {
      for (let dx = -2; dx <= 7; dx++) {
        const gx = anchorGx + dx;
        const gy = anchorGy + dy;
        if (!grid.inBounds(gx, gy)) continue;
        grid.setCell(gx, gy, { type: 'grass', walkable: true });
        grid.clearObject(gx, gy);
      }
    }
    const penA = createNewPen('pen-a', 'chicken', anchorGx, anchorGy, 1);
    const penB = createNewPen('pen-b', 'chicken', anchorGx + 3, anchorGy, 1);
    livestock.loadPens([penA, penB]);
    expect(livestock.canUpgradeAt(penA)).toBe(false);
    expect(livestock.tryUpgrade(penA)).toBeNull();
  });

  it('can upgrade while pen lifecycle is producing (animals stay)', () => {
    const { livestock } = emptyFarm();
    const pen = stockPenWithAnimal(createNewPen('prod-up', 'chicken', 4, 4), 'chicken', () => 0)!;
    const producing = { ...pen, state: 'producing' as const };
    livestock.loadPens([producing]);
    expect(livestock.canUpgradeAt(producing)).toBe(true);
    const upgraded = livestock.tryUpgrade(producing);
    expect(upgraded?.level).toBe(2);
    expect(upgraded?.state).toBe('producing');
    expect(upgraded?.penAnimals?.length).toBe(pen.penAnimals?.length);
    expect(livestock.getPenAt(4, 4)?.level).toBe(2);
  });

  it('upgrade ring allows grass/path with stale walkable=false and no object', () => {
    const { grid, livestock } = emptyFarm();
    const pen = createNewPen('orphan-walk', 'chicken', 10, 10, 1);
    livestock.loadPens([pen]);
    for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
      grid.setCell(gx, gy, { type: 'grass', walkable: false });
    }
    expect(livestock.canUpgradeAt(pen)).toBe(true);
    expect(livestock.tryUpgrade(pen)?.level).toBe(2);
  });

  it('tryUpgrade persists when pen id differs but anchor matches', () => {
    const { livestock } = emptyFarm();
    const placed = createNewPen('pen-chicken-1', 'chicken', 10, 10, 1);
    livestock.loadPens([placed]);
    const staleRef = { ...placed, id: 'stale-copy-id' };
    const upgraded = livestock.tryUpgrade(staleRef);
    expect(upgraded?.level).toBe(2);
    expect(livestock.getPenAt(10, 10)?.level).toBe(2);
  });

  it('upgrade ring ignores stale livestock_pen grid markers without a pen', () => {
    const { grid, livestock } = emptyFarm();
    const pen = createNewPen('stale-ring', 'chicken', 10, 10, 1);
    livestock.loadPens([pen]);
    for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
      grid.setObject(gx, gy, 'livestock_pen_chicken');
    }
    expect(livestock.canUpgradeAt(pen)).toBe(true);
    expect(livestock.tryUpgrade(pen)?.level).toBe(2);
  });

  it('default pig pen can upgrade when grass ring is clear', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const livestock = new LivestockSystem(grid);
    const pig = createDefaultFarmPens().find((p) => p.animalType === 'pig')!;
    for (const { gx, gy } of penUpgradeExpansionCells(pig)) {
      if (!grid.inBounds(gx, gy)) continue;
      if (grid.getCell(gx, gy)?.type === 'soil' || grid.getCell(gx, gy)?.type === 'path') {
        continue;
      }
      grid.setCell(gx, gy, { type: 'grass', walkable: true });
    }
    livestock.loadPens([pig]);
    expect(livestock.canUpgradeAt(pig)).toBe(true);
    expect(livestock.tryUpgrade(pig)?.level).toBe(2);
  });

  it('default ruminant pen can upgrade when grass ring is clear', () => {
    const grid = new GridSystem();
    grid.generatePlaceholderMap();
    const livestock = new LivestockSystem(grid);
    const ruminant = createDefaultFarmPens().find((p) => p.penKind === 'ruminant')!;
    for (const { gx, gy } of penUpgradeExpansionCells(ruminant)) {
      if (!grid.inBounds(gx, gy)) continue;
      if (grid.getCell(gx, gy)?.type === 'soil' || grid.getCell(gx, gy)?.type === 'path') {
        continue;
      }
      grid.setCell(gx, gy, { type: 'grass', walkable: true });
    }
    livestock.loadPens([ruminant]);
    expect(livestock.canUpgradeAt(ruminant)).toBe(true);
    expect(livestock.tryUpgrade(ruminant)?.level).toBe(2);
  });

  it('upgrade ring allows soil tiles but blocks another pen', () => {
    const { grid, livestock } = emptyFarm();
    const anchorGx = 12;
    const anchorGy = 12;
    for (let dy = -1; dy <= 4; dy++) {
      for (let dx = -1; dx <= 4; dx++) {
        const gx = anchorGx + dx;
        const gy = anchorGy + dy;
        if (!grid.inBounds(gx, gy)) continue;
        grid.setCell(gx, gy, { type: 'grass', walkable: true });
        grid.clearObject(gx, gy);
      }
    }
    const pen = createNewPen('soil-up', 'pig', anchorGx, anchorGy, 1);
    livestock.loadPens([pen]);
    for (const { gx, gy } of penUpgradeExpansionCells(pen)) {
      grid.setCell(gx, gy, { type: 'soil', walkable: false });
    }
    expect(livestock.canUpgradeAt(pen)).toBe(true);
    expect(livestock.tryUpgrade(pen)?.level).toBe(2);
  });

  it('lv2 pens stock up to eight animals', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let penId = '';
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        const pen = livestock.canPlace(gx, gy) ? livestock.place(gx, gy) : null;
        if (pen) {
          penId = pen.id;
          break outer;
        }
      }
    }
    livestock.exitPlaceMode();
    const placed = livestock.getPens().find((p) => p.id === penId)!;
    expect(livestock.tryUpgrade(placed)?.level).toBe(2);
    for (let i = 0; i < 8; i++) {
      const stocked = livestock.stockSpeciesPen('chicken');
      expect(stocked).not.toBeNull();
    }
    expect(livestock.stockSpeciesPen('chicken')).toBeNull();
  });

  it('rejects level-1 placement where 4×4 upgrade ring hits water border', () => {
    const { grid, livestock } = emptyFarm();
    addWaterBorder(grid);
    let footprintOnly: { gx: number; gy: number } | null = null;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (
          livestock.canPlaceFootprint(gx, gy, { w: 3, h: 3 }) &&
          livestock.getUpgradeRingBlockAtAnchor(gx, gy)?.includes('nước')
        ) {
          footprintOnly = { gx, gy };
          break;
        }
      }
      if (footprintOnly) break;
    }
    expect(footprintOnly).not.toBeNull();
    expect(livestock.canPlace(footprintOnly!.gx, footprintOnly!.gy)).toBe(false);
  });

  it('empty placed pen on clear grass can upgrade to 4×4', () => {
    const { livestock } = emptyFarm();
    const item = LIVESTOCK_PEN_PLACE_ITEMS.find((i) => i.placeTarget === 'chicken')!;
    livestock.enterPlaceMode(item);
    let placed: ReturnType<LivestockSystem['place']> = null;
    outer: for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) {
        if (!livestock.canPlace(gx, gy)) continue;
        placed = livestock.place(gx, gy);
        if (placed) break outer;
      }
    }
    livestock.exitPlaceMode();
    expect(placed).not.toBeNull();
    expect(livestock.getPenUpgradeBlockMessage(placed!)).toBeNull();
    expect(livestock.canUpgradeAt(placed!)).toBe(true);
    expect(livestock.tryUpgrade(placed!)?.level).toBe(2);
  });

  it('pen near water border stays upgrade-blocked with Vietnamese water message', () => {
    const { grid, livestock } = emptyFarm();
    addWaterBorder(grid);
    let nearWater: { gx: number; gy: number } | null = null;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        if (!livestock.canPlaceFootprint(gx, gy, { w: 3, h: 3 })) continue;
        const block = livestock.getUpgradeRingBlockAtAnchor(gx, gy);
        if (block?.includes('nước')) {
          nearWater = { gx, gy };
          break;
        }
      }
      if (nearWater) break;
    }
    expect(nearWater).not.toBeNull();
    const pen = createNewPen('near-water', 'chicken', nearWater!.gx, nearWater!.gy, 1);
    livestock.loadPens([pen]);
    expect(livestock.canUpgradeAt(pen)).toBe(false);
    expect(livestock.getPenUpgradeBlockMessage(pen)).toMatch(/nước/i);
    expect(
      getPenObjectEditDisabledActions(pen, {
        upgradeBlocked: true,
        canAffordUpgrade: true,
        canSellAll: false,
      })
    ).toEqual(expect.arrayContaining(['upgrade']));
  });

  it('recovers legacy pens from grid livestock markers', () => {
    const { grid, livestock } = emptyFarm();
    for (let y = 5; y <= 7; y++) {
      for (let x = 5; x <= 7; x++) {
        grid.setObject(x, y, 'livestock_pen_chicken');
      }
    }
    for (let y = 10; y <= 13; y++) {
      for (let x = 10; x <= 13; x++) {
        grid.setObject(x, y, 'livestock_pen_ruminant');
      }
    }

    const recovered = livestock.recoverPensFromGridMarkers();
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toMatchObject({
      animalType: 'chicken',
      gridX: 5,
      gridY: 5,
      level: 1,
      state: 'unstocked',
    });
    expect(recovered[1]).toMatchObject({
      penKind: 'ruminant',
      animalType: 'sheep',
      gridX: 10,
      gridY: 10,
      level: 2,
      state: 'unstocked',
    });
  });
});

describe('LIVESTOCK_PEN_PLACE_ITEMS', () => {
  it('has six build cards including one ruminant pen', () => {
    expect(LIVESTOCK_PEN_PLACE_ITEMS).toHaveLength(6);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'ruminant')).toBe(true);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'goat')).toBe(false);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.some((i) => i.placeTarget === 'sheep')).toBe(false);
  });

  it('excludes standalone pen upgrade build card', () => {
    const labels = LIVESTOCK_PEN_PLACE_ITEMS.map((i) => i.label);
    expect(labels.some((l) => /nâng cấp/i.test(l))).toBe(false);
    expect(LIVESTOCK_PEN_PLACE_ITEMS.every((i) => 'placeTarget' in i)).toBe(true);
  });
});

describe('shop livestock catalog', () => {
  it('maps shop ids to species and prices', () => {
    expect(getShopLivestockAnimalType(SHOP_LIVESTOCK_IDS.CHICKEN)).toBe('chicken');
    expect(getShopLivestockPrice(SHOP_LIVESTOCK_IDS.COW)).toBe(80);
  });
});

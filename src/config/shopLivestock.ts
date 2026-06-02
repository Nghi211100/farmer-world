import type { AnimalType } from './LivestockConfig';
import { getLivestockDef, LIVESTOCK_ANIMAL_LIST } from './LivestockConfig';
import { resolveLivestockAnimalTextureKey } from './livestockAssets';

/** Virtual shop ids (not warehouse items): `shop_livestock_{species}`. */
export type ShopLivestockItemId = `shop_livestock_${AnimalType}`;

export const SHOP_LIVESTOCK_IDS = Object.fromEntries(
  LIVESTOCK_ANIMAL_LIST.map((def) => [`${def.type.toUpperCase()}`, `shop_livestock_${def.type}`])
) as Record<string, ShopLivestockItemId> & {
  CHICKEN: ShopLivestockItemId;
  COW: ShopLivestockItemId;
  PIG: ShopLivestockItemId;
  FISH: ShopLivestockItemId;
  DUCK: ShopLivestockItemId;
  SHEEP: ShopLivestockItemId;
  GOAT: ShopLivestockItemId;
};

const SHOP_LIVESTOCK_BY_ID: Record<
  ShopLivestockItemId,
  { animalType: AnimalType; labelVi: string; iconKey: string; price: number }
> = Object.fromEntries(
  LIVESTOCK_ANIMAL_LIST.map((def) => {
    const id = `shop_livestock_${def.type}` as ShopLivestockItemId;
    const iconKey = def.houseOnly
      ? `${def.type}_house`
      : resolveLivestockAnimalTextureKey(def.type, 'child', 0);
    return [
      id,
      {
        animalType: def.type,
        labelVi: def.labelVi,
        iconKey,
        price: def.animalCost,
      },
    ];
  })
) as Record<
  ShopLivestockItemId,
  { animalType: AnimalType; labelVi: string; iconKey: string; price: number }
>;

export const SHOP_LIVESTOCK_CATALOG: ReadonlyArray<{ id: ShopLivestockItemId }> =
  LIVESTOCK_ANIMAL_LIST.filter((def) => !def.houseOnly).map((def) => ({
    id: `shop_livestock_${def.type}` as ShopLivestockItemId,
  }));

export function isShopLivestockId(itemId: string): itemId is ShopLivestockItemId {
  return itemId in SHOP_LIVESTOCK_BY_ID;
}

export function getShopLivestockAnimalType(
  itemId: string
): AnimalType | undefined {
  return SHOP_LIVESTOCK_BY_ID[itemId as ShopLivestockItemId]?.animalType;
}

export function getShopLivestockPrice(itemId: string): number {
  return SHOP_LIVESTOCK_BY_ID[itemId as ShopLivestockItemId]?.price ?? 0;
}

export function getShopLivestockLabel(itemId: string): string {
  const entry = SHOP_LIVESTOCK_BY_ID[itemId as ShopLivestockItemId];
  if (!entry) return itemId;
  const def = getLivestockDef(entry.animalType);
  if (def.houseOnly) return `${entry.labelVi} (sắp có)`;
  return entry.labelVi;
}

export function getShopLivestockIconKey(itemId: string): string {
  return SHOP_LIVESTOCK_BY_ID[itemId as ShopLivestockItemId]?.iconKey ?? 'chicken_child';
}

export function isShopLivestockPurchasable(itemId: string): boolean {
  const type = getShopLivestockAnimalType(itemId);
  if (!type) return false;
  return !getLivestockDef(type).houseOnly;
}

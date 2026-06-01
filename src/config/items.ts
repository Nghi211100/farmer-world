/** Item catalog — categories, prices, energy recovery */

export const ITEM_IDS = {
  WHEAT: 'wheat',
  CORN: 'corn',
  CARROT: 'carrot',
  PUMPKIN: 'pumpkin',
  TOMATO: 'tomato',
  SEEDS_WHEAT: 'wheat_seed',
  SEEDS_CORN: 'corn_seed',
  SEEDS_CARROT: 'carrot_seed',
  SEEDS_PUMPKIN: 'pumpkin_seed',
  SEEDS_TOMATO: 'tomato_seed',
  BREAD: 'bread',
  CAKE: 'cake',
  COOKIE: 'cookie',
  CANDY: 'candy',
  JUICE: 'juice',
  MILK: 'milk',
  FLOUR: 'flour',
  WOOD: 'wood',
  STONE: 'stone',
  ROPE: 'rope',
  IRON: 'iron',
  SHOVEL: 'shovel',
} as const;

export type ItemId = (typeof ITEM_IDS)[keyof typeof ITEM_IDS];

export type ItemCategory = 'resources' | 'seeds' | 'food' | 'materials' | 'tools';

export const ITEM_CATEGORIES: Record<ItemCategory, readonly string[]> = {
  resources: [
    ITEM_IDS.WHEAT,
    ITEM_IDS.CORN,
    ITEM_IDS.CARROT,
    ITEM_IDS.PUMPKIN,
    ITEM_IDS.TOMATO,
  ],
  seeds: [
    ITEM_IDS.SEEDS_WHEAT,
    ITEM_IDS.SEEDS_CORN,
    ITEM_IDS.SEEDS_CARROT,
    ITEM_IDS.SEEDS_PUMPKIN,
    ITEM_IDS.SEEDS_TOMATO,
  ],
  food: [
    ITEM_IDS.BREAD,
    ITEM_IDS.CAKE,
    ITEM_IDS.COOKIE,
    ITEM_IDS.CANDY,
    ITEM_IDS.JUICE,
    ITEM_IDS.MILK,
  ],
  materials: [ITEM_IDS.WOOD, ITEM_IDS.STONE, ITEM_IDS.ROPE, ITEM_IDS.IRON, ITEM_IDS.FLOUR],
  tools: [ITEM_IDS.SHOVEL],
};

export const ALL_ITEM_IDS = [
  ...ITEM_CATEGORIES.resources,
  ...ITEM_CATEGORIES.seeds,
  ...ITEM_CATEGORIES.food,
  ...ITEM_CATEGORIES.materials,
  ...ITEM_CATEGORIES.tools,
] as const;

export const ITEM_LABELS: Record<string, string> = {
  [ITEM_IDS.WHEAT]: 'Wheat',
  [ITEM_IDS.CORN]: 'Corn',
  [ITEM_IDS.CARROT]: 'Carrot',
  [ITEM_IDS.PUMPKIN]: 'Pumpkin',
  [ITEM_IDS.TOMATO]: 'Tomato',
  [ITEM_IDS.SEEDS_WHEAT]: 'Wheat Seeds',
  [ITEM_IDS.SEEDS_CORN]: 'Corn Seeds',
  [ITEM_IDS.SEEDS_CARROT]: 'Carrot Seeds',
  [ITEM_IDS.SEEDS_PUMPKIN]: 'Pumpkin Seeds',
  [ITEM_IDS.SEEDS_TOMATO]: 'Tomato Seeds',
  [ITEM_IDS.BREAD]: 'Bread',
  [ITEM_IDS.CAKE]: 'Cake',
  [ITEM_IDS.COOKIE]: 'Cookie',
  [ITEM_IDS.CANDY]: 'Candy',
  [ITEM_IDS.JUICE]: 'Juice',
  [ITEM_IDS.MILK]: 'Milk',
  [ITEM_IDS.FLOUR]: 'Flour',
  [ITEM_IDS.WOOD]: 'Wood',
  [ITEM_IDS.STONE]: 'Stone',
  [ITEM_IDS.ROPE]: 'Rope',
  [ITEM_IDS.IRON]: 'Iron',
  [ITEM_IDS.SHOVEL]: 'Shovel',
};

export const ITEM_ICON_KEYS: Record<string, string> = {
  [ITEM_IDS.WHEAT]: 'wheat',
  [ITEM_IDS.CORN]: 'item_corn',
  [ITEM_IDS.CARROT]: 'item_carrot',
  [ITEM_IDS.PUMPKIN]: 'item_pumpkin',
  [ITEM_IDS.TOMATO]: 'item_tomato',
  [ITEM_IDS.SEEDS_WHEAT]: 'seed_wheat',
  [ITEM_IDS.SEEDS_CORN]: 'seed_corn',
  [ITEM_IDS.SEEDS_CARROT]: 'seed_carrot',
  [ITEM_IDS.SEEDS_PUMPKIN]: 'seed_pumpkin',
  [ITEM_IDS.SEEDS_TOMATO]: 'seed_tomato',
  [ITEM_IDS.BREAD]: 'bread',
  [ITEM_IDS.CAKE]: 'cake',
  [ITEM_IDS.COOKIE]: 'cookie',
  [ITEM_IDS.CANDY]: 'candy',
  [ITEM_IDS.JUICE]: 'juice',
  [ITEM_IDS.MILK]: 'milk',
  [ITEM_IDS.FLOUR]: 'flour',
  [ITEM_IDS.WOOD]: 'ui_wood',
  [ITEM_IDS.STONE]: 'rock_01',
  [ITEM_IDS.ROPE]: 'seed',
  [ITEM_IDS.IRON]: 'seed',
  [ITEM_IDS.SHOVEL]: 'shovel',
};

/** Seed shop buy prices (coins) */
export const SEED_BUY_PRICES: Record<string, number> = {
  [ITEM_IDS.SEEDS_WHEAT]: 5,
  [ITEM_IDS.SEEDS_CORN]: 8,
  [ITEM_IDS.SEEDS_CARROT]: 10,
  [ITEM_IDS.SEEDS_TOMATO]: 12,
  [ITEM_IDS.SEEDS_PUMPKIN]: 20,
};

/** Food & snack shop buy prices (coins) */
export const FOOD_BUY_PRICES: Record<string, number> = {
  [ITEM_IDS.CANDY]: 8,
  [ITEM_IDS.MILK]: 12,
  [ITEM_IDS.COOKIE]: 15,
  [ITEM_IDS.BREAD]: 18,
  [ITEM_IDS.JUICE]: 25,
  [ITEM_IDS.CAKE]: 40,
  [ITEM_IDS.FLOUR]: 10,
};

/** Resource sell prices (coins per unit) */
export const RESOURCE_SELL_PRICES: Record<string, number> = {
  [ITEM_IDS.WHEAT]: 45,
  [ITEM_IDS.CORN]: 70,
  [ITEM_IDS.CARROT]: 85,
  [ITEM_IDS.TOMATO]: 105,
  [ITEM_IDS.PUMPKIN]: 175,
};

/** Energy restored when consuming food from inventory */
export const FOOD_ENERGY_RECOVERY: Record<string, number> = {
  [ITEM_IDS.CANDY]: 5,
  [ITEM_IDS.MILK]: 8,
  [ITEM_IDS.COOKIE]: 10,
  [ITEM_IDS.BREAD]: 12,
  [ITEM_IDS.JUICE]: 15,
  [ITEM_IDS.CAKE]: 20,
};

export function isFoodItem(itemId: string): boolean {
  return itemId in FOOD_ENERGY_RECOVERY;
}

export function isShopBuyable(itemId: string): boolean {
  return itemId in SEED_BUY_PRICES || itemId in FOOD_BUY_PRICES;
}

export function getItemCategory(itemId: string): ItemCategory | null {
  for (const [cat, ids] of Object.entries(ITEM_CATEGORIES) as [ItemCategory, readonly string[]][]) {
    if (ids.includes(itemId)) return cat;
  }
  return null;
}

export function isSeedItem(itemId: string): boolean {
  return ITEM_CATEGORIES.seeds.includes(itemId);
}

export function isSellableResource(itemId: string): boolean {
  return itemId in RESOURCE_SELL_PRICES;
}

export const ITEM = {
  WOOD: 'wood',
  ORE: 'ore',
  FOOD: 'food',
} as const;

export type ItemId = (typeof ITEM)[keyof typeof ITEM];

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  sprite: string;
}

// Order here is the display order in the storage panel.
export const ITEM_DEFS: readonly ItemDef[] = [
  { id: ITEM.FOOD, name: 'Food', description: 'Feeds your citizens.', sprite: 'food' },
  { id: ITEM.WOOD, name: 'Wood', description: 'Basic building material gathered from trees.', sprite: 'wood' },
  { id: ITEM.ORE, name: 'Ore', description: 'Raw ore mined from deposits.', sprite: 'ore' },
];

export const STARTING_STORAGE: Readonly<Partial<Record<ItemId, number>>> = {
  [ITEM.WOOD]: 500,
  [ITEM.ORE]: 100,
  [ITEM.FOOD]: 1000,
};

export function getItemDef(id: ItemId): ItemDef {
  return ITEM_DEFS.find((def) => def.id === id)!;
}

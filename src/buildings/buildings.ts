import { ITEM, type ItemId } from '../storage/items';

export const BUILDING = {
  CITY: 'city',
} as const;

export type BuildingId = (typeof BUILDING)[keyof typeof BUILDING];

export type BuildingCost = Partial<Record<ItemId, number>>;

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  sprite: string;
  // Footprint in tiles.
  width: number;
  height: number;
  cost: BuildingCost;
  // Cost multiplies by (1 + costGrowth) for each one of this building already built.
  costGrowth: number;
  // Whether every footprint cell must be inside existing territory.
  requiresTerritory: boolean;
  // Movement cost the building's territory reaches out to; 0 claims no territory.
  territoryRange: number;
}

// Order here is the display order in the build menu.
export const BUILDING_DEFS: readonly BuildingDef[] = [
  {
    id: BUILDING.CITY,
    name: 'City',
    description: 'Claims the surrounding land. Other buildings must be built inside its range.',
    sprite: 'city',
    width: 2,
    height: 2,
    cost: { [ITEM.WOOD]: 100 },
    costGrowth: 0.2,
    requiresTerritory: false,
    territoryRange: 30,
  },
];

export function getBuildingDef(id: BuildingId): BuildingDef {
  return BUILDING_DEFS.find((def) => def.id === id)!;
}

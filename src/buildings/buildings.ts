import { TERRAIN, type TerrainId } from '../map/terrain';
import { RESOURCE, type ResourceId } from '../resources/resources';
import { ITEM, type ItemAmounts, type ItemId } from '../storage/items';

export const BUILDING = {
  CITY: 'city',
  FARM: 'farm',
  WOODCUTTER: 'woodcutter',
  MINE: 'mine',
} as const;

export type BuildingId = (typeof BUILDING)[keyof typeof BUILDING];

export type BuildingCost = Partial<Record<ItemId, number>>;

// How many workers a building can employ once placed.
export type JobRule =
  | { kind: 'none' }
  // One job per richnessPerWorker of the resource under the footprint, clamped to [min, max].
  | { kind: 'richness'; richnessPerWorker: number; min: number; max: number }
  // Rounded up so even a single-cell area has a job.
  | { kind: 'area'; cellsPerWorker: number };

// Drag-to-size buildings. The def's width/height are the minimum size.
export interface AreaLimits {
  maxWidth: number;
  maxHeight: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  sprite: string;
  // Footprint in tiles; the minimum footprint for area buildings.
  width: number;
  height: number;
  area?: AreaLimits;
  // For area buildings this is the cost per cell.
  cost: BuildingCost;
  // Cost multiplies by (1 + costGrowth) for each one of this building already built.
  costGrowth: number;
  // Whether every footprint cell must be inside existing territory.
  requiresTerritory: boolean;
  // Movement cost the building's territory reaches out to; 0 claims no territory.
  territoryRange: number;
  // Terrains every footprint cell must be on; omitted allows any passable terrain.
  allowedTerrain?: readonly TerrainId[];
  // Every footprint cell must hold this resource.
  requiredResource?: ResourceId;
  // Removes resource nodes under the footprint instead of refusing to build on them.
  clearsResources: boolean;
  // Stay in build mode after placing so several can be placed in a row.
  repeatPlacement: boolean;
  // Items consumed per tick just to keep the building standing.
  maintenance: ItemAmounts;
  // Citizens living here when the building is placed.
  startingPopulation: number;
  jobs: JobRule;
  // Items produced per worker per tick.
  production: ItemAmounts;
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
    clearsResources: false,
    repeatPlacement: false,
    maintenance: { [ITEM.WOOD]: 0.5 },
    startingPopulation: 20,
    jobs: { kind: 'none' },
    production: {},
  },
  {
    id: BUILDING.FARM,
    name: 'Farm',
    description: 'Drag to mark out a field on grass. Clears trees and ore. One worker per 4 tiles, rounded up.',
    sprite: 'farm',
    width: 1,
    height: 1,
    area: { maxWidth: 10, maxHeight: 10 },
    cost: { [ITEM.WOOD]: 2 },
    costGrowth: 0,
    requiresTerritory: true,
    territoryRange: 0,
    allowedTerrain: [TERRAIN.GRASS],
    clearsResources: true,
    repeatPlacement: true,
    maintenance: {},
    startingPopulation: 0,
    jobs: { kind: 'area', cellsPerWorker: 4 },
    production: { [ITEM.FOOD]: 0.3 },
  },
  {
    id: BUILDING.WOODCUTTER,
    name: 'Woodcutter',
    description: 'Built on a tree. Richer trees employ more workers.',
    sprite: 'woodcutter',
    width: 1,
    height: 1,
    cost: { [ITEM.WOOD]: 20 },
    costGrowth: 0.1,
    requiresTerritory: true,
    territoryRange: 0,
    requiredResource: RESOURCE.TREE,
    clearsResources: false,
    repeatPlacement: true,
    maintenance: {},
    startingPopulation: 0,
    jobs: { kind: 'richness', richnessPerWorker: 50, min: 1, max: 6 },
    production: { [ITEM.WOOD]: 0.25 },
  },
  {
    id: BUILDING.MINE,
    name: 'Mine',
    description: 'Built on an ore deposit. Richer deposits employ more workers.',
    sprite: 'mine',
    width: 1,
    height: 1,
    cost: { [ITEM.WOOD]: 40 },
    costGrowth: 0.15,
    requiresTerritory: true,
    territoryRange: 0,
    requiredResource: RESOURCE.ORE,
    clearsResources: false,
    repeatPlacement: true,
    maintenance: {},
    startingPopulation: 0,
    jobs: { kind: 'richness', richnessPerWorker: 100, min: 1, max: 8 },
    production: { [ITEM.ORE]: 0.1 },
  },
];

export function getBuildingDef(id: BuildingId): BuildingDef {
  return BUILDING_DEFS.find((def) => def.id === id)!;
}

import { TERRAIN, type TerrainId } from '../map/terrain';

export const RESOURCE = {
  TREE: 'tree',
  ORE: 'ore',
} as const;

export type ResourceId = (typeof RESOURCE)[keyof typeof RESOURCE];

// How a multi-frame sprite is shown: 'animate' loops its frames, 'variant' picks one frame per node.
export type SpriteMode = 'animate' | 'variant';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  sprite: string;
  spriteMode: SpriteMode;
  // Multiplier on the Aseprite frame durations for 'animate' mode; below 1 is slower.
  animationSpeed: number;
  // Chance per cell of spawning on each terrain; terrains not listed never spawn this resource.
  spawnChance: Partial<Record<TerrainId, number>>;
  // Node amount is baseRichness * (1 ± richnessVariance), scaled by RICHNESS_MULTIPLIER.
  baseRichness: number;
  richnessVariance: number;
}

export const RICHNESS_MULTIPLIER = 1;
export const SPAWN_CHANCE_MULTIPLIER = 1;

// Order matters: earlier resources claim a cell first, so rarer resources should come first.
export const RESOURCE_DEFS: readonly ResourceDef[] = [
  {
    id: RESOURCE.ORE,
    name: 'Ore',
    sprite: 'ore',
    spriteMode: 'animate',
    animationSpeed: 1,
    spawnChance: { [TERRAIN.STONE]: 0.008, [TERRAIN.GRASS]: 0.001, [TERRAIN.SAND]: 0.001 },
    baseRichness: 500,
    richnessVariance: 0.15,
  },
  {
    id: RESOURCE.TREE,
    name: 'Tree',
    sprite: 'trees',
    spriteMode: 'animate',
    animationSpeed: 0.4,
    spawnChance: { [TERRAIN.GRASS]: 0.03 },
    baseRichness: 200,
    richnessVariance: 0.15,
  },
];

export function getResourceDef(id: ResourceId): ResourceDef {
  return RESOURCE_DEFS.find((def) => def.id === id)!;
}

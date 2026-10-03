import { createRandom } from '../core/random';
import type { MapData, ResourceNode } from '../map/MapData';
import type { TerrainId } from '../map/terrain';
import { RESOURCE_DEFS, RICHNESS_MULTIPLIER, SPAWN_CHANCE_MULTIPLIER, type ResourceDef } from './resources';

// Offsets the map seed so resource rolls don't correlate with the terrain noise.
const RESOURCE_SEED_SALT = 0x9e3779b9;

export function generateResources(map: Pick<MapData, 'seed' | 'terrain'>): Map<number, ResourceNode> {
  const random = createRandom(map.seed ^ RESOURCE_SEED_SALT);
  const resources = new Map<number, ResourceNode>();

  for (let i = 0; i < map.terrain.length; i++) {
    const terrainId = map.terrain[i] as TerrainId;
    for (const def of RESOURCE_DEFS) {
      const chance = (def.spawnChance[terrainId] ?? 0) * SPAWN_CHANCE_MULTIPLIER;
      if (random() >= chance) continue;
      resources.set(i, { id: def.id, amount: rollRichness(def, random) });
      break;
    }
  }

  return resources;
}

function rollRichness(def: ResourceDef, random: () => number): number {
  const variance = (random() * 2 - 1) * def.richnessVariance;
  return Math.round(def.baseRichness * (1 + variance) * RICHNESS_MULTIPLIER);
}

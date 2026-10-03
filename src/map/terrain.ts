export const TERRAIN = {
  DEEP_WATER: 0,
  WATER: 1,
  SAND: 2,
  GRASS: 3,
  STONE: 4,
} as const;

export type TerrainId = (typeof TERRAIN)[keyof typeof TERRAIN];

export interface TerrainDef {
  id: TerrainId;
  name: string;
  maxElevation: number;
  colorLow: number;
  colorHigh: number;
  // Fraction of full walking speed; 0 is impassable. Travel cost between areas derives from this.
  movementSpeed: number;
}

// Ordered by elevation; a cell takes the first terrain whose maxElevation it falls under.
export const TERRAIN_DEFS: readonly TerrainDef[] = [
  { id: TERRAIN.DEEP_WATER, name: 'Deep Water', maxElevation: 0.22, colorLow: 0x0b2a4a, colorHigh: 0x123c66, movementSpeed: 0 },
  { id: TERRAIN.WATER, name: 'Water', maxElevation: 0.3, colorLow: 0x1c5a8c, colorHigh: 0x2f78b0, movementSpeed: 0 },
  { id: TERRAIN.SAND, name: 'Sand', maxElevation: 0.34, colorLow: 0xd9c48a, colorHigh: 0xc9b277, movementSpeed: 0.8 },
  { id: TERRAIN.GRASS, name: 'Grass', maxElevation: 0.55, colorLow: 0x5f9e3c, colorHigh: 0x3b6e26, movementSpeed: 1 },
  { id: TERRAIN.STONE, name: 'Stone', maxElevation: 1, colorLow: 0x7a7468, colorHigh: 0xb5b0a6, movementSpeed: 0.75 },
];

export function terrainForElevation(elevation: number): TerrainDef {
  return TERRAIN_DEFS.find((def) => elevation <= def.maxElevation) ?? TERRAIN_DEFS[TERRAIN_DEFS.length - 1];
}

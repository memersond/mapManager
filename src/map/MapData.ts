import { TERRAIN_DEFS, type TerrainDef } from './terrain';

export interface MapData {
  seed: number;
  width: number;
  height: number;
  elevation: Float32Array;
  terrain: Uint8Array;
}

export interface CellInfo {
  x: number;
  y: number;
  terrain: TerrainDef;
  resources: string[];
}

export function cellIndex(map: MapData, x: number, y: number): number {
  return y * map.width + x;
}

export function isInBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getCellInfo(map: MapData, x: number, y: number): CellInfo {
  const terrainId = map.terrain[cellIndex(map, x, y)];
  return {
    x,
    y,
    terrain: TERRAIN_DEFS.find((def) => def.id === terrainId)!,
    resources: [],
  };
}

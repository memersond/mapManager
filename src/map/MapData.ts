import { getResourceDef, type ResourceDef, type ResourceId } from '../resources/resources';
import { TERRAIN_DEFS, type TerrainDef } from './terrain';

export interface MapData {
  seed: number;
  width: number;
  height: number;
  elevation: Float32Array;
  terrain: Uint8Array;
  // Keyed by cell index; at most one resource node per cell.
  resources: Map<number, ResourceNode>;
}

export interface ResourceNode {
  id: ResourceId;
  amount: number;
}

export interface CellResource {
  def: ResourceDef;
  amount: number;
}

export interface CellInfo {
  x: number;
  y: number;
  terrain: TerrainDef;
  resources: CellResource[];
}

export function cellIndex(map: MapData, x: number, y: number): number {
  return y * map.width + x;
}

export function isInBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getCellInfo(map: MapData, x: number, y: number): CellInfo {
  const index = cellIndex(map, x, y);
  const node = map.resources.get(index);
  return {
    x,
    y,
    terrain: TERRAIN_DEFS.find((def) => def.id === map.terrain[index])!,
    resources: node ? [{ def: getResourceDef(node.id), amount: node.amount }] : [],
  };
}

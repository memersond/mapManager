import { MinHeap } from '../core/MinHeap';
import { cellIndex, isInBounds, type MapData } from './MapData';
import { TERRAIN_DEFS } from './terrain';

const ORTHOGONAL_STEP = 1;
const DIAGONAL_STEP = Math.SQRT2;

const NEIGHBOURS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const SPEED_BY_TERRAIN: number[] = [];
for (const def of TERRAIN_DEFS) SPEED_BY_TERRAIN[def.id] = def.movementSpeed;

export function movementSpeedAt(map: MapData, index: number): number {
  return SPEED_BY_TERRAIN[map.terrain[index]] ?? 0;
}

export function isPassable(map: MapData, index: number): boolean {
  return movementSpeedAt(map, index) > 0;
}

// Dijkstra outward from the source cells. Entering a cell costs step length / its movement speed.
// Returns every reachable cell within maxCost, mapped to its cost.
export function cellsWithinCost(map: MapData, sources: readonly number[], maxCost: number): Map<number, number> {
  const costs = new Map<number, number>();
  const heap = new MinHeap<number>();
  for (const source of sources) {
    costs.set(source, 0);
    heap.push(source, 0);
  }

  while (heap.size) {
    const index = heap.pop()!;
    const cost = costs.get(index)!;
    const x = index % map.width;
    const y = (index - x) / map.width;

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isInBounds(map, nx, ny)) continue;

      const neighbour = cellIndex(map, nx, ny);
      const speed = movementSpeedAt(map, neighbour);
      if (speed <= 0) continue;

      const diagonal = dx !== 0 && dy !== 0;
      // No cutting corners past impassable cells.
      if (diagonal && (!isPassable(map, cellIndex(map, nx, y)) || !isPassable(map, cellIndex(map, x, ny)))) continue;

      const next = cost + (diagonal ? DIAGONAL_STEP : ORTHOGONAL_STEP) / speed;
      if (next > maxCost || next >= (costs.get(neighbour) ?? Infinity)) continue;
      costs.set(neighbour, next);
      heap.push(neighbour, next);
    }
  }

  return costs;
}

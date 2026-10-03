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

// Cost of stepping between two neighbouring cells, as used by every search here.
export function stepCost(map: MapData, from: number, to: number): number {
  const diagonal = from % map.width !== to % map.width && Math.floor(from / map.width) !== Math.floor(to / map.width);
  return (diagonal ? DIAGONAL_STEP : ORTHOGONAL_STEP) / movementSpeedAt(map, to);
}

// Entering a cell costs step length / its movement speed. Diagonals can't cut corners past impassable cells.
function forEachStep(map: MapData, index: number, visit: (neighbour: number, stepCost: number) => void) {
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
    if (diagonal && (!isPassable(map, cellIndex(map, nx, y)) || !isPassable(map, cellIndex(map, x, ny)))) continue;

    visit(neighbour, (diagonal ? DIAGONAL_STEP : ORTHOGONAL_STEP) / speed);
  }
}

// Dijkstra outward from the source cells. Returns every reachable cell within maxCost, mapped to its cost.
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
    forEachStep(map, index, (neighbour, stepCost) => {
      const next = cost + stepCost;
      if (next > maxCost || next >= (costs.get(neighbour) ?? Infinity)) return;
      costs.set(neighbour, next);
      heap.push(neighbour, next);
    });
  }

  return costs;
}

// Indexed like MapData.terrain.
export interface PathTree {
  // Travel cost to the nearest source; Infinity where unreachable.
  cost: Float64Array;
  // Next cell towards that source; -1 at sources and unreachable cells.
  parent: Int32Array;
  // The source cell each cell leads to; -1 where unreachable.
  origin: Int32Array;
}

// Dijkstra from all sources at once, covering the whole map.
export function shortestPathTree(map: MapData, sources: readonly number[]): PathTree {
  const size = map.width * map.height;
  const tree: PathTree = {
    cost: new Float64Array(size).fill(Infinity),
    parent: new Int32Array(size).fill(-1),
    origin: new Int32Array(size).fill(-1),
  };
  const heap = new MinHeap<number>();
  for (const source of sources) {
    tree.cost[source] = 0;
    tree.origin[source] = source;
    heap.push(source, 0);
  }

  while (heap.size) {
    const index = heap.pop()!;
    const cost = tree.cost[index];
    forEachStep(map, index, (neighbour, stepCost) => {
      const next = cost + stepCost;
      if (next >= tree.cost[neighbour]) return;
      tree.cost[neighbour] = next;
      tree.parent[neighbour] = index;
      tree.origin[neighbour] = tree.origin[index];
      heap.push(neighbour, next);
    });
  }

  return tree;
}

// Cells from start to its source, both included.
export function treePath(tree: PathTree, start: number): number[] {
  const path = [start];
  for (let cell = tree.parent[start]; cell !== -1; cell = tree.parent[cell]) path.push(cell);
  return path;
}

export interface FoundPath {
  // Cells from a source to a target, both included.
  path: number[];
  cost: number;
}

// Cheapest path from any source to any target, or null if none is reachable.
export function findPath(map: MapData, sources: readonly number[], targets: ReadonlySet<number>): FoundPath | null {
  const costs = new Map<number, number>();
  const parents = new Map<number, number>();
  const heap = new MinHeap<number>();
  for (const source of sources) {
    costs.set(source, 0);
    heap.push(source, 0);
  }

  while (heap.size) {
    const index = heap.pop()!;
    const cost = costs.get(index)!;
    if (targets.has(index)) {
      const path = [index];
      for (let cell = parents.get(index); cell !== undefined; cell = parents.get(cell)) path.push(cell);
      return { path: path.reverse(), cost };
    }
    forEachStep(map, index, (neighbour, stepCost) => {
      const next = cost + stepCost;
      if (next >= (costs.get(neighbour) ?? Infinity)) return;
      costs.set(neighbour, next);
      parents.set(neighbour, index);
      heap.push(neighbour, next);
    });
  }

  return null;
}

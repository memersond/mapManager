import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { cellIndex, isInBounds, type MapData } from '../map/MapData';
import { cellsWithinCost, isPassable } from '../map/movement';
import type { TerrainId } from '../map/terrain';
import type { ItemId } from '../storage/items';
import type { Storage } from '../storage/Storage';
import type { BuildingCost, BuildingDef } from './buildings';

export interface Building {
  id: number;
  def: BuildingDef;
  x: number;
  y: number;
  width: number;
  height: number;
  population: number;
  // Workers the building can employ.
  jobs: number;
  // Workers currently assigned, set by EconomySystem.
  workers: number;
}

export interface BuildingPlacedPayload {
  building: Building;
}

export interface ResourcesClearedPayload {
  indices: number[];
}

export interface TerritoryChangedPayload {
  map: MapData;
  // 1 for cells inside territory, indexed like MapData.terrain.
  territory: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PLACEMENT_ERROR = {
  OUT_OF_BOUNDS: 'Out of bounds',
  IMPASSABLE: 'Cannot build on impassable terrain',
  OCCUPIED: 'Space is occupied',
  RESOURCE: 'Cannot build on a resource',
  WRONG_TERRAIN: 'Cannot build on this terrain',
  MISSING_RESOURCE: 'Must be built on the required resource',
  WRONG_SIZE: 'Invalid size',
  OUTSIDE_TERRITORY: 'Must be built inside a city range',
  CANNOT_AFFORD: 'Not enough resources',
} as const;

export type PlacementError = (typeof PLACEMENT_ERROR)[keyof typeof PLACEMENT_ERROR];

// Owns placed buildings, cell occupancy and territory. Rebuilt from scratch on each new map.
export class BuildingSystem {
  private map?: MapData;
  private buildings: Building[] = [];
  private occupancy = new Map<number, Building>();
  private territory = new Uint8Array(0);
  private nextId = 1;

  constructor(private storage: Storage) {
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }

  // Area buildings pay their per-cell cost for every cell; defaults to the minimum footprint.
  getCost(def: BuildingDef, cells = def.width * def.height): BuildingCost {
    const multiplier = Math.pow(1 + def.costGrowth, this.countBuilt(def)) * (def.area ? cells : 1);
    const cost: BuildingCost = {};
    for (const [itemId, amount] of Object.entries(def.cost) as [ItemId, number][]) {
      cost[itemId] = Math.round(amount * multiplier);
    }
    return cost;
  }

  canAfford(def: BuildingDef, cells?: number): boolean {
    return (Object.entries(this.getCost(def, cells)) as [ItemId, number][]).every(([itemId, amount]) =>
      this.storage.has(itemId, amount),
    );
  }

  getBuildings(): readonly Building[] {
    return this.buildings;
  }

  countBuilt(def: BuildingDef): number {
    return this.buildings.filter((building) => building.def === def).length;
  }

  // Returns why the building can't occupy rect, or null if it can.
  checkPlacement(def: BuildingDef, rect: Rect): PlacementError | null {
    const map = this.map;
    if (!map) return PLACEMENT_ERROR.OUT_OF_BOUNDS;
    if (!isValidSize(def, rect)) return PLACEMENT_ERROR.WRONG_SIZE;

    for (const { cx, cy } of rectCells(rect)) {
      if (!isInBounds(map, cx, cy)) return PLACEMENT_ERROR.OUT_OF_BOUNDS;
      const index = cellIndex(map, cx, cy);
      if (!isPassable(map, index)) return PLACEMENT_ERROR.IMPASSABLE;
      if (this.occupancy.has(index)) return PLACEMENT_ERROR.OCCUPIED;
      if (def.allowedTerrain && !def.allowedTerrain.includes(map.terrain[index] as TerrainId)) {
        return PLACEMENT_ERROR.WRONG_TERRAIN;
      }
      const resource = map.resources.get(index);
      if (def.requiredResource) {
        if (resource?.id !== def.requiredResource) return PLACEMENT_ERROR.MISSING_RESOURCE;
      } else if (resource && !def.clearsResources) {
        return PLACEMENT_ERROR.RESOURCE;
      }
      if (def.requiresTerritory && !this.territory[index]) return PLACEMENT_ERROR.OUTSIDE_TERRITORY;
    }

    return this.canAfford(def, rect.width * rect.height) ? null : PLACEMENT_ERROR.CANNOT_AFFORD;
  }

  // Territory the building would claim on its own at rect, or null if it claims none or the footprint is invalid.
  previewTerritory(def: BuildingDef, rect: Rect): TerritoryChangedPayload | null {
    const map = this.map;
    if (!map || def.territoryRange <= 0) return null;
    for (const { cx, cy } of rectCells(rect)) {
      if (!isInBounds(map, cx, cy) || !isPassable(map, cellIndex(map, cx, cy))) return null;
    }

    const territory = new Uint8Array(map.width * map.height);
    for (const index of territoryCells(map, def, rect)) territory[index] = 1;
    return { map, territory };
  }

  place(def: BuildingDef, rect: Rect): Building | null {
    const map = this.map;
    if (this.checkPlacement(def, rect) || !map) return null;

    for (const [itemId, amount] of Object.entries(this.getCost(def, rect.width * rect.height)) as [ItemId, number][]) {
      this.storage.remove(itemId, amount);
    }

    const cells = footprint(map, rect);
    const building: Building = {
      id: this.nextId++,
      def,
      ...rect,
      population: def.startingPopulation,
      jobs: countJobs(map, def, cells),
      workers: 0,
    };
    this.buildings.push(building);
    for (const index of cells) this.occupancy.set(index, building);
    if (def.clearsResources) this.clearResources(map, cells);

    const payload: BuildingPlacedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_PLACED, payload);

    if (def.territoryRange > 0) this.claimTerritory(building);
    return building;
  }

  private clearResources(map: MapData, cells: number[]) {
    const indices = cells.filter((index) => map.resources.delete(index));
    if (!indices.length) return;
    const payload: ResourcesClearedPayload = { indices };
    EventBus.emit(GAME_EVENTS.RESOURCES_CLEARED, payload);
  }

  private claimTerritory(building: Building) {
    for (const index of territoryCells(this.map!, building.def, building)) this.territory[index] = 1;
    this.emitTerritory();
  }

  private onMapGenerated(map: MapData) {
    this.map = map;
    this.buildings = [];
    this.occupancy.clear();
    this.territory = new Uint8Array(map.width * map.height);
    this.emitTerritory();
  }

  private emitTerritory() {
    const payload: TerritoryChangedPayload = { map: this.map!, territory: this.territory };
    EventBus.emit(GAME_EVENTS.TERRITORY_CHANGED, payload);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }
}

export function defaultRect(def: BuildingDef, x: number, y: number): Rect {
  return { x, y, width: def.width, height: def.height };
}

function isValidSize(def: BuildingDef, { width, height }: Rect): boolean {
  if (!def.area) return width === def.width && height === def.height;
  return width >= def.width && height >= def.height && width <= def.area.maxWidth && height <= def.area.maxHeight;
}

function* rectCells({ x, y, width, height }: Rect) {
  for (let cy = y; cy < y + height; cy++) {
    for (let cx = x; cx < x + width; cx++) yield { cx, cy };
  }
}

function footprint(map: MapData, rect: Rect): number[] {
  return Array.from(rectCells(rect), ({ cx, cy }) => cellIndex(map, cx, cy));
}

function territoryCells(map: MapData, def: BuildingDef, rect: Rect): Iterable<number> {
  return cellsWithinCost(map, footprint(map, rect), def.territoryRange).keys();
}

// Must run before resources under the footprint are cleared.
function countJobs(map: MapData, def: BuildingDef, cells: number[]): number {
  const rule = def.jobs;
  switch (rule.kind) {
    case 'none':
      return 0;
    case 'area':
      return Math.ceil(cells.length / rule.cellsPerWorker);
    case 'richness': {
      const richness = cells.reduce((sum, index) => {
        const node = map.resources.get(index);
        return node && node.id === def.requiredResource ? sum + node.amount : sum;
      }, 0);
      return Math.min(rule.max, Math.max(rule.min, Math.floor(richness / rule.richnessPerWorker)));
    }
  }
}

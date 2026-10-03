import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { RouteNetwork } from '../logistics/RouteNetwork';
import { cellIndex, isInBounds, type MapData } from '../map/MapData';
import { cellsWithinCost, isPassable } from '../map/movement';
import { footprint, rectCells, type Rect } from '../map/rect';
import type { TerrainId } from '../map/terrain';
import { itemEntries, STARTING_STORAGE, type ItemId } from '../storage/items';
import { Storage } from '../storage/Storage';
import type { BuildingCost, BuildingDef } from './buildings';

export type { Rect } from '../map/rect';

export type BuildingStatus = 'queued' | 'complete';

export interface Building {
  id: number;
  def: BuildingDef;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BuildingStatus;
  // Locked in at placement; paid by the nearest city before construction completes.
  cost: BuildingCost;
  population: number;
  // Workers the building can employ.
  jobs: number;
  // Assigned by the player through EconomySystem.
  workers: number;
  haulers: number;
  // A city's stockpile, or output waiting for pickup at a producer.
  storage: Storage;
}

export interface BuildingPlacedPayload {
  building: Building;
}

export interface BuildingCompletedPayload {
  building: Building;
}

export interface BuildingCancelledPayload {
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

export const PLACEMENT_ERROR = {
  OUT_OF_BOUNDS: 'Out of bounds',
  IMPASSABLE: 'Cannot build on impassable terrain',
  OCCUPIED: 'Space is occupied',
  RESOURCE: 'Cannot build on a resource',
  WRONG_TERRAIN: 'Cannot build on this terrain',
  MISSING_RESOURCE: 'Must be built on the required resource',
  WRONG_SIZE: 'Invalid size',
  OUTSIDE_TERRITORY: 'Must be built inside a city range',
  UNREACHABLE: 'No city can reach this spot',
  CANNOT_AFFORD: 'Not enough resources',
} as const;

export type PlacementError = (typeof PLACEMENT_ERROR)[keyof typeof PLACEMENT_ERROR];

// Owns placed buildings, cell occupancy and territory. Rebuilt from scratch on each new map.
// Placed buildings are queued until ConstructionSystem completes them, except the first store,
// which is paid from the starting supplies and completes at once, taking those supplies as its stock.
export class BuildingSystem {
  private map?: MapData;
  private buildings: Building[] = [];
  private occupancy = new Map<number, Building>();
  private territory = new Uint8Array(0);
  private supplies = new Storage(STARTING_STORAGE);
  private nextId = 1;

  constructor(private routes: RouteNetwork) {
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }

  // Area buildings pay their per-cell cost for every cell; defaults to the minimum footprint.
  getCost(def: BuildingDef, cells = def.width * def.height): BuildingCost {
    const multiplier = Math.pow(1 + def.costGrowth, this.countBuilt(def)) * (def.area ? cells : 1);
    const cost: BuildingCost = {};
    for (const [itemId, amount] of itemEntries(def.cost)) cost[itemId] = Math.round(amount * multiplier);
    return cost;
  }

  // Only the first store has to be affordable up front; everything after it queues until paid.
  canAfford(def: BuildingDef, cells?: number): boolean {
    return this.hasStores() || this.supplies.hasAll(this.getCost(def, cells));
  }

  hasStores(): boolean {
    return this.routes.getStores().length > 0;
  }

  // Goods held across every city, or the starting supplies before the first city.
  getStored(itemId: ItemId): number {
    const stores = this.routes.getStores();
    if (!stores.length) return this.supplies.get(itemId);
    return stores.reduce((sum, store) => sum + store.storage.get(itemId), 0);
  }

  getBuildings(): readonly Building[] {
    return this.buildings;
  }

  getBuildingAt(x: number, y: number): Building | undefined {
    if (!this.map || !isInBounds(this.map, x, y)) return undefined;
    return this.occupancy.get(cellIndex(this.map, x, y));
  }

  // Includes queued buildings so cost growth is locked in at placement.
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

    if (this.hasStores() && !this.routes.nearestStore(rect)) return PLACEMENT_ERROR.UNREACHABLE;
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

    const cells = footprint(map, rect);
    const building: Building = {
      id: this.nextId++,
      def,
      name: this.nameFor(def),
      ...rect,
      status: 'queued',
      cost: this.getCost(def, cells.length),
      population: 0,
      jobs: countJobs(map, def, cells),
      workers: 0,
      haulers: 0,
      storage: new Storage(),
    };
    this.buildings.push(building);
    for (const index of cells) this.occupancy.set(index, building);

    const payload: BuildingPlacedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_PLACED, payload);

    if (def.storesGoods && !this.hasStores()) {
      for (const [itemId, amount] of itemEntries(building.cost)) this.supplies.remove(itemId, amount);
      building.storage = this.supplies;
      this.complete(building);
    }
    return building;
  }

  // Called once the cost has been paid.
  complete(building: Building) {
    if (building.status === 'complete') return;
    building.status = 'complete';
    building.population = building.def.startingPopulation;
    if (building.def.clearsResources) this.clearResources(this.map!, footprint(this.map!, building));

    const payload: BuildingCompletedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_COMPLETED, payload);

    if (building.def.territoryRange > 0) this.claimTerritory(building);
  }

  // Only queued buildings can be cancelled; nothing has been paid yet so nothing is refunded.
  cancel(building: Building) {
    if (building.status !== 'queued') return;
    this.buildings = this.buildings.filter((other) => other !== building);
    for (const index of footprint(this.map!, building)) this.occupancy.delete(index);
    const payload: BuildingCancelledPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_CANCELLED, payload);
  }

  private nameFor(def: BuildingDef): string {
    return def.storesGoods ? `${def.name} ${this.countBuilt(def) + 1}` : def.name;
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
    this.supplies = new Storage(STARTING_STORAGE);
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

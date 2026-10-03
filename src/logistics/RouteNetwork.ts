import type { Building, BuildingCompletedPayload } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from '../map/MapData';
import { findPath, shortestPathTree, treePath, type PathTree } from '../map/movement';
import { footprint, type Rect } from '../map/rect';
import { travelTicks } from './logistics';

export interface Route {
  to: Building;
  // Cells from the start to the destination, both included.
  path: readonly number[];
  cost: number;
  // One-way travel time.
  ticks: number;
}

export interface StoreLink {
  store: Building;
  cost: number;
}

// Travel routes to and between buildings that store goods (cities).
// One shortest-path tree from every store answers "nearest store" for any cell; it is rebuilt when a store completes.
export class RouteNetwork {
  private map?: MapData;
  private stores: Building[] = [];
  private storeByCell = new Map<number, Building>();
  private tree?: PathTree;
  private storeRoutes = new Map<Building, Route | null>();
  private betweenRoutes = new Map<string, Route | null>();

  constructor() {
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    EventBus.on(GAME_EVENTS.BUILDING_COMPLETED, this.onBuildingCompleted, this);
  }

  getStores(): readonly Building[] {
    return this.stores;
  }

  // Cheapest store to reach from any cell of rect, which must be in bounds.
  nearestStore(rect: Rect): StoreLink | null {
    if (!this.map || !this.tree) return null;
    let best: StoreLink | null = null;
    for (const cell of footprint(this.map, rect)) {
      const cost = this.tree.cost[cell];
      if (cost === Infinity || (best && cost >= best.cost)) continue;
      best = { store: this.storeByCell.get(this.tree.origin[cell])!, cost };
    }
    return best;
  }

  routeToStore(building: Building): Route | null {
    if (!this.storeRoutes.has(building)) this.storeRoutes.set(building, this.buildStoreRoute(building));
    return this.storeRoutes.get(building)!;
  }

  routeBetween(from: Building, to: Building): Route | null {
    const key = `${from.id}:${to.id}`;
    if (!this.betweenRoutes.has(key)) this.betweenRoutes.set(key, this.buildRouteBetween(from, to));
    return this.betweenRoutes.get(key)!;
  }

  private buildStoreRoute(building: Building): Route | null {
    if (!this.map || !this.tree) return null;
    const tree = this.tree;
    let start = -1;
    for (const cell of footprint(this.map, building)) {
      if (tree.cost[cell] < (start === -1 ? Infinity : tree.cost[start])) start = cell;
    }
    if (start === -1) return null;
    const cost = tree.cost[start];
    return { to: this.storeByCell.get(tree.origin[start])!, path: treePath(tree, start), cost, ticks: travelTicks(cost) };
  }

  private buildRouteBetween(from: Building, to: Building): Route | null {
    if (!this.map) return null;
    const found = findPath(this.map, footprint(this.map, from), new Set(footprint(this.map, to)));
    return found && { to, path: found.path, cost: found.cost, ticks: travelTicks(found.cost) };
  }

  private onBuildingCompleted({ building }: BuildingCompletedPayload) {
    if (!building.def.storesGoods || !this.map) return;
    this.stores.push(building);
    for (const cell of footprint(this.map, building)) this.storeByCell.set(cell, building);
    this.tree = shortestPathTree(this.map, [...this.storeByCell.keys()]);
    this.storeRoutes.clear();
    EventBus.emit(GAME_EVENTS.ROUTES_CHANGED);
  }

  private onMapGenerated(map: MapData) {
    this.map = map;
    this.stores = [];
    this.storeByCell.clear();
    this.tree = undefined;
    this.storeRoutes.clear();
    this.betweenRoutes.clear();
    EventBus.emit(GAME_EVENTS.ROUTES_CHANGED);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    EventBus.off(GAME_EVENTS.BUILDING_COMPLETED, this.onBuildingCompleted, this);
  }
}

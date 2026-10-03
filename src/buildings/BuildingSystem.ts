import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { cellIndex, isInBounds, type MapData } from '../map/MapData';
import { cellsWithinCost, isPassable } from '../map/movement';
import type { ItemId } from '../storage/items';
import type { Storage } from '../storage/Storage';
import type { BuildingCost, BuildingDef } from './buildings';

export interface Building {
  id: number;
  def: BuildingDef;
  x: number;
  y: number;
}

export interface BuildingPlacedPayload {
  building: Building;
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

  getCost(def: BuildingDef): BuildingCost {
    const multiplier = Math.pow(1 + def.costGrowth, this.countBuilt(def));
    const cost: BuildingCost = {};
    for (const [itemId, amount] of Object.entries(def.cost) as [ItemId, number][]) {
      cost[itemId] = Math.round(amount * multiplier);
    }
    return cost;
  }

  canAfford(def: BuildingDef): boolean {
    return (Object.entries(this.getCost(def)) as [ItemId, number][]).every(([itemId, amount]) =>
      this.storage.has(itemId, amount),
    );
  }

  countBuilt(def: BuildingDef): number {
    return this.buildings.filter((building) => building.def === def).length;
  }

  // Returns why the building can't go at (x, y), or null if it can.
  checkPlacement(def: BuildingDef, x: number, y: number): PlacementError | null {
    const map = this.map;
    if (!map) return PLACEMENT_ERROR.OUT_OF_BOUNDS;

    for (let cy = y; cy < y + def.height; cy++) {
      for (let cx = x; cx < x + def.width; cx++) {
        if (!isInBounds(map, cx, cy)) return PLACEMENT_ERROR.OUT_OF_BOUNDS;
        const index = cellIndex(map, cx, cy);
        if (!isPassable(map, index)) return PLACEMENT_ERROR.IMPASSABLE;
        if (this.occupancy.has(index)) return PLACEMENT_ERROR.OCCUPIED;
        if (map.resources.has(index)) return PLACEMENT_ERROR.RESOURCE;
        if (def.requiresTerritory && !this.territory[index]) return PLACEMENT_ERROR.OUTSIDE_TERRITORY;
      }
    }

    return this.canAfford(def) ? null : PLACEMENT_ERROR.CANNOT_AFFORD;
  }

  place(def: BuildingDef, x: number, y: number): Building | null {
    if (this.checkPlacement(def, x, y) || !this.map) return null;

    for (const [itemId, amount] of Object.entries(this.getCost(def)) as [ItemId, number][]) {
      this.storage.remove(itemId, amount);
    }

    const building: Building = { id: this.nextId++, def, x, y };
    this.buildings.push(building);
    for (const index of footprint(this.map, building)) this.occupancy.set(index, building);

    const payload: BuildingPlacedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_PLACED, payload);

    if (def.territoryRange > 0) this.claimTerritory(building);
    return building;
  }

  private claimTerritory(building: Building) {
    const map = this.map!;
    const cells = cellsWithinCost(map, footprint(map, building), building.def.territoryRange);
    for (const index of cells.keys()) this.territory[index] = 1;
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

function footprint(map: MapData, { def, x, y }: Building): number[] {
  const cells: number[] = [];
  for (let cy = y; cy < y + def.height; cy++) {
    for (let cx = x; cx < x + def.width; cx++) cells.push(cellIndex(map, cx, cy));
  }
  return cells;
}

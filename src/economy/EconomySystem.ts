import type { BuildingDef } from '../buildings/buildings';
import type { Building, BuildingCompletedPayload, BuildingSystem } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { SITE_STOCK_CAPACITY } from '../logistics/logistics';
import type { RouteNetwork } from '../logistics/RouteNetwork';
import { AUTO_STAFF_NEW_BUILDINGS, CITIZEN_UPKEEP } from '../population/population';
import { itemEntries, type ItemAmounts, type ItemId } from '../storage/items';
import type { Storage } from '../storage/Storage';

// Per-tick amount: positive for producers, negative for consumers.
export interface FlowEntry {
  label: string;
  amount: number;
}

export type ItemFlows = ReadonlyMap<ItemId, readonly FlowEntry[]>;

export interface FlowsChangedPayload {
  flows: ItemFlows;
}

export interface WorkforceChangedPayload {
  population: number;
  employed: number;
}

export interface StaffingChangedPayload {
  building: Building;
}

export type StaffRole = 'workers' | 'haulers';

const RECOMPUTE_EVENTS = [GAME_EVENTS.MAP_GENERATED, GAME_EVENTS.STAFFING_CHANGED];

// Tracks the labour pool and player staffing, works out per-tick flows, and each tick
// adds production to the producing building's site stock and takes upkeep from city storage.
export class EconomySystem {
  private flows = new Map<ItemId, FlowEntry[]>();
  private population = 0;
  private employed = 0;

  constructor(private buildings: BuildingSystem, private routes: RouteNetwork) {
    for (const event of RECOMPUTE_EVENTS) EventBus.on(event, this.recompute, this);
    EventBus.on(GAME_EVENTS.BUILDING_COMPLETED, this.onBuildingCompleted, this);
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
  }

  getFlows(): ItemFlows {
    return this.flows;
  }

  getAvailable(): number {
    return this.population - this.employed;
  }

  // Clamped to the building's limit and the citizens free to take the job.
  setStaff(building: Building, role: StaffRole, count: number) {
    const limit = role === 'workers' ? building.jobs : building.def.maxHaulers;
    const next = Math.max(0, Math.min(count, limit, building[role] + this.getAvailable()));
    if (building.status !== 'complete' || next === building[role]) return;
    building[role] = next;
    const payload: StaffingChangedPayload = { building };
    EventBus.emit(GAME_EVENTS.STAFFING_CHANGED, payload);
  }

  private onBuildingCompleted({ building }: BuildingCompletedPayload) {
    this.recompute();
    if (!AUTO_STAFF_NEW_BUILDINGS) return;
    this.setStaff(building, 'workers', building.jobs);
    this.setStaff(building, 'haulers', building.def.defaultHaulers);
  }

  private complete(): Building[] {
    return this.buildings.getBuildings().filter((building) => building.status === 'complete');
  }

  private recompute() {
    this.flows = new Map();
    this.population = 0;
    this.employed = 0;
    const byDef = new Map<BuildingDef, Building[]>();

    for (const building of this.complete()) {
      byDef.set(building.def, [...(byDef.get(building.def) ?? []), building]);
      this.population += building.population;
      this.employed += building.workers + building.haulers;
    }

    for (const [def, group] of byDef) {
      const name = group.length > 1 ? `${def.name} ×${group.length}` : def.name;
      const workers = group.reduce((sum, building) => sum + building.workers, 0);
      if (workers > 0) this.addFlow(`${name} (${workers} workers)`, def.production, workers);
      this.addFlow(`${name} maintenance`, def.maintenance, -group.length);
    }
    if (this.population > 0) this.addFlow(`Citizens (${this.population})`, CITIZEN_UPKEEP, -this.population);

    const flowsPayload: FlowsChangedPayload = { flows: this.flows };
    EventBus.emit(GAME_EVENTS.FLOWS_CHANGED, flowsPayload);
    const workforcePayload: WorkforceChangedPayload = { population: this.population, employed: this.employed };
    EventBus.emit(GAME_EVENTS.WORKFORCE_CHANGED, workforcePayload);
  }

  // Negative multiplier for consumers.
  private addFlow(label: string, amounts: ItemAmounts, multiplier: number) {
    for (const [itemId, amount] of itemEntries(amounts)) {
      const entries = this.flows.get(itemId) ?? [];
      entries.push({ label, amount: amount * multiplier });
      this.flows.set(itemId, entries);
    }
  }

  private onTick() {
    for (const building of this.complete()) {
      if (building.workers > 0) produce(building);
      const payer = building.def.storesGoods ? building : this.routes.nearestStore(building)?.store;
      if (!payer) continue;
      consume(payer.storage, building.def.maintenance, 1);
      consume(payer.storage, CITIZEN_UPKEEP, building.population);
    }
  }

  destroy() {
    for (const event of RECOMPUTE_EVENTS) EventBus.off(event, this.recompute, this);
    EventBus.off(GAME_EVENTS.BUILDING_COMPLETED, this.onBuildingCompleted, this);
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
  }
}

// Stores keep their own output; other buildings pile it up for haulers and stop when the pile is full.
function produce(building: Building) {
  for (const [itemId, amount] of itemEntries(building.def.production)) {
    const space = building.def.storesGoods ? Infinity : SITE_STOCK_CAPACITY - building.storage.total();
    const produced = Math.min(space, amount * building.workers);
    if (produced > 0) building.storage.add(itemId, produced);
  }
}

// Shortages are not modelled yet; consumption just clamps at 0.
function consume(storage: Storage, amounts: ItemAmounts, multiplier: number) {
  if (multiplier <= 0) return;
  for (const [itemId, amount] of itemEntries(amounts)) storage.take(itemId, amount * multiplier);
}

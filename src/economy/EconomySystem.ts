import type { BuildingDef } from '../buildings/buildings';
import type { Building, BuildingSystem } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { CITIZEN_UPKEEP } from '../population/population';
import type { ItemAmounts, ItemId } from '../storage/items';
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

const RECOMPUTE_EVENTS = [GAME_EVENTS.BUILDING_PLACED, GAME_EVENTS.MAP_GENERATED];

// Assigns citizens to jobs, works out what every building and citizen produces/consumes per tick,
// and applies it to storage each tick.
export class EconomySystem {
  private flows = new Map<ItemId, FlowEntry[]>();

  constructor(private storage: Storage, private buildings: BuildingSystem) {
    for (const event of RECOMPUTE_EVENTS) EventBus.on(event, this.recompute, this);
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
  }

  getFlows(): ItemFlows {
    return this.flows;
  }

  private recompute() {
    this.flows = new Map();
    const buildings = this.buildings.getBuildings();
    const buildingCounts = new Map<BuildingDef, number>();
    let population = 0;

    for (const building of buildings) {
      buildingCounts.set(building.def, (buildingCounts.get(building.def) ?? 0) + 1);
      population += building.population;
    }

    const workersByDef = assignWorkers(buildings, population);
    let employed = 0;
    for (const [def, workers] of workersByDef) {
      employed += workers;
      const count = buildingCounts.get(def)!;
      const name = count > 1 ? `${def.name} ×${count}` : def.name;
      this.addFlow(`${name} (${workers} workers)`, def.production, workers);
    }
    for (const [def, count] of buildingCounts) {
      const label = count > 1 ? `${def.name} maintenance ×${count}` : `${def.name} maintenance`;
      this.addFlow(label, def.maintenance, -count);
    }
    if (population > 0) this.addFlow(`Citizens (${population})`, CITIZEN_UPKEEP, -population);

    const flowsPayload: FlowsChangedPayload = { flows: this.flows };
    EventBus.emit(GAME_EVENTS.FLOWS_CHANGED, flowsPayload);
    const workforcePayload: WorkforceChangedPayload = { population, employed };
    EventBus.emit(GAME_EVENTS.WORKFORCE_CHANGED, workforcePayload);
  }

  // Negative multiplier for consumers.
  private addFlow(label: string, amounts: ItemAmounts, multiplier: number) {
    for (const [itemId, amount] of Object.entries(amounts) as [ItemId, number][]) {
      const entries = this.flows.get(itemId) ?? [];
      entries.push({ label, amount: amount * multiplier });
      this.flows.set(itemId, entries);
    }
  }

  private onTick() {
    for (const [itemId, entries] of this.flows) {
      const net = netFlow(entries);
      if (net > 0) this.storage.add(itemId, net);
      else if (net < 0) this.storage.take(itemId, -net);
    }
  }

  destroy() {
    for (const event of RECOMPUTE_EVENTS) EventBus.off(event, this.recompute, this);
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
  }
}

export function netFlow(entries: readonly FlowEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

// Fills jobs in placement order until citizens run out. Returns total workers per building type.
function assignWorkers(buildings: readonly Building[], population: number): Map<BuildingDef, number> {
  const totals = new Map<BuildingDef, number>();
  let available = population;
  for (const building of buildings) {
    building.workers = Math.min(building.jobs, available);
    available -= building.workers;
    if (building.workers > 0) totals.set(building.def, (totals.get(building.def) ?? 0) + building.workers);
  }
  return totals;
}

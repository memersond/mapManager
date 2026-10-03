import type { BuildingDef } from '../buildings/buildings';
import type { BuildingSystem } from '../buildings/BuildingSystem';
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

const RECOMPUTE_EVENTS = [GAME_EVENTS.BUILDING_PLACED, GAME_EVENTS.MAP_GENERATED];

// Works out what every building and citizen produces/consumes per tick, and applies it to storage each tick.
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
    const buildingCounts = new Map<BuildingDef, number>();
    let population = 0;

    for (const building of this.buildings.getBuildings()) {
      buildingCounts.set(building.def, (buildingCounts.get(building.def) ?? 0) + 1);
      population += building.population;
    }

    for (const [def, count] of buildingCounts) {
      const label = count > 1 ? `${def.name} maintenance ×${count}` : `${def.name} maintenance`;
      this.addConsumer(label, def.maintenance, count);
    }
    if (population > 0) this.addConsumer(`Citizens (${population})`, CITIZEN_UPKEEP, population);

    const payload: FlowsChangedPayload = { flows: this.flows };
    EventBus.emit(GAME_EVENTS.FLOWS_CHANGED, payload);
  }

  private addConsumer(label: string, amounts: ItemAmounts, multiplier: number) {
    for (const [itemId, amount] of Object.entries(amounts) as [ItemId, number][]) {
      const entries = this.flows.get(itemId) ?? [];
      entries.push({ label, amount: -amount * multiplier });
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

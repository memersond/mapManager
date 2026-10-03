import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { RouteNetwork } from '../logistics/RouteNetwork';
import { addAmounts, itemEntries, type ItemAmounts } from '../storage/items';
import type { Building, BuildingSystem } from './BuildingSystem';

// Completes queued buildings once their payer (the nearest city) holds the full cost.
// Sites are checked in placement order, but a cheap later site isn't blocked by an expensive earlier one.
export class ConstructionSystem {
  constructor(private buildings: BuildingSystem, private routes: RouteNetwork) {
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
  }

  getSites(): Building[] {
    return this.buildings.getBuildings().filter((building) => building.status === 'queued');
  }

  getPayer(site: Building): Building | null {
    return this.routes.nearestStore(site)?.store ?? null;
  }

  // Combined cost of the queued sites this store pays for.
  getDemand(store: Building): ItemAmounts {
    const demand: ItemAmounts = {};
    for (const site of this.getSites()) {
      if (this.getPayer(site) === store) addAmounts(demand, site.cost);
    }
    return demand;
  }

  private onTick() {
    for (const site of this.getSites()) {
      const payer = this.getPayer(site);
      if (!payer || !payer.storage.hasAll(site.cost)) continue;
      for (const [itemId, amount] of itemEntries(site.cost)) payer.storage.remove(itemId, amount);
      this.buildings.complete(site);
    }
  }

  destroy() {
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
  }
}

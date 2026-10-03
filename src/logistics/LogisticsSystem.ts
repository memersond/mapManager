import type { Building, BuildingSystem } from '../buildings/BuildingSystem';
import type { ConstructionSystem } from '../buildings/ConstructionSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { addAmounts, ITEM_DEFS, itemEntries, type ItemAmounts, type ItemId } from '../storage/items';
import type { Storage } from '../storage/Storage';
import {
  CITY_BASE_STOCK,
  CITY_BASE_STOCK_PER_CITIZEN,
  HAULER_CAPACITY,
  MIN_FETCH_AMOUNT,
  MIN_LOAD_FRACTION,
} from './logistics';
import type { Route, RouteNetwork } from './RouteNetwork';

// Producer haulers: idle → delivering (to the nearest city) → returning → idle.
// City haulers:     idle → fetching (to another city) → delivering (back home) → idle.
export type HaulerPhase = 'idle' | 'fetching' | 'delivering' | 'returning';

export interface Fetch {
  source: Building;
  itemId: ItemId;
  amount: number;
}

export interface Hauler {
  phase: HaulerPhase;
  ticksLeft: number;
  // Route of the current trip, travelled in either direction.
  route: Route | null;
  destination: Building | null;
  cargo: ItemAmounts;
  fetch: Fetch | null;
}

// Stock a city wants on hand. Construction is fetched first; base stock only from what other cities can spare.
export interface StockTargets {
  construction: ItemAmounts;
  base: ItemAmounts;
}

// Amounts already on their way into, or promised out of, each city this tick.
interface Ledger {
  incoming: Map<Building, ItemAmounts>;
  reserved: Map<Building, ItemAmounts>;
  targets: Map<Building, StockTargets>;
}

const TIERS = ['construction', 'base'] as const;
type Tier = (typeof TIERS)[number];

// Moves goods with haulers assigned to buildings. Producers' haulers carry site stock to the nearest city;
// cities' haulers pull goods from other cities to cover queued construction and base stock.
export class LogisticsSystem {
  private haulers = new Map<Building, Hauler[]>();

  constructor(
    private buildings: BuildingSystem,
    private routes: RouteNetwork,
    private construction: ConstructionSystem,
  ) {
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }

  getHaulers(building: Building): readonly Hauler[] {
    return this.haulers.get(building) ?? [];
  }

  entries(): Iterable<[Building, readonly Hauler[]]> {
    return this.haulers.entries();
  }

  getInTransit(itemId: ItemId): number {
    let sum = 0;
    for (const haulers of this.haulers.values()) {
      for (const hauler of haulers) sum += hauler.cargo[itemId] ?? 0;
    }
    return sum;
  }

  // Produced goods still waiting for pickup.
  getAtSites(itemId: ItemId): number {
    return this.buildings
      .getBuildings()
      .reduce((sum, building) => (building.def.storesGoods ? sum : sum + building.storage.get(itemId)), 0);
  }

  getTargets(store: Building): StockTargets {
    const base: ItemAmounts = {};
    addAmounts(base, CITY_BASE_STOCK);
    addAmounts(base, CITY_BASE_STOCK_PER_CITIZEN, store.population);
    return { construction: this.construction.getDemand(store), base };
  }

  // Goods per tick a producer's haulers can move, ignoring the wait for a load.
  getHaulRate(building: Building): number {
    const route = this.routes.routeToStore(building);
    return route ? (building.haulers * HAULER_CAPACITY) / (route.ticks * 2) : 0;
  }

  private onTick() {
    const homes = this.buildings.getBuildings().filter((building) => building.status === 'complete');
    for (const home of homes) {
      for (const hauler of this.syncHaulers(home)) this.advance(home, hauler);
    }

    const ledger = this.createLedger();
    for (const home of homes) {
      for (const hauler of this.getHaulers(home)) {
        if (hauler.phase !== 'idle') continue;
        if (home.def.storesGoods) this.dispatchFetch(home, hauler, ledger);
        else this.dispatchDelivery(home, hauler);
      }
    }
  }

  // Adds idle haulers up to the assigned count; extra haulers leave once idle.
  private syncHaulers(home: Building): Hauler[] {
    let haulers = this.haulers.get(home) ?? [];
    while (haulers.length < home.haulers) haulers.push(createHauler());
    let excess = haulers.length - home.haulers;
    if (excess > 0) haulers = haulers.filter((hauler) => hauler.phase !== 'idle' || excess-- <= 0);
    this.haulers.set(home, haulers);
    return haulers;
  }

  private advance(home: Building, hauler: Hauler) {
    if (hauler.phase === 'idle' || --hauler.ticksLeft > 0) return;

    switch (hauler.phase) {
      case 'fetching': {
        const { source, itemId, amount } = hauler.fetch!;
        hauler.cargo = { [itemId]: source.storage.take(itemId, amount) };
        hauler.fetch = null;
        travel(hauler, 'delivering', hauler.route!, home);
        break;
      }
      case 'delivering':
        for (const [itemId, amount] of itemEntries(hauler.cargo)) hauler.destination!.storage.add(itemId, amount);
        hauler.cargo = {};
        if (home.def.storesGoods) setIdle(hauler);
        else travel(hauler, 'returning', hauler.route!, home);
        break;
      case 'returning':
        setIdle(hauler);
        break;
    }
  }

  private dispatchDelivery(home: Building, hauler: Hauler) {
    const route = this.routes.routeToStore(home);
    if (!route || home.storage.total() < HAULER_CAPACITY * MIN_LOAD_FRACTION) return;
    hauler.cargo = load(home.storage, HAULER_CAPACITY);
    travel(hauler, 'delivering', route, route.to);
  }

  private dispatchFetch(home: Building, hauler: Hauler, ledger: Ledger) {
    const fetch = this.findFetch(home, ledger);
    const route = fetch && this.routes.routeBetween(home, fetch.source);
    if (!fetch || !route) return;
    hauler.fetch = fetch;
    travel(hauler, 'fetching', route, fetch.source);
    addTo(ledger.incoming, home, fetch.itemId, fetch.amount);
    addTo(ledger.reserved, fetch.source, fetch.itemId, fetch.amount);
  }

  private findFetch(home: Building, ledger: Ledger): Fetch | null {
    for (const tier of TIERS) {
      const wanted = wantedFor(ledger.targets.get(home)!, tier);
      for (const { id: itemId } of ITEM_DEFS) {
        const need = (wanted[itemId] ?? 0) - home.storage.get(itemId) - (ledger.incoming.get(home)?.[itemId] ?? 0);
        if (need < MIN_FETCH_AMOUNT) continue;
        const fetch = this.findDonor(home, itemId, need, tier, ledger);
        if (fetch) return fetch;
      }
    }
    return null;
  }

  // Closest other city with goods to spare. For construction a donor keeps only its own construction needs.
  private findDonor(home: Building, itemId: ItemId, need: number, tier: Tier, ledger: Ledger): Fetch | null {
    const donors = this.routes
      .getStores()
      .filter((store) => store !== home)
      .map((store) => ({ store, route: this.routes.routeBetween(home, store) }))
      .filter((donor): donor is { store: Building; route: Route } => donor.route !== null)
      .sort((a, b) => a.route.ticks - b.route.ticks);

    for (const { store } of donors) {
      const keep = wantedFor(ledger.targets.get(store)!, tier)[itemId] ?? 0;
      const spare = store.storage.get(itemId) - keep - (ledger.reserved.get(store)?.[itemId] ?? 0);
      if (spare >= MIN_FETCH_AMOUNT) return { source: store, itemId, amount: Math.min(need, spare, HAULER_CAPACITY) };
    }
    return null;
  }

  private createLedger(): Ledger {
    const ledger: Ledger = { incoming: new Map(), reserved: new Map(), targets: new Map() };
    for (const store of this.routes.getStores()) ledger.targets.set(store, this.getTargets(store));
    for (const [home, haulers] of this.haulers) {
      for (const hauler of haulers) {
        if (hauler.phase === 'fetching') {
          const { source, itemId, amount } = hauler.fetch!;
          addTo(ledger.incoming, home, itemId, amount);
          addTo(ledger.reserved, source, itemId, amount);
        } else if (hauler.phase === 'delivering') {
          for (const [itemId, amount] of itemEntries(hauler.cargo)) {
            addTo(ledger.incoming, hauler.destination!, itemId, amount);
          }
        }
      }
    }
    return ledger;
  }

  private onMapGenerated() {
    this.haulers.clear();
  }

  destroy() {
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }
}

function createHauler(): Hauler {
  return { phase: 'idle', ticksLeft: 0, route: null, destination: null, cargo: {}, fetch: null };
}

function setIdle(hauler: Hauler) {
  Object.assign(hauler, createHauler());
}

function travel(hauler: Hauler, phase: HaulerPhase, route: Route, destination: Building) {
  hauler.phase = phase;
  hauler.route = route;
  hauler.destination = destination;
  hauler.ticksLeft = route.ticks;
}

function load(storage: Storage, capacity: number): ItemAmounts {
  const cargo: ItemAmounts = {};
  let room = capacity;
  for (const { id: itemId } of ITEM_DEFS) {
    const taken = storage.take(itemId, room);
    if (taken > 0) cargo[itemId] = taken;
    room -= taken;
  }
  return cargo;
}

function wantedFor(targets: StockTargets, tier: Tier): ItemAmounts {
  if (tier === 'construction') return targets.construction;
  const wanted: ItemAmounts = {};
  addAmounts(wanted, targets.construction);
  addAmounts(wanted, targets.base);
  return wanted;
}

function addTo(map: Map<Building, ItemAmounts>, building: Building, itemId: ItemId, amount: number) {
  const amounts = map.get(building) ?? {};
  amounts[itemId] = (amounts[itemId] ?? 0) + amount;
  map.set(building, amounts);
}

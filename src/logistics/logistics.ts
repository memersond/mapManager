import { ITEM, type ItemAmounts } from '../storage/items';

// Goods one hauler carries per trip.
export const HAULER_CAPACITY = 20;

// Cells a hauler covers per tick at full movement speed. At 1 or below every tile takes at least a tick;
// slower terrain raises the route cost, so trips take longer.
export const HAULER_CELLS_PER_TICK = 1;

// A producer's hauler waits until this fraction of a full load is waiting before setting off.
export const MIN_LOAD_FRACTION = 0.5;

// Most goods a producer holds waiting for pickup; production stops while full.
export const SITE_STOCK_CAPACITY = 50;

// Stock each city tries to keep on hand, fetched from other cities by its haulers.
export const CITY_BASE_STOCK: ItemAmounts = { [ITEM.WOOD]: 50, [ITEM.FOOD]: 50 };
export const CITY_BASE_STOCK_PER_CITIZEN: ItemAmounts = { [ITEM.FOOD]: 2 };

// Smallest shortfall worth a fetch trip between cities.
export const MIN_FETCH_AMOUNT = 1;

export const ROUTE_TOGGLE_KEY = 'L';

export function travelTicks(cost: number): number {
  return Math.max(1, Math.ceil(cost / HAULER_CELLS_PER_TICK));
}

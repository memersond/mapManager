import { ITEM, type ItemAmounts } from '../storage/items';

// Consumed by each citizen every tick, from the city they live in.
export const CITIZEN_UPKEEP: ItemAmounts = {
  [ITEM.FOOD]: 0.1,
};

// Fill a building's jobs and its def's defaultHaulers from free citizens when construction finishes.
export const AUTO_STAFF_NEW_BUILDINGS = true;

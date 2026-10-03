import { ITEM, type ItemAmounts } from '../storage/items';

// Consumed by each citizen every tick.
export const CITIZEN_UPKEEP: ItemAmounts = {
  [ITEM.FOOD]: 0.1,
};

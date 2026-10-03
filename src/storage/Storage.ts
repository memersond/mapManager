import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { ItemId } from './items';

export interface StorageChangedPayload {
  itemId: ItemId;
  amount: number;
}

export class Storage {
  private amounts = new Map<ItemId, number>();

  constructor(initial: Partial<Record<ItemId, number>> = {}) {
    for (const [itemId, amount] of Object.entries(initial) as [ItemId, number][]) {
      this.amounts.set(itemId, amount);
    }
  }

  get(itemId: ItemId): number {
    return this.amounts.get(itemId) ?? 0;
  }

  has(itemId: ItemId, amount: number): boolean {
    return this.get(itemId) >= amount;
  }

  add(itemId: ItemId, amount: number) {
    this.set(itemId, this.get(itemId) + amount);
  }

  // Returns false and leaves storage untouched if there is not enough.
  remove(itemId: ItemId, amount: number): boolean {
    if (!this.has(itemId, amount)) return false;
    this.set(itemId, this.get(itemId) - amount);
    return true;
  }

  private set(itemId: ItemId, amount: number) {
    this.amounts.set(itemId, amount);
    const payload: StorageChangedPayload = { itemId, amount };
    EventBus.emit(GAME_EVENTS.STORAGE_CHANGED, payload);
  }
}

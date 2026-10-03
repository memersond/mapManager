import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { itemEntries, type ItemAmounts, type ItemId } from './items';

export interface StorageChangedPayload {
  storage: Storage;
  itemId: ItemId;
  amount: number;
}

export class Storage {
  private amounts = new Map<ItemId, number>();

  constructor(initial: ItemAmounts = {}) {
    for (const [itemId, amount] of itemEntries(initial)) this.amounts.set(itemId, amount);
  }

  get(itemId: ItemId): number {
    return this.amounts.get(itemId) ?? 0;
  }

  // Sum of every item held.
  total(): number {
    let sum = 0;
    for (const amount of this.amounts.values()) sum += amount;
    return sum;
  }

  has(itemId: ItemId, amount: number): boolean {
    return this.get(itemId) >= amount;
  }

  hasAll(amounts: ItemAmounts): boolean {
    return itemEntries(amounts).every(([itemId, amount]) => this.has(itemId, amount));
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

  // Removes as much as is available, up to amount. Returns what was actually taken.
  take(itemId: ItemId, amount: number): number {
    const taken = Math.min(amount, this.get(itemId));
    if (taken > 0) this.set(itemId, this.get(itemId) - taken);
    return taken;
  }

  private set(itemId: ItemId, amount: number) {
    this.amounts.set(itemId, amount);
    const payload: StorageChangedPayload = { storage: this, itemId, amount };
    EventBus.emit(GAME_EVENTS.STORAGE_CHANGED, payload);
  }
}

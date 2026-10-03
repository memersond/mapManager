import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { ITEM_DEFS, type ItemDef, type ItemId } from '../storage/items';
import type { Storage, StorageChangedPayload } from '../storage/Storage';
import { HoverTooltip } from './HoverTooltip';

export class StoragePanel {
  private element: HTMLDivElement;
  private tooltip = new HoverTooltip();
  private amountElements = new Map<ItemId, HTMLElement>();

  constructor(scene: Phaser.Scene, storage: Storage) {
    this.element = document.createElement('div');
    this.element.className = 'storage-panel';

    for (const def of ITEM_DEFS) {
      this.element.appendChild(this.createRow(scene, def, storage.get(def.id)));
    }

    document.body.appendChild(this.element);
    EventBus.on(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
  }

  private createRow(scene: Phaser.Scene, def: ItemDef, amount: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'storage-panel__row';

    const icon = document.createElement('img');
    icon.className = 'storage-panel__icon';
    icon.src = scene.textures.getBase64(ATLAS_KEY, spriteFrame(def.sprite));
    icon.alt = def.name;

    const amountElement = document.createElement('span');
    amountElement.className = 'storage-panel__amount';
    amountElement.textContent = formatAmount(amount);
    this.amountElements.set(def.id, amountElement);

    row.append(icon, amountElement);
    this.tooltip.attach(row, 'right', () => `
      <div class="hover-tooltip__title">${def.name}</div>
      <div class="hover-tooltip__description">${def.description}</div>
    `);
    return row;
  }

  private onStorageChanged({ itemId, amount }: StorageChangedPayload) {
    const amountElement = this.amountElements.get(itemId);
    if (amountElement) amountElement.textContent = formatAmount(amount);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    this.element.remove();
    this.tooltip.destroy();
  }
}

function formatAmount(amount: number): string {
  return Math.floor(amount).toLocaleString();
}
